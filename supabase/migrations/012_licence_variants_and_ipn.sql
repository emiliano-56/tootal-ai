-- =====================================================================
--  012 — Licence variants and the IPN intake
-- =====================================================================
--  Two changes the launch needs.
--
--  1. LICENCE SIZES ARE SEPARATE PRODUCTS.
--     OTO 4 is sold as "100 licences" or "150 licences", OTO 5 as
--     "15" or "25". Until now both were one plan with a seat_options
--     array and the size was typed into a prompt, which meant nothing
--     recorded which product the customer actually bought. Splitting
--     them into their own plans makes the purchase self-evident
--     everywhere a plan name is already shown, and gives the payment
--     processor one product per row to post against.
--
--     The tiers still stack in order, so `requires` now names a TIER
--     rather than a plan code — either OTO 4 product satisfies the
--     prerequisite for OTO 5.
--
--  2. IPN.
--     launchpadjv.com posts a sale here; this creates the account,
--     grants the tier and emails the buyer. The payload field names
--     are configuration rather than code, so a change at the vendor's
--     end does not need a deploy.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. TIERS AND SEATS
-- ---------------------------------------------------------------------

alter table public.plans add column if not exists tier            text;
alter table public.plans add column if not exists seats           integer;
alter table public.plans add column if not exists ipn_product_id  text;

-- `requires` used to point at a plan code. It now points at a tier, and
-- two rows share a tier, so the foreign key no longer holds.
alter table public.plans drop constraint if exists plans_requires_fkey;

-- Existing rows: their code is their tier.
update public.plans set tier = code where tier is null;

create unique index if not exists plans_ipn_product_id_key
  on public.plans (ipn_product_id)
  where ipn_product_id is not null;


-- ---------------------------------------------------------------------
--  2. THE LICENCE VARIANTS
-- ---------------------------------------------------------------------

insert into public.plans
  (code, name, description, sort_order, is_bundle, includes, seat_options, grants_role, tier, seats)
values
  ('oto4_100', 'Reseller — 100 Licences',
   'Sell Comic Tale AI under our branding, up to 100 accounts.',
   50, false, '{}', '{}', 'reseller',    'oto4', 100),

  ('oto4_150', 'Reseller — 150 Licences',
   'Sell Comic Tale AI under our branding, up to 150 accounts.',
   51, false, '{}', '{}', 'reseller',    'oto4', 150),

  ('oto5_15',  'White Label — 15 Licences',
   'Run the platform under your own brand, up to 15 accounts.',
   60, false, '{}', '{}', 'white_label', 'oto5', 15),

  ('oto5_25',  'White Label — 25 Licences',
   'Run the platform under your own brand, up to 25 accounts.',
   61, false, '{}', '{}', 'white_label', 'oto5', 25)

on conflict (code) do update set
  name        = excluded.name,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  grants_role = excluded.grants_role,
  tier        = excluded.tier,
  seats       = excluded.seats;


-- Anyone already holding the old combined tier keeps the licence size
-- their tenant was actually given.
do $$
declare
  holder record;
  target uuid;
begin
  for holder in
    select up.user_id, up.plan_id, p.code, t.seat_limit
      from public.user_plans up
      join public.plans p       on p.id  = up.plan_id
      left join public.profiles pr on pr.id = up.user_id
      left join public.tenants t   on t.id  = pr.tenant_id
     where p.code in ('oto4', 'oto5')
  loop
    select id into target from public.plans where code = case holder.code
      when 'oto4' then case when coalesce(holder.seat_limit, 100) >= 150 then 'oto4_150' else 'oto4_100' end
      when 'oto5' then case when coalesce(holder.seat_limit,  15) >=  25 then 'oto5_25'  else 'oto5_15'  end
    end;

    -- They may already have been moved by an earlier run of this file.
    if not exists (
      select 1 from public.user_plans
       where user_id = holder.user_id and plan_id = target
    ) then
      update public.user_plans
         set plan_id = target
       where user_id = holder.user_id and plan_id = holder.plan_id;
    else
      delete from public.user_plans
       where user_id = holder.user_id and plan_id = holder.plan_id;
    end if;
  end loop;
end $$;

delete from public.plan_features
 where plan_id in (select id from public.plans where code in ('oto4', 'oto5'));

delete from public.plans where code in ('oto4', 'oto5');


-- ---------------------------------------------------------------------
--  3. THE CHAIN, BY TIER
-- ---------------------------------------------------------------------
--  fe → oto1 → oto2 → oto3 → oto4 → oto5. The bundle stands alone and
--  grants the largest licence of each, because it is the top purchase:
--  buying it must not leave someone with fewer seats than OTO 4 sold.

update public.plans set requires = null,   tier = 'fe'     where code = 'fe';
update public.plans set requires = 'fe',   tier = 'oto1'   where code = 'oto1';
update public.plans set requires = 'oto1', tier = 'oto2'   where code = 'oto2';
update public.plans set requires = 'oto2', tier = 'oto3'   where code = 'oto3';
update public.plans set requires = 'oto3'                  where tier = 'oto4';
update public.plans set requires = 'oto4'                  where tier = 'oto5';

update public.plans
   set requires = null,
       tier     = 'bundle',
       includes = '{fe,oto1,oto2,oto3,oto4_150,oto5_25}',
       name     = 'Mega Bundle',
       sort_order = 70
 where code = 'mega';

alter table public.plans alter column tier set not null;


/**
 * Refuse a grant whose prerequisite tier is missing.
 *
 * Checked against the tier rather than the plan code so that either
 * licence size of OTO 4 unlocks OTO 5 — the customer bought that step of
 * the funnel, and which size they chose is a separate question.
 *
 * Owning a bundle satisfies everything, since the bundle grants the
 * whole chain.
 */
create or replace function public.enforce_plan_chain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  required_tier text;
  has_bundle    boolean;
begin
  select requires into required_tier from public.plans where id = new.plan_id;

  if required_tier is null then
    return new;
  end if;

  select exists (
    select 1
      from public.user_plans up
      join public.plans p on p.id = up.plan_id
     where up.user_id = new.user_id
       and p.is_bundle
  ) into has_bundle;

  if has_bundle then
    return new;
  end if;

  if not exists (
    select 1
      from public.user_plans up
      join public.plans p on p.id = up.plan_id
     where up.user_id = new.user_id
       and p.tier = required_tier
  ) then
    raise exception 'This account must own % before this tier can be granted', required_tier
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists user_plans_enforce_chain on public.user_plans;
create trigger user_plans_enforce_chain
  before insert on public.user_plans
  for each row execute function public.enforce_plan_chain();


/**
 * One licence size per tier.
 *
 * The 100 and 150 seat products are alternatives, not additions, so
 * granting one drops the other. That makes an upgrade a single grant
 * instead of a revoke the operator has to remember.
 */
create or replace function public.enforce_one_variant_per_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tier text;
begin
  select tier into new_tier from public.plans where id = new.plan_id;

  if new_tier is null then
    return new;
  end if;

  delete from public.user_plans up
   using public.plans p
   where up.plan_id = p.id
     and up.user_id = new.user_id
     and p.tier     = new_tier
     and up.plan_id <> new.plan_id;

  return new;
end $$;

drop trigger if exists user_plans_one_variant on public.user_plans;
create trigger user_plans_one_variant
  before insert on public.user_plans
  for each row execute function public.enforce_one_variant_per_tier();


-- ---------------------------------------------------------------------
--  4. IPN SETTINGS
-- ---------------------------------------------------------------------
--  One row. The field names say where to look in the posted payload,
--  so a vendor that renames `cprodtitle` to `product_id` is a settings
--  edit rather than a release.

create table if not exists public.ipn_settings (
  id                boolean primary key default true,
  vendor            text    not null default 'launchpadjv',
  secret            text,
  enabled           boolean not null default false,

  field_email       text not null default 'email',
  field_name        text not null default 'name',
  field_product     text not null default 'product_id',
  field_transaction text not null default 'transaction_id',
  field_event       text not null default 'transaction_type',

  sale_events       text[] not null default '{SALE,sale,TEST_SALE,BILL,PAYMENT}',
  refund_events     text[] not null default '{RFND,refund,REFUND,CGBK,CANCEL-REBILL}',

  welcome_template  text not null default 'purchase_welcome',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint ipn_settings_single_row check (id)
);

insert into public.ipn_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists ipn_settings_touch on public.ipn_settings;
create trigger ipn_settings_touch
  before update on public.ipn_settings
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
--  5. IPN EVENTS
-- ---------------------------------------------------------------------
--  Every post is written down before it is acted on, so a failure can be
--  read back and replayed. The unique key makes a retry from the vendor
--  harmless rather than a second account.

create table if not exists public.ipn_events (
  id          uuid primary key default gen_random_uuid(),
  vendor      text not null,
  external_id text,
  event_type  text,
  product_id  text,
  email       text,
  plan_code   text,
  user_id     uuid references public.profiles (id) on delete set null,
  status      text not null default 'received',
  message     text,
  payload     jsonb,
  created_at  timestamptz not null default now(),

  constraint ipn_events_status check (status in ('received', 'processed', 'ignored', 'failed'))
);

create unique index if not exists ipn_events_dedupe
  on public.ipn_events (vendor, external_id, product_id)
  where external_id is not null and status = 'processed';

create index if not exists ipn_events_created_idx on public.ipn_events (created_at desc);
create index if not exists ipn_events_email_idx   on public.ipn_events (lower(email));


-- ---------------------------------------------------------------------
--  6. THE PURCHASE EMAIL
-- ---------------------------------------------------------------------

insert into public.email_templates (tenant_id, key, name, subject, body_html, placeholders)
values (
  null,
  'purchase_welcome',
  'Purchase — account ready',
  'Your {{brand_name}} account is ready',
  '<p>Hi {{first_name}},</p>'
  '<p>Thanks for buying <strong>{{plan_name}}</strong>. Your account is ready.</p>'
  '<p><strong>Sign in:</strong> {{login_url}}<br>'
  '<strong>Email:</strong> {{email}}<br>'
  '<strong>Password:</strong> {{password}}</p>'
  '<p>Please change your password after signing in.</p>'
  '<p>— The {{brand_name}} team</p>',
  array['first_name', 'brand_name', 'login_url', 'email', 'password', 'plan_name']
)
on conflict do nothing;


-- ---------------------------------------------------------------------
--  7. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
--  Both tables are the platform owner's: the secret authenticates the
--  payment processor, and the events hold buyers' addresses. Resellers
--  have no business reading either.

alter table public.ipn_settings enable row level security;
alter table public.ipn_events   enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname from pg_policies
     where schemaname = 'public' and tablename in ('ipn_settings', 'ipn_events')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy ipn_settings_superadmin on public.ipn_settings
  for all using (public.is_superadmin()) with check (public.is_superadmin());

create policy ipn_events_superadmin on public.ipn_events
  for all using (public.is_superadmin()) with check (public.is_superadmin());


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select code, name, tier, requires, seats, is_bundle, includes
  from public.plans
 order by sort_order;
