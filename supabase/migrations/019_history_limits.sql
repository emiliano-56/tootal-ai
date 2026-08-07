-- =====================================================================
--  019 — The keep-limit applies to everyone, and can be lifted per user
-- =====================================================================
--  018 gave Front End a limit and left OTO 1 and the bundle unlimited,
--  hard-coded. Two things wrong with that:
--
--    - "Unlimited" written into a migration is not a setting. The
--      platform owner cannot change it without another migration, which
--      is exactly the thing the Plans screen exists to avoid.
--
--    - There was no way to give one customer more without moving them to
--      a different plan. That request arrives constantly and the answer
--      should not be "buy an upgrade you do not otherwise need".
--
--  So every tier gets a real number the console can edit, and a per-user
--  grant sits on top — the same shape as the extra monthly allowances
--  that already exist in user_feature_grants.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. A NUMBER FOR EVERY TIER
-- ---------------------------------------------------------------------
--  Starting values only. All of them are editable under Superadmin →
--  Plans, which is the point of moving them out of the migration.
--
--  Set with `is not distinct from null` rather than `is null` so a value
--  the owner has already chosen is never overwritten by a re-run.

update public.plans set library_limit = 10   where code = 'fe'   and library_limit is null;
update public.plans set library_limit = 200  where code = 'oto1' and library_limit is null;
update public.plans set library_limit = 200  where code = 'oto2' and library_limit is null;
update public.plans set library_limit = 200  where code = 'oto3' and library_limit is null;
update public.plans set library_limit = 500  where code = 'mega' and library_limit is null;

-- Reseller and white-label tiers are about selling seats, not keeping
-- files, so they say nothing and inherit whatever else is held.
update public.plans set library_limit = null where tier in ('oto4', 'oto5');


-- ---------------------------------------------------------------------
--  2. EXTRA FOR ONE CUSTOMER
-- ---------------------------------------------------------------------
--  Added on top of whatever the plans give. Kept in the table that
--  already holds per-user monthly extras, so the console has one place
--  to look and one panel to edit.
--
--  `feature` here is a library kind ('comic', 'video'…), and the row is
--  distinguished from a monthly grant by which column is filled.

alter table public.user_feature_grants
  add column if not exists extra_library integer not null default 0;

alter table public.user_feature_grants
  drop constraint if exists user_feature_grants_library_positive;

alter table public.user_feature_grants
  add constraint user_feature_grants_library_positive check (extra_library >= 0);

-- A row that grants only library space should not also be read as a
-- monthly allowance of zero, so the existing positive check stays as it
-- was and both columns default to 0.


-- ---------------------------------------------------------------------
--  3. WHAT THE HISTORY SHOWS
-- ---------------------------------------------------------------------
--  Agent runs are part of "everything I made", so the history reads them
--  alongside library items. `agent_jobs` predates the tenancy work and
--  has no index for the query the page actually makes.

create index if not exists agent_jobs_user_created_idx
  on public.agent_jobs (user_id, created_at desc);

-- Titles were only ever written to `current_step`, which is a progress
-- label rather than a name. Anything still holding a step name is left
-- alone; the history falls back to the agent's own label.


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select code, name, library_limit
  from public.plans
 order by sort_order;
