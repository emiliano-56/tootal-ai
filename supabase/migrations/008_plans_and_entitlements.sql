-- =====================================================================
--  008 — Plans, entitlements and monthly usage
-- =====================================================================
--  Replaces the credit balance with per-feature monthly limits, and the
--  free-text `profiles.plans` column with real products.
--
--  The funnel stacks rather than replaces: someone can own FE, OTO 2 and
--  OTO 4 at once, so entitlements are the union of everything they hold —
--  not a single "current plan". The Mega Bundle simply grants the others.
--
--  Limits are per calendar month. null means unlimited, which is how OTO 1
--  differs from FE rather than by having a huge number.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  PLANS
-- ---------------------------------------------------------------------

create table if not exists public.plans (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,          -- 'fe', 'oto1', 'mega'
  name         text not null,
  description  text,
  -- Ordering in the upgrade path and in the console.
  sort_order   integer not null default 0,
  -- A bundle grants the plans listed in `includes` instead of its own limits.
  is_bundle    boolean not null default false,
  includes     text[] not null default '{}',
  -- Reseller / white-label licence seats, when the plan sells them.
  seat_options integer[] not null default '{}',
  grants_role  public.user_role,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists plans_sort_idx on public.plans (sort_order);


-- ---------------------------------------------------------------------
--  PLAN ENTITLEMENTS
-- ---------------------------------------------------------------------
--  One row per (plan, feature). `monthly_limit` null = unlimited.

create table if not exists public.plan_features (
  plan_id       uuid not null references public.plans (id) on delete cascade,
  feature       text not null,
  monthly_limit integer,
  primary key (plan_id, feature),

  constraint plan_features_limit_sane check (monthly_limit is null or monthly_limit >= 0)
);

create index if not exists plan_features_feature_idx on public.plan_features (feature);


-- ---------------------------------------------------------------------
--  WHAT EACH ACCOUNT OWNS
-- ---------------------------------------------------------------------
--  Many-to-many on purpose: buying OTO 2 does not remove FE.

create table if not exists public.user_plans (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  plan_id    uuid not null references public.plans (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  primary key (user_id, plan_id)
);

create index if not exists user_plans_user_idx on public.user_plans (user_id);


-- ---------------------------------------------------------------------
--  MONTHLY USAGE
-- ---------------------------------------------------------------------
--  Counted per calendar month so a limit resets without a scheduled job:
--  a new month is simply a new row.

create table if not exists public.feature_usage (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  feature  text not null,
  -- First day of the month, e.g. 2026-08-01.
  period   date not null,
  used     integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature, period)
);

create index if not exists feature_usage_period_idx on public.feature_usage (period);

/**
 * Record one use and return the new total.
 *
 * Done in the database so two requests arriving together cannot both read the
 * old count and each believe they were under the limit.
 */
create or replace function public.consume_feature(
  p_user_id uuid,
  p_feature text,
  p_limit   integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_period date := date_trunc('month', now())::date;
  new_total integer;
begin
  insert into public.feature_usage (user_id, feature, period, used)
  values (p_user_id, p_feature, current_period, 1)
  on conflict (user_id, feature, period)
  do update set used = public.feature_usage.used + 1, updated_at = now()
  returning used into new_total;

  -- Null limit means unlimited, so no check applies.
  if p_limit is not null and new_total > p_limit then
    raise exception 'Monthly limit reached for % (% of %)', p_feature, new_total, p_limit
      using errcode = 'check_violation';
  end if;

  return new_total;
end $$;


-- ---------------------------------------------------------------------
--  ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.plans         enable row level security;
alter table public.plan_features enable row level security;
alter table public.user_plans    enable row level security;
alter table public.feature_usage enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('plans', 'plan_features', 'user_plans', 'feature_usage')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Everyone signed in may read the catalogue; only a superadmin edits it.
create policy plans_read on public.plans
  for select using (auth.uid() is not null);

create policy plans_write on public.plans
  for all using (public.is_superadmin()) with check (public.is_superadmin());

create policy plan_features_read on public.plan_features
  for select using (auth.uid() is not null);

create policy plan_features_write on public.plan_features
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- You see what you own; admins see what they administer.
create policy user_plans_read on public.user_plans
  for select
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (
      public.is_tenant_admin()
      and user_id in (select id from public.profiles where tenant_id = public.current_tenant())
    )
  );

create policy user_plans_write on public.user_plans
  for all
  using (
    public.is_superadmin()
    or (
      public.is_tenant_admin()
      and user_id in (select id from public.profiles where tenant_id = public.current_tenant())
    )
  )
  with check (
    public.is_superadmin()
    or (
      public.is_tenant_admin()
      and user_id in (select id from public.profiles where tenant_id = public.current_tenant())
    )
  );

create policy feature_usage_read on public.feature_usage
  for select
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (
      public.is_tenant_admin()
      and user_id in (select id from public.profiles where tenant_id = public.current_tenant())
    )
  );


-- ---------------------------------------------------------------------
--  SEED: the funnel
-- ---------------------------------------------------------------------

insert into public.plans (code, name, description, sort_order, is_bundle, includes, seat_options, grants_role)
values
  ('fe',   'Front End',  'Everything to get started — 10 of each per month.', 10, false, '{}', '{}', null),
  ('oto1', 'Unlimited',  'Removes every monthly limit.',                      20, false, '{}', '{}', null),
  ('oto2', 'OTO 2',      'Additional tools.',                                 30, false, '{}', '{}', null),
  ('oto3', 'OTO 3',      'Additional tools.',                                 40, false, '{}', '{}', null),
  ('oto4', 'Reseller',   'Sell Comic Tale AI under our branding.',            50, false, '{}', '{100,150}', 'reseller'),
  ('oto5', 'White Label','Run the platform under your own brand.',            60, false, '{}', '{15,25}', 'white_label'),
  ('mega', 'Mega Bundle','Everything from Front End through OTO 5.',          70, true,
   '{fe,oto1,oto2,oto3,oto4,oto5}', '{}', null)
on conflict (code) do nothing;

-- Front End: ten of each core tool per month.
insert into public.plan_features (plan_id, feature, monthly_limit)
select p.id, f.feature, 10
  from public.plans p
 cross join (values ('comic'), ('coloring'), ('video'), ('cover'), ('chat')) as f(feature)
 where p.code = 'fe'
on conflict do nothing;

-- OTO 1: the same tools, unlimited.
insert into public.plan_features (plan_id, feature, monthly_limit)
select p.id, f.feature, null
  from public.plans p
 cross join (values ('comic'), ('coloring'), ('video'), ('cover'), ('chat')) as f(feature)
 where p.code = 'oto1'
on conflict do nothing;

-- OTO 2: the AI agents.
insert into public.plan_features (plan_id, feature, monthly_limit)
select p.id, f.feature, null
  from public.plans p
 cross join (values ('comic-agent'), ('comic-video'), ('cover-designer'), ('prompt-studio')) as f(feature)
 where p.code = 'oto2'
on conflict do nothing;

-- OTO 3: the business tools.
insert into public.plan_features (plan_id, feature, monthly_limit)
select p.id, f.feature, null
  from public.plans p
 cross join (values ('business-agent'), ('landing-pages'), ('marketing'), ('dfy-prompts')) as f(feature)
 where p.code = 'oto3'
on conflict do nothing;


-- ---------------------------------------------------------------------
--  MIGRATE EXISTING ACCOUNTS
-- ---------------------------------------------------------------------
--  The old `plans` column held seven inconsistent free-text values. Everyone
--  is placed on Front End; a superadmin can grant the OTOs they actually own.

insert into public.user_plans (user_id, plan_id)
select pr.id, pl.id
  from public.profiles pr
 cross join public.plans pl
 where pl.code = 'fe'
   and pr.role = 'user'
on conflict do nothing;


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select p.code, p.name, p.is_bundle, count(pf.feature) as features
  from public.plans p
  left join public.plan_features pf on pf.plan_id = p.id
 group by p.id, p.code, p.name, p.is_bundle, p.sort_order
 order by p.sort_order;
