-- =====================================================================
--  006 — Platform settings
-- =====================================================================
--  The last table the console needs. Brand, Domains, Broadcasts and
--  Analytics all run on tables that already exist (tenants,
--  custom_domains, email_broadcasts, profiles/api_usage_logs) — only
--  settings had nowhere to live.
--
--  Key/value rather than one wide row: feature toggles and defaults get
--  added over time, and a new setting should not need a migration.
--
--  Safe to re-run.
-- =====================================================================

create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  label       text not null,
  description text,
  -- Grouping for the settings screen.
  category    text not null default 'general',
  -- 'boolean' | 'number' | 'text' | 'select' — drives which control renders.
  input_type  text not null default 'text',
  options     jsonb,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create index if not exists platform_settings_category_idx
  on public.platform_settings (category);

drop trigger if exists platform_settings_touch_updated_at on public.platform_settings;
create trigger platform_settings_touch_updated_at
  before update on public.platform_settings
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
--  RLS — readable by any signed-in account, writable by superadmin only
-- ---------------------------------------------------------------------
--  Users need to read toggles that affect what the app offers them; only a
--  superadmin may change them.

alter table public.platform_settings enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'platform_settings'
  loop
    execute format('drop policy if exists %I on public.platform_settings', pol.policyname);
  end loop;
end $$;

create policy platform_settings_read on public.platform_settings
  for select
  using (auth.uid() is not null);

create policy platform_settings_write on public.platform_settings
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());


-- ---------------------------------------------------------------------
--  SEED
-- ---------------------------------------------------------------------

insert into public.platform_settings (key, value, label, description, category, input_type, options)
values
  ('signup_enabled', 'true'::jsonb, 'Public signup',
   'Allow anyone to create an account from the signup page.', 'access', 'boolean', null),

  ('default_credits', '10'::jsonb, 'Starting credits',
   'Credits given to a newly created user account.', 'credits', 'number', null),

  ('credit_cost_comic', '5'::jsonb, 'Credits per comic',
   'Deducted when a comic is generated.', 'credits', 'number', null),

  ('credit_cost_coloring', '3'::jsonb, 'Credits per coloring page',
   'Deducted when a coloring page is generated.', 'credits', 'number', null),

  ('credit_cost_video', '15'::jsonb, 'Credits per video',
   'Deducted when a video is generated.', 'credits', 'number', null),

  ('maintenance_mode', 'false'::jsonb, 'Maintenance mode',
   'Show a maintenance notice instead of the app. Superadmins keep access.', 'access', 'boolean', null),

  ('allow_personal_api_keys', 'false'::jsonb, 'Personal API keys',
   'Let users add their own provider keys instead of using the platform''s.',
   'ai', 'boolean', null),

  ('default_api_policy', '"platform_only"'::jsonb, 'Default API policy',
   'Which keys a new user account is allowed to use.', 'ai', 'select',
   '["platform_only","personal_allowed","mixed"]'::jsonb),

  ('support_email', '"support@comictale.ai"'::jsonb, 'Support email',
   'Shown to users and used as the reply-to on transactional email.',
   'general', 'text', null),

  ('platform_name', '"ComicTale AI"'::jsonb, 'Platform name',
   'Used in email templates and the default branding.', 'general', 'text', null)
on conflict (key) do nothing;


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select category, count(*) as settings
  from public.platform_settings
 group by category
 order by category;
