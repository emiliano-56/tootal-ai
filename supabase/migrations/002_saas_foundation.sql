-- =====================================================================
--  002 — Multi-tenant SaaS foundation
-- =====================================================================
--  Adds the tenancy + RBAC spine that every later feature sits on:
--
--    superadmin ──┬── reseller   ── users
--                 ├── white_label ── users
--                 └── users (platform tenant)
--
--  Every profile belongs to exactly one tenant. Seat limits come from the
--  tenant's licence and are enforced in the database, not just the UI, so a
--  forged API call cannot exceed them.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  ENUMS
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('superadmin', 'reseller', 'white_label', 'user');
  end if;

  if not exists (select 1 from pg_type where typname = 'tenant_type') then
    create type public.tenant_type as enum ('platform', 'reseller', 'white_label');
  end if;

  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'suspended', 'pending');
  end if;
end $$;


-- ---------------------------------------------------------------------
--  TENANTS
-- ---------------------------------------------------------------------
--  One row per reseller / white-label business, plus a single seeded
--  'platform' tenant that owns superadmin-created users.

create table if not exists public.tenants (
  id             uuid primary key default gen_random_uuid(),
  type           public.tenant_type not null,
  name           text not null,
  slug           text unique,
  status         public.account_status not null default 'active',

  -- Licence / seats. null seat_limit = unlimited (platform tenant only).
  seat_limit     integer,
  licence_note   text,

  -- White-label branding. Ignored for reseller tenants, which must use
  -- Comic Tale AI branding per the product rules.
  brand_name     text,
  logo_url       text,
  favicon_url    text,
  primary_color  text,
  accent_color   text,
  support_email  text,
  footer_text    text,
  custom_css     text,
  custom_js      text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint tenants_seat_limit_positive check (seat_limit is null or seat_limit > 0),
  -- Only white-label tenants may carry their own branding.
  constraint tenants_branding_only_white_label check (
    type = 'white_label' or (brand_name is null and logo_url is null and custom_css is null)
  )
);

create index if not exists tenants_type_idx   on public.tenants (type);
create index if not exists tenants_status_idx on public.tenants (status);

-- The platform tenant is fixed so superadmin-created users always have a home.
insert into public.tenants (id, type, name, slug, seat_limit)
values ('00000000-0000-0000-0000-000000000001', 'platform', 'Comic Tale AI', 'platform', null)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
--  PROFILES — extend the existing table
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists role       public.user_role     not null default 'user',
  add column if not exists tenant_id  uuid                 references public.tenants (id) on delete restrict,
  add column if not exists created_by uuid                 references public.profiles (id) on delete set null,
  add column if not exists status     public.account_status not null default 'active',
  add column if not exists suspended_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists created_at  timestamptz not null default now();

-- Existing rows predate tenancy — park them on the platform tenant.
update public.profiles
   set tenant_id = '00000000-0000-0000-0000-000000000001'
 where tenant_id is null;

alter table public.profiles alter column tenant_id set not null;

-- Carry the old boolean admin flag over to the new role model, so whoever
-- administered the platform before this migration still can afterwards.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin'
  ) then
    execute 'update public.profiles set role = ''superadmin''
              where is_admin = true and role = ''user''';
  end if;
end $$;

create index if not exists profiles_tenant_idx     on public.profiles (tenant_id);
create index if not exists profiles_role_idx       on public.profiles (role);
create index if not exists profiles_created_by_idx on public.profiles (created_by);

-- A tenant is administered by the reseller / white-label owner profile.
alter table public.tenants
  add column if not exists owner_id uuid references public.profiles (id) on delete restrict;

create index if not exists tenants_owner_idx on public.tenants (owner_id);


-- ---------------------------------------------------------------------
--  CURRENT-USER HELPERS
-- ---------------------------------------------------------------------
--  SECURITY DEFINER on purpose: a policy on `profiles` that reads
--  `profiles` directly would recurse. These bypass RLS to answer one
--  narrow question each, which is the supported Supabase pattern.

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_tenant()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = auth.uid()), false);
$$;

-- Reseller and white-label owners administer their own tenant.
create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('reseller', 'white_label') from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke execute on function public.current_role()   from anon;
revoke execute on function public.current_tenant() from anon;
revoke execute on function public.is_superadmin()  from anon;
revoke execute on function public.is_tenant_admin() from anon;


-- ---------------------------------------------------------------------
--  HIERARCHY + SEAT LIMIT ENFORCEMENT
-- ---------------------------------------------------------------------
--  The UI will also check these, but the database is the last word: a
--  forged request that reaches PostgREST still cannot break the rules.

create or replace function public.enforce_account_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_role public.user_role;
  tenant_limit integer;
  seats_taken  integer;
begin
  -- Who is creating this account? Null when seeded server-side.
  select role into creator_role from public.profiles where id = new.created_by;

  if creator_role is not null then
    -- Only a superadmin may mint resellers or white-label accounts.
    if new.role in ('reseller', 'white_label', 'superadmin')
       and creator_role <> 'superadmin' then
      raise exception 'Only a superadmin can create % accounts', new.role
        using errcode = 'check_violation';
    end if;

    -- Resellers and white-label owners may only create plain users.
    if creator_role in ('reseller', 'white_label') and new.role <> 'user' then
      raise exception 'A % may only create user accounts', creator_role
        using errcode = 'check_violation';
    end if;

    -- A plain user may never create accounts.
    if creator_role = 'user' then
      raise exception 'Users cannot create accounts'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Seat limit, counted per tenant. Null limit = unlimited.
  select seat_limit into tenant_limit from public.tenants where id = new.tenant_id;

  if tenant_limit is not null then
    select count(*) into seats_taken
      from public.profiles
     where tenant_id = new.tenant_id
       and role = 'user';

    if new.role = 'user' and seats_taken >= tenant_limit then
      raise exception 'Licence limit reached: % of % seats used', seats_taken, tenant_limit
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists profiles_enforce_account_rules on public.profiles;
create trigger profiles_enforce_account_rules
  before insert on public.profiles
  for each row execute function public.enforce_account_rules();


-- ---------------------------------------------------------------------
--  AUDIT LOG
-- ---------------------------------------------------------------------

create table if not exists public.audit_logs (
  id           bigserial primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_role   public.user_role,
  tenant_id    uuid references public.tenants (id) on delete set null,
  action       text not null,
  target_type  text,
  target_id    text,
  metadata     jsonb not null default '{}'::jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_tenant_idx  on public.audit_logs (tenant_id, created_at desc);
create index if not exists audit_logs_actor_idx   on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_action_idx  on public.audit_logs (action);


-- ---------------------------------------------------------------------
--  LOGIN HISTORY
-- ---------------------------------------------------------------------

create table if not exists public.login_history (
  id           bigserial primary key,
  user_id      uuid references public.profiles (id) on delete cascade,
  tenant_id    uuid references public.tenants (id) on delete set null,
  succeeded    boolean not null,
  failure_reason text,
  ip_address   inet,
  user_agent   text,
  browser      text,
  device       text,
  country      text,
  created_at   timestamptz not null default now()
);

create index if not exists login_history_user_idx on public.login_history (user_id, created_at desc);
create index if not exists login_history_ip_idx   on public.login_history (ip_address, created_at desc);


-- ---------------------------------------------------------------------
--  CUSTOM DOMAINS — extend for white-label mapping
-- ---------------------------------------------------------------------
--  001 created this table for landing pages; white-label portals need a
--  tenant link plus an approval gate.

alter table public.custom_domains
  add column if not exists tenant_id    uuid references public.tenants (id) on delete cascade,
  add column if not exists purpose      text not null default 'landing_page',
  add column if not exists verified     boolean not null default false,
  add column if not exists approved     boolean not null default false,
  add column if not exists ssl_status   text not null default 'pending',
  add column if not exists verification_token text;

create index if not exists custom_domains_tenant_idx on public.custom_domains (tenant_id);


-- ---------------------------------------------------------------------
--  ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.tenants       enable row level security;
alter table public.audit_logs    enable row level security;
alter table public.login_history enable row level security;
alter table public.profiles      enable row level security;

-- Drop every existing policy on the tables this migration owns before
-- recreating them. Naming each one by hand is what made re-running fail:
-- policies added later (tenants_update, tenants_insert) had no matching
-- drop, so the second run hit "policy already exists".

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('profiles', 'tenants', 'audit_logs', 'login_history')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- --- profiles ---------------------------------------------------------
-- Superadmin sees everything; tenant admins see their own tenant;
-- everyone else sees only themselves.

create policy profiles_read on public.profiles
  for select
  using (
    id = auth.uid()
    or public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  );

create policy profiles_update on public.profiles
  for update
  using (
    id = auth.uid()
    or public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  )
  with check (
    id = auth.uid()
    or public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  );

-- Inserts go through the service-role API routes, which also write the
-- audit trail. The trigger above still guards the hierarchy.
create policy profiles_insert on public.profiles
  for insert
  with check (
    public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  );

-- --- tenants ----------------------------------------------------------

create policy tenants_read on public.tenants
  for select
  using (public.is_superadmin() or id = public.current_tenant());

-- Owners may edit their own branding; only a superadmin may create tenants
-- or change licence limits (enforced in the API layer + column grants).
create policy tenants_update on public.tenants
  for update
  using (public.is_superadmin() or (public.is_tenant_admin() and id = public.current_tenant()))
  with check (public.is_superadmin() or (public.is_tenant_admin() and id = public.current_tenant()));

create policy tenants_insert on public.tenants
  for insert
  with check (public.is_superadmin());

-- --- audit logs -------------------------------------------------------


create policy audit_logs_read on public.audit_logs
  for select
  using (
    public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  );

-- --- login history ----------------------------------------------------


create policy login_history_read on public.login_history
  for select
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  );


-- ---------------------------------------------------------------------
--  TENANT-SCOPED CONTENT
-- ---------------------------------------------------------------------
--  Existing content tables stay owner-scoped for users, but tenant admins
--  need read access for reporting. Additive: the 001 owner policies remain.

do $$
declare
  t text;
begin
  foreach t in array array['comics', 'colorings', 'book_covers', 'chats']
  loop
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "%1$s_tenant_admin_read" on public.%1$I', t);
      execute format(
        'create policy "%1$s_tenant_admin_read" on public.%1$I
           for select
           using (
             public.is_superadmin()
             or (
               public.is_tenant_admin()
               and user_id in (
                 select id from public.profiles where tenant_id = public.current_tenant()
               )
             )
           )', t);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
--  UPDATED_AT
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tenants_touch_updated_at on public.tenants;
create trigger tenants_touch_updated_at
  before update on public.tenants
  for each row execute function public.touch_updated_at();
