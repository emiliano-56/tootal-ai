-- =====================================================================
--  004 — Let auto-created profiles land on the platform tenant
-- =====================================================================
--  002 made profiles.tenant_id NOT NULL. That broke every new signup.
--
--  This project has a trigger on auth.users that inserts a profiles row
--  whenever a login is created. That trigger predates tenancy and does not
--  supply tenant_id, so after 002 every insert failed with:
--
--    null value in column "tenant_id" of relation "profiles"
--    violates not-null constraint
--
--  which surfaced in the app as a useless `{"error":"{}"}` from the Supabase
--  auth admin API. Public signup and console account creation were both
--  affected.
--
--  Giving the column a default fixes it without touching the trigger, which
--  may have been customised. Rows created any other way still pass an
--  explicit tenant.
--
--  Safe to re-run.
-- =====================================================================

alter table public.profiles
  alter column tenant_id set default '00000000-0000-0000-0000-000000000001';

-- Same reasoning for the other columns 002 added: a trigger written before
-- them cannot know to supply a value.
alter table public.profiles
  alter column role   set default 'user',
  alter column status set default 'active';

-- Repair anything created while the constraint was rejecting inserts.
update public.profiles
   set tenant_id = '00000000-0000-0000-0000-000000000001'
 where tenant_id is null;


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select column_name, column_default, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'profiles'
   and column_name in ('tenant_id', 'role', 'status')
 order by column_name;
