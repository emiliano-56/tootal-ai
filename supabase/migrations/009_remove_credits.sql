-- =====================================================================
--  009 — Remove the credit system
-- =====================================================================
--  Monthly per-feature limits (008) replace credits entirely, so the
--  balance column and the credit-costing settings have nothing left to do.
--
--  Dropping the column is deliberate rather than leaving it unused: a
--  column that still exists gets read by the next person who greps for it,
--  and two sources of truth for "may this user generate" is exactly the
--  confusion this change removes.
--
--  DESTRUCTIVE — balances are not recoverable afterwards. Take a backup
--  first if you want the historical numbers.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  Keep a copy of the balances before they go
-- ---------------------------------------------------------------------
--  Cheap insurance: a small archive table beats a support conversation
--  about what someone's balance used to be.

create table if not exists public.credits_archive (
  user_id    uuid primary key,
  email      text,
  credits    numeric,
  archived_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'credits'
  ) then
    execute '
      insert into public.credits_archive (user_id, email, credits)
      select id, email, credits from public.profiles
      on conflict (user_id) do nothing';
  end if;
end $$;

alter table public.credits_archive enable row level security;

drop policy if exists credits_archive_read on public.credits_archive;

create policy credits_archive_read on public.credits_archive
  for select using (public.is_superadmin());


-- ---------------------------------------------------------------------
--  Drop the column
-- ---------------------------------------------------------------------

alter table public.profiles drop column if exists credits;


-- ---------------------------------------------------------------------
--  Remove the credit-costing settings
-- ---------------------------------------------------------------------
--  Costs are now expressed as monthly allowances on each plan.

delete from public.platform_settings
 where key in (
   'default_credits',
   'credit_cost_comic',
   'credit_cost_coloring',
   'credit_cost_video'
 );


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select
  (select count(*) from public.credits_archive)                                  as balances_archived,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'credits')                                               as credits_column_left,
  (select count(*) from public.platform_settings where key like 'credit%')       as credit_settings_left;
