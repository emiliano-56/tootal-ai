-- =====================================================================
--  011 — Purchase chain and per-user extra allowances
-- =====================================================================
--  Two things the funnel needs that 008 did not model:
--
--  1. The tiers are sequential. OTO 1 is only sold to someone who already
--     owns Front End, OTO 2 to someone who owns OTO 1, and so on up to
--     OTO 5. The Bundle is the one exception — it is sold on its own and
--     grants everything.
--
--  2. A superadmin sometimes needs to give one customer more than their
--     plan allows, without moving them to a different plan.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  THE CHAIN
-- ---------------------------------------------------------------------

alter table public.plans
  add column if not exists requires text references public.plans (code) on delete set null;

-- fe → oto1 → oto2 → oto3 → oto4 → oto5. The bundle stands alone.
update public.plans set requires = null   where code = 'fe';
update public.plans set requires = 'fe'   where code = 'oto1';
update public.plans set requires = 'oto1' where code = 'oto2';
update public.plans set requires = 'oto2' where code = 'oto3';
update public.plans set requires = 'oto3' where code = 'oto4';
update public.plans set requires = 'oto4' where code = 'oto5';
update public.plans set requires = null   where code = 'mega';


/**
 * Refuse a grant whose prerequisite is missing.
 *
 * Enforced here as well as in the console because the ordering is a
 * commercial rule, not a UI convenience: a direct insert that skipped
 * Front End would leave a customer holding OTO 2 with nothing beneath it.
 *
 * Owning a bundle satisfies every prerequisite, since the bundle already
 * grants the whole chain.
 */
create or replace function public.enforce_plan_chain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  required_code text;
  required_id   uuid;
  has_bundle    boolean;
begin
  select requires into required_code from public.plans where id = new.plan_id;

  if required_code is null then
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

  select id into required_id from public.plans where code = required_code;

  if not exists (
    select 1 from public.user_plans
     where user_id = new.user_id and plan_id = required_id
  ) then
    raise exception 'This account must own % before this tier can be granted', required_code
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists user_plans_enforce_chain on public.user_plans;
create trigger user_plans_enforce_chain
  before insert on public.user_plans
  for each row execute function public.enforce_plan_chain();


-- ---------------------------------------------------------------------
--  PER-USER EXTRA ALLOWANCE
-- ---------------------------------------------------------------------
--  Added on top of whatever the plan gives, every month. Kept separate
--  from plan_features so a plan edit never silently wipes a promise made
--  to one customer.

create table if not exists public.user_feature_grants (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  feature       text not null,
  extra_monthly integer not null default 0,
  note          text,
  granted_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, feature),

  constraint user_feature_grants_positive check (extra_monthly >= 0)
);

drop trigger if exists user_feature_grants_touch on public.user_feature_grants;
create trigger user_feature_grants_touch
  before update on public.user_feature_grants
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
--  ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.user_feature_grants enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'user_feature_grants'
  loop
    execute format('drop policy if exists %I on public.user_feature_grants', pol.policyname);
  end loop;
end $$;

-- You can see your own extras; admins manage the accounts they administer.
create policy user_feature_grants_read on public.user_feature_grants
  for select
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (
      public.is_tenant_admin()
      and user_id in (select id from public.profiles where tenant_id = public.current_tenant())
    )
  );

create policy user_feature_grants_write on public.user_feature_grants
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select code, name, requires, is_bundle
  from public.plans
 order by sort_order;
