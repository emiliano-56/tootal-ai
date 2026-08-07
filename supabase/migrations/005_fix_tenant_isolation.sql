-- =====================================================================
--  005 — Close the tenant isolation leak on profiles
-- =====================================================================
--  SECURITY FIX. Apply this before anyone else uses the platform.
--
--  Row level security policies are OR'd together: if ANY policy grants a
--  row, the row is returned. This project accumulated permissive policies
--  from earlier ad-hoc scripts — names like "Authenticated users can view
--  profiles" and "Admins can view all profiles" — which grant far more than
--  the tenancy model allows.
--
--  The version of 002 that was applied here dropped only a fixed list of
--  policy names, so those older ones survived alongside the new ones. The
--  result: a reseller signing in could read every profile on the platform,
--  not just their own tenant. Verified against a live reseller account —
--  14 rows visible, 13 of them belonging to other tenants.
--
--  This migration drops every policy on the affected tables by discovery
--  and recreates only the intended ones.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  STEP 1 — clear every existing policy on the managed tables
-- ---------------------------------------------------------------------

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'profiles', 'tenants', 'audit_logs', 'login_history',
         'api_credentials', 'api_usage_logs', 'smtp_accounts',
         'email_templates', 'email_broadcasts', 'leads',
         'autoresponder_connections', 'lead_deliveries'
       )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;


-- ---------------------------------------------------------------------
--  STEP 2 — recreate the intended policies
-- ---------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.tenants       enable row level security;
alter table public.audit_logs    enable row level security;
alter table public.login_history enable row level security;

-- --- profiles ---------------------------------------------------------
-- Yourself, or — for a superadmin — everyone, or — for a tenant admin —
-- your own tenant. Nothing else.

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

create policy profiles_insert on public.profiles
  for insert
  with check (
    public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
    -- The auth.users trigger inserts the caller's own row on signup.
    or id = auth.uid()
  );

-- --- tenants ----------------------------------------------------------

create policy tenants_read on public.tenants
  for select
  using (public.is_superadmin() or id = public.current_tenant());

create policy tenants_update on public.tenants
  for update
  using (public.is_superadmin() or (public.is_tenant_admin() and id = public.current_tenant()))
  with check (public.is_superadmin() or (public.is_tenant_admin() and id = public.current_tenant()));

create policy tenants_insert on public.tenants
  for insert
  with check (public.is_superadmin());

-- --- audit + login history --------------------------------------------

create policy audit_logs_read on public.audit_logs
  for select
  using (
    public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  );

create policy login_history_read on public.login_history
  for select
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  );

-- --- platform services (003) ------------------------------------------

alter table public.api_credentials           enable row level security;
alter table public.api_usage_logs            enable row level security;
alter table public.smtp_accounts             enable row level security;
alter table public.email_templates           enable row level security;
alter table public.email_broadcasts          enable row level security;
alter table public.leads                     enable row level security;
alter table public.autoresponder_connections enable row level security;
alter table public.lead_deliveries           enable row level security;

create policy api_credentials_read on public.api_credentials
  for select
  using (public.is_superadmin() or (scope = 'user' and owner_id = auth.uid()));

create policy api_credentials_write on public.api_credentials
  for all
  using (public.is_superadmin() or (scope = 'user' and owner_id = auth.uid()))
  with check (public.is_superadmin() or (scope = 'user' and owner_id = auth.uid()));

create policy api_usage_read on public.api_usage_logs
  for select
  using (
    public.is_superadmin()
    or user_id = auth.uid()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  );

create policy smtp_read on public.smtp_accounts
  for select
  using (public.is_superadmin() or tenant_id = public.current_tenant());

create policy smtp_write on public.smtp_accounts
  for all
  using (
    public.is_superadmin()
    or (tenant_id = public.current_tenant() and public.current_role() = 'white_label')
  )
  with check (
    public.is_superadmin()
    or (tenant_id = public.current_tenant() and public.current_role() = 'white_label')
  );

create policy email_templates_read on public.email_templates
  for select
  using (public.is_superadmin() or tenant_id is null or tenant_id = public.current_tenant());

create policy email_templates_write on public.email_templates
  for all
  using (
    public.is_superadmin()
    or (tenant_id = public.current_tenant() and public.current_role() = 'white_label')
  )
  with check (
    public.is_superadmin()
    or (tenant_id = public.current_tenant() and public.current_role() = 'white_label')
  );

create policy email_broadcasts_all on public.email_broadcasts
  for all
  using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant()))
  with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant()));

create policy leads_all on public.leads
  for all
  using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant()))
  with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant()));

create policy autoresponder_all on public.autoresponder_connections
  for all
  using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant()))
  with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant()));

create policy lead_deliveries_read on public.lead_deliveries
  for select
  using (
    public.is_superadmin()
    or lead_id in (select id from public.leads where tenant_id = public.current_tenant())
  );


-- ---------------------------------------------------------------------
--  STEP 3 — verify
-- ---------------------------------------------------------------------
--  profiles should list exactly: profiles_insert, profiles_read,
--  profiles_update. Anything else is a leftover and re-opens the leak.

select tablename, policyname
  from pg_policies
 where schemaname = 'public'
   and tablename in ('profiles', 'tenants', 'audit_logs')
 order by tablename, policyname;
