-- =====================================================================
--  027 — Style presets, version history, and bulk runs
-- =====================================================================
--  Three things that all answer the same complaint: the app made one
--  thing at a time, forgot how you liked it, and could not go back.
--
--  1. STYLE PRESETS.
--     Art style, palette and audience are retyped on every screen and
--     every run. Someone with a series has one house style and no way to
--     say so, so book four looks like a different publisher's.
--
--  2. VERSION HISTORY.
--     The panel editor has undo, and undo dies with the tab. Redraw a
--     page, close the laptop, and yesterday's version is gone. A snapshot
--     is cheap and being able to go back is what makes editing safe.
--
--  3. BULK RUNS.
--     Autopilot generates unattended on a schedule. Nothing could take a
--     list of twenty ideas and work through it. Same engine, different
--     trigger.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. STYLE PRESETS
-- ---------------------------------------------------------------------

create table if not exists public.style_presets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  tenant_id    uuid references public.tenants (id) on delete set null,

  name         text not null,
  -- The sentence that goes into every image prompt.
  art_style    text not null default '',
  audience     text not null default '',
  tone         text not null default '',
  -- Free-form so a preset can carry whatever a screen needs without a
  -- migration per field: palette, fonts, aspect ratio, panel counts.
  settings     jsonb not null default '{}'::jsonb,

  -- One preset per account may be the default, enforced below.
  is_default   boolean not null default false,
  times_used   integer not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint style_presets_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists style_presets_user_idx
  on public.style_presets (user_id, created_at desc);

-- Exactly one default per account. A partial unique index rather than a
-- trigger: the database refuses a second one outright, so no code path
-- can create the state where two presets both claim to be the default.
create unique index if not exists style_presets_one_default
  on public.style_presets (user_id)
  where is_default;


-- ---------------------------------------------------------------------
--  2. VERSION HISTORY
-- ---------------------------------------------------------------------
--  Snapshots of a project as the customer worked on it.
--
--  Panel images are NOT stored here. They are data URLs of a megabyte
--  each and twenty-four of them would be a 24MB jsonb row per save —
--  which would be slow to write, slow to read and would fill the
--  database in a week. What is kept is everything needed to rebuild:
--  the script, the prompts, the bubbles, the layout. Re-rendering an
--  image costs a generation, so a restore says so rather than pretending
--  the pictures came back for free.

create table if not exists public.project_versions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,

  -- Free-form so a version can belong to a project, a library item or an
  -- unsaved editing session. Not a foreign key for the same reason.
  subject_kind text not null default 'comic',
  subject_id   text not null,

  label        text not null default '',
  -- What changed, in the customer's words or ours.
  note         text not null default '',

  -- The rebuildable state. Images excluded on purpose.
  snapshot     jsonb not null,
  panel_count  integer not null default 0,

  created_at   timestamptz not null default now()
);

create index if not exists project_versions_subject_idx
  on public.project_versions (user_id, subject_kind, subject_id, created_at desc);


-- ---------------------------------------------------------------------
--  3. BULK RUNS
-- ---------------------------------------------------------------------
--  A job is a list of ideas; an item is one of them. Kept apart so a
--  single failure is one row rather than a flag on the whole batch, and
--  so a job can be resumed without redoing what already worked.

create table if not exists public.bulk_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  tenant_id    uuid references public.tenants (id) on delete set null,

  name         text not null default '',
  -- What each item produces: comic, coloring, storybook, strip.
  kind         text not null default 'comic',
  preset_id    uuid references public.style_presets (id) on delete set null,
  -- Everything the generator needs that is not per-item.
  settings     jsonb not null default '{}'::jsonb,

  status       text not null default 'queued',
  total        integer not null default 0,
  done         integer not null default 0,
  failed       integer not null default 0,

  started_at   timestamptz,
  finished_at  timestamptz,
  error        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint bulk_jobs_status
    check (status in ('queued', 'running', 'paused', 'done', 'failed', 'cancelled'))
);

create index if not exists bulk_jobs_user_idx on public.bulk_jobs (user_id, created_at desc);

-- What the worker asks for: the next queued item of a running job.
create index if not exists bulk_jobs_running_idx
  on public.bulk_jobs (status, updated_at)
  where status in ('queued', 'running');

create table if not exists public.bulk_items (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.bulk_jobs (id) on delete cascade,

  position     integer not null,
  idea         text not null,
  title        text not null default '',

  status       text not null default 'queued',
  attempts     integer not null default 0,
  -- Where the finished thing ended up.
  library_item_id uuid,
  project_id      uuid,
  error        text,

  started_at   timestamptz,
  finished_at  timestamptz,

  constraint bulk_items_status
    check (status in ('queued', 'running', 'done', 'failed', 'skipped')),
  unique (job_id, position)
);

create index if not exists bulk_items_next_idx
  on public.bulk_items (job_id, status, position);


-- ---------------------------------------------------------------------
--  4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.style_presets    enable row level security;
alter table public.project_versions enable row level security;
alter table public.bulk_jobs        enable row level security;
alter table public.bulk_items       enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('style_presets', 'project_versions', 'bulk_jobs', 'bulk_items')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy style_presets_own on public.style_presets
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());

create policy project_versions_own on public.project_versions
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());

create policy bulk_jobs_own on public.bulk_jobs
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());

-- Ownership follows the job, so the rule lives in one place.
create policy bulk_items_own on public.bulk_items
  for all
  using (
    exists (
      select 1 from public.bulk_jobs j
       where j.id = job_id and (j.user_id = auth.uid() or public.is_superadmin())
    )
  )
  with check (
    exists (
      select 1 from public.bulk_jobs j
       where j.id = job_id and (j.user_id = auth.uid() or public.is_superadmin())
    )
  );


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select table_name, count(*) as columns
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('style_presets', 'project_versions', 'bulk_jobs', 'bulk_items')
 group by table_name
 order by table_name;
