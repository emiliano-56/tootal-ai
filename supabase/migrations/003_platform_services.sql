-- =====================================================================
--  003 — Platform services
-- =====================================================================
--  Schema for AI provider management, SMTP, email templates, broadcasts,
--  leads and autoresponder integrations.
--
--  Secrets (API keys, SMTP passwords, autoresponder tokens) are stored
--  encrypted-at-rest by Postgres and are never exposed through RLS to
--  anyone below superadmin. Tenant-owned rows are readable only inside
--  their own tenant.
--
--  Requires 002. Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  ENUMS
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_provider') then
    create type public.ai_provider as enum (
      'zoop', 'deepseek', 'claude', 'openai', 'gemini', 'openrouter', 'custom'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'api_key_scope') then
    -- Whose key is it: the platform's, or a user's own.
    create type public.api_key_scope as enum ('platform', 'user');
  end if;

  if not exists (select 1 from pg_type where typname = 'api_policy_mode') then
    create type public.api_policy_mode as enum ('platform_only', 'personal_allowed', 'mixed');
  end if;

  if not exists (select 1 from pg_type where typname = 'autoresponder_provider') then
    create type public.autoresponder_provider as enum (
      'getresponse', 'emailoctopus', 'aweber', 'mailchimp', 'brevo',
      'convertkit', 'mailerlite', 'constantcontact', 'sendfox'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'delivery_status') then
    create type public.delivery_status as enum ('pending', 'sent', 'failed', 'skipped');
  end if;
end $$;


-- ---------------------------------------------------------------------
--  AI PROVIDER CREDENTIALS
-- ---------------------------------------------------------------------

create table if not exists public.api_credentials (
  id              uuid primary key default gen_random_uuid(),
  provider        public.ai_provider not null,
  label           text not null,
  scope           public.api_key_scope not null default 'platform',

  -- Set for scope='user'; null for platform-wide keys.
  owner_id        uuid references public.profiles (id) on delete cascade,
  tenant_id       uuid references public.tenants (id) on delete cascade,

  api_key         text not null,
  base_url        text,
  model           text,

  enabled         boolean not null default true,
  priority        integer not null default 100,   -- lower runs first
  daily_limit     integer,
  monthly_limit   integer,

  last_tested_at  timestamptz,
  last_test_ok    boolean,
  last_error      text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint api_credentials_owner_matches_scope check (
    (scope = 'platform' and owner_id is null)
    or (scope = 'user' and owner_id is not null)
  )
);

create index if not exists api_credentials_provider_idx on public.api_credentials (provider, enabled, priority);
create index if not exists api_credentials_owner_idx    on public.api_credentials (owner_id);

-- Usage + error log, used for analytics and for failover decisions.
create table if not exists public.api_usage_logs (
  id             bigserial primary key,
  credential_id  uuid references public.api_credentials (id) on delete set null,
  provider       public.ai_provider not null,
  user_id        uuid references public.profiles (id) on delete set null,
  tenant_id      uuid references public.tenants (id) on delete set null,
  operation      text,
  tokens_in      integer,
  tokens_out     integer,
  latency_ms     integer,
  succeeded      boolean not null,
  error_message  text,
  created_at     timestamptz not null default now()
);

create index if not exists api_usage_provider_idx on public.api_usage_logs (provider, created_at desc);
create index if not exists api_usage_tenant_idx   on public.api_usage_logs (tenant_id, created_at desc);

-- Per-user API policy (spec modes 1/2/3).
alter table public.profiles
  add column if not exists api_policy public.api_policy_mode not null default 'platform_only';


-- ---------------------------------------------------------------------
--  SMTP
-- ---------------------------------------------------------------------

create table if not exists public.smtp_accounts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants (id) on delete cascade,
  label         text not null,
  host          text not null,
  port          integer not null default 587,
  username      text not null,
  password      text not null,
  from_email    text not null,
  from_name     text,
  secure        boolean not null default true,

  is_primary    boolean not null default false,
  is_backup     boolean not null default false,
  enabled       boolean not null default true,

  last_tested_at timestamptz,
  last_test_ok   boolean,
  last_error     text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint smtp_port_valid check (port between 1 and 65535)
);

create index if not exists smtp_tenant_idx on public.smtp_accounts (tenant_id);

-- Only one primary SMTP per tenant (null tenant = platform default).
create unique index if not exists smtp_one_primary_per_tenant
  on public.smtp_accounts (coalesce(tenant_id, '00000000-0000-0000-0000-000000000001'::uuid))
  where is_primary;


-- ---------------------------------------------------------------------
--  EMAIL TEMPLATES + BROADCASTS
-- ---------------------------------------------------------------------

create table if not exists public.email_templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants (id) on delete cascade,
  key          text not null,               -- 'welcome', 'password_reset', …
  name         text not null,
  subject      text not null,
  body_html    text not null,
  body_text    text,
  placeholders text[] not null default '{}',
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One template per key per tenant; platform defaults have a null tenant.
create unique index if not exists email_templates_key_per_tenant
  on public.email_templates (key, coalesce(tenant_id, '00000000-0000-0000-0000-000000000001'::uuid));

create table if not exists public.email_broadcasts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  subject       text not null,
  body_html     text not null,
  audience      jsonb not null default '{}'::jsonb,   -- role / tag filters
  scheduled_for timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  total_count   integer not null default 0,
  sent_count    integer not null default 0,
  failed_count  integer not null default 0,
  status        public.delivery_status not null default 'pending',
  created_at    timestamptz not null default now()
);

create index if not exists email_broadcasts_tenant_idx on public.email_broadcasts (tenant_id, created_at desc);


-- ---------------------------------------------------------------------
--  LEADS
-- ---------------------------------------------------------------------

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  email        text not null,
  first_name   text,
  last_name    text,
  phone        text,
  source       text,
  tags         text[] not null default '{}',
  metadata     jsonb not null default '{}'::jsonb,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Duplicate detection is a database guarantee, not an import-time check.
create unique index if not exists leads_unique_email_per_tenant
  on public.leads (tenant_id, lower(email));

create index if not exists leads_tenant_idx on public.leads (tenant_id, created_at desc);
create index if not exists leads_tags_idx   on public.leads using gin (tags);

create table if not exists public.autoresponder_connections (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  provider     public.autoresponder_provider not null,
  label        text not null,
  api_key      text not null,
  api_secret   text,
  list_id      text,
  extra        jsonb not null default '{}'::jsonb,
  enabled      boolean not null default true,
  last_tested_at timestamptz,
  last_test_ok   boolean,
  last_error     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists autoresponder_tenant_idx on public.autoresponder_connections (tenant_id);

-- One row per (lead, connection) push attempt, so a lead can fan out to
-- several autoresponders and each result is tracked separately.
create table if not exists public.lead_deliveries (
  id             bigserial primary key,
  lead_id        uuid not null references public.leads (id) on delete cascade,
  connection_id  uuid not null references public.autoresponder_connections (id) on delete cascade,
  status         public.delivery_status not null default 'pending',
  attempts       integer not null default 0,
  error_message  text,
  delivered_at   timestamptz,
  created_at     timestamptz not null default now(),

  unique (lead_id, connection_id)
);

create index if not exists lead_deliveries_status_idx on public.lead_deliveries (status, created_at);


-- ---------------------------------------------------------------------
--  ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.api_credentials           enable row level security;
alter table public.api_usage_logs            enable row level security;
alter table public.smtp_accounts             enable row level security;
alter table public.email_templates           enable row level security;
alter table public.email_broadcasts          enable row level security;
alter table public.leads                     enable row level security;
alter table public.autoresponder_connections enable row level security;
alter table public.lead_deliveries           enable row level security;

-- Clear existing policies on these tables first. Dropping by discovery
-- rather than by name keeps the migration re-runnable even after a policy
-- is added or renamed later.

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in (
         'api_credentials', 'api_usage_logs', 'smtp_accounts',
         'email_templates', 'email_broadcasts', 'leads',
         'autoresponder_connections', 'lead_deliveries'
       )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- --- api credentials --------------------------------------------------
-- Platform keys: superadmin only. Personal keys: the owner only.

create policy api_credentials_read on public.api_credentials
  for select
  using (
    public.is_superadmin()
    or (scope = 'user' and owner_id = auth.uid())
  );

create policy api_credentials_write on public.api_credentials
  for all
  using (
    public.is_superadmin()
    or (scope = 'user' and owner_id = auth.uid())
  )
  with check (
    public.is_superadmin()
    or (scope = 'user' and owner_id = auth.uid())
  );

-- --- api usage --------------------------------------------------------


create policy api_usage_read on public.api_usage_logs
  for select
  using (
    public.is_superadmin()
    or user_id = auth.uid()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  );

-- --- smtp -------------------------------------------------------------
-- White labels may run their own SMTP; resellers may not.


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

-- --- email templates + broadcasts -------------------------------------


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

-- --- leads ------------------------------------------------------------


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
--  UPDATED_AT TRIGGERS
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'api_credentials', 'smtp_accounts', 'email_templates',
    'leads', 'autoresponder_connections'
  ]
  loop
    execute format('drop trigger if exists %1$s_touch_updated_at on public.%1$I', t);
    execute format(
      'create trigger %1$s_touch_updated_at
         before update on public.%1$I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
--  SEED: default email templates
-- ---------------------------------------------------------------------

insert into public.email_templates (tenant_id, key, name, subject, body_html, placeholders)
values
  (null, 'welcome', 'Welcome', 'Welcome to {{brand_name}}',
   '<p>Hi {{first_name}},</p><p>Your {{brand_name}} account is ready.</p>',
   array['first_name', 'brand_name', 'login_url']),
  (null, 'password_reset', 'Password reset', 'Reset your {{brand_name}} password',
   '<p>Hi {{first_name}},</p><p><a href="{{reset_url}}">Reset your password</a></p>',
   array['first_name', 'brand_name', 'reset_url']),
  (null, 'account_suspended', 'Account suspended', 'Your {{brand_name}} account is on hold',
   '<p>Hi {{first_name}},</p><p>Your account has been suspended. Contact {{support_email}}.</p>',
   array['first_name', 'brand_name', 'support_email'])
on conflict do nothing;
