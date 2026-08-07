-- =====================================================================
--  013 — OTO 2 (Done For You) and OTO 3 (Autopilot)
-- =====================================================================
--  Until now OTO 2 and OTO 3 re-granted tools that Front End already
--  had, which made them hard to sell: the customer saw nothing new.
--  Each tier now unlocks a screen of its own.
--
--  OTO 2 — Done For You
--    Ten ready-made kids content businesses. A niche is a folder of
--    assets: the website copy, the storybooks, the video scripts, the
--    rhymes, the printables, the tutor and the blog posts, together with
--    the marketplace listings that sell them.
--
--  OTO 3 — Autopilot
--    A campaign describes what to make and how often. A scheduler wakes
--    up, picks the next idea and produces the episode. Runs are rows so
--    a failure can be seen and replayed rather than silently skipped.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. DFY — NICHES
-- ---------------------------------------------------------------------

create table if not exists public.dfy_niches (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  tagline     text not null,
  description text not null,
  audience    text not null,
  emoji       text not null default '📚',
  -- Two hex colours; the card draws a gradient between them.
  colour_from text not null default '#6366f1',
  colour_to   text not null default '#8b5cf6',
  keywords    text[] not null default '{}',
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists dfy_niches_order_idx on public.dfy_niches (sort_order);


-- ---------------------------------------------------------------------
--  2. DFY — ASSETS
-- ---------------------------------------------------------------------
--  `body` holds the asset itself: the HTML for a website, the script for
--  a video, the lyrics for a rhyme. `prompt` is what to hand the matching
--  generator, so an asset can be turned into finished artwork inside the
--  product rather than exported and finished elsewhere.

create table if not exists public.dfy_assets (
  id          uuid primary key default gen_random_uuid(),
  niche_id    uuid not null references public.dfy_niches (id) on delete cascade,
  kind        text not null,
  title       text not null,
  summary     text not null default '',
  body        text not null default '',
  prompt      text,
  -- Which tool turns `prompt` into a finished asset: comic, video, coloring…
  tool        text,
  meta        jsonb not null default '{}'::jsonb,
  marketplaces text[] not null default '{}',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint dfy_assets_kind check (kind in (
    'website', 'storybook', 'video', 'rhyme', 'printable', 'tutor', 'blog', 'listing'
  ))
);

create index if not exists dfy_assets_niche_idx on public.dfy_assets (niche_id, sort_order);
create index if not exists dfy_assets_kind_idx  on public.dfy_assets (kind);


-- ---------------------------------------------------------------------
--  3. AUTOPILOT — CAMPAIGNS
-- ---------------------------------------------------------------------
--  `series_bible` keeps the characters and world consistent between
--  episodes. Without it every run invents a new cast and the channel
--  reads as noise rather than a series.

create table if not exists public.autopilot_campaigns (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  tenant_id         uuid references public.tenants (id) on delete set null,

  name              text not null,
  niche             text not null,
  audience          text not null default 'Children aged 4-8',
  art_style         text not null default 'Pixar 3D',
  tone              text not null default 'Warm and playful',

  episodes_per_run  integer not null default 1,
  frequency         text not null default 'daily',
  publish_hour      integer not null default 9,
  timezone          text not null default 'UTC',

  platforms         text[] not null default '{}',
  webhook_url       text,
  deliver_email     text,

  status            text not null default 'active',
  series_bible      jsonb not null default '{}'::jsonb,

  next_run_at       timestamptz,
  last_run_at       timestamptz,
  total_runs        integer not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint autopilot_frequency check (frequency in ('daily', 'every_2_days', 'weekdays', 'weekly')),
  constraint autopilot_status    check (status in ('active', 'paused', 'draft')),
  constraint autopilot_hour      check (publish_hour between 0 and 23),
  constraint autopilot_episodes  check (episodes_per_run between 1 and 5)
);

create index if not exists autopilot_campaigns_user_idx on public.autopilot_campaigns (user_id);

-- The scheduler's only query: what is due. Partial, so paused campaigns
-- never enter the index at all.
create index if not exists autopilot_due_idx
  on public.autopilot_campaigns (next_run_at)
  where status = 'active';


-- ---------------------------------------------------------------------
--  4. AUTOPILOT — IDEAS
-- ---------------------------------------------------------------------

create table if not exists public.autopilot_ideas (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.autopilot_campaigns (id) on delete cascade,
  title       text not null,
  hook        text not null default '',
  angle       text,
  score       integer not null default 50,
  status      text not null default 'new',
  created_at  timestamptz not null default now(),

  constraint autopilot_idea_status check (status in ('new', 'used', 'dismissed')),
  constraint autopilot_idea_score  check (score between 0 and 100)
);

create index if not exists autopilot_ideas_campaign_idx
  on public.autopilot_ideas (campaign_id, status, score desc);


-- ---------------------------------------------------------------------
--  5. AUTOPILOT — RUNS
-- ---------------------------------------------------------------------

create table if not exists public.autopilot_runs (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.autopilot_campaigns (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  idea_id       uuid references public.autopilot_ideas (id) on delete set null,
  project_id    uuid references public.projects (id) on delete set null,

  scheduled_for timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,

  status        text not null default 'queued',
  title         text,
  script        jsonb,
  delivered_to  text[] not null default '{}',
  error         text,

  created_at    timestamptz not null default now(),

  constraint autopilot_run_status check (status in ('queued', 'running', 'done', 'failed', 'skipped'))
);

create index if not exists autopilot_runs_campaign_idx
  on public.autopilot_runs (campaign_id, created_at desc);

create index if not exists autopilot_runs_user_idx
  on public.autopilot_runs (user_id, created_at desc);


-- ---------------------------------------------------------------------
--  6. TOUCH TRIGGERS
-- ---------------------------------------------------------------------

do $$
declare
  target text;
begin
  foreach target in array array['dfy_niches', 'dfy_assets', 'autopilot_campaigns']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', target, target);
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.touch_updated_at()',
      target, target
    );
  end loop;
end $$;


-- ---------------------------------------------------------------------
--  7. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.dfy_niches         enable row level security;
alter table public.dfy_assets         enable row level security;
alter table public.autopilot_campaigns enable row level security;
alter table public.autopilot_ideas     enable row level security;
alter table public.autopilot_runs      enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('dfy_niches', 'dfy_assets', 'autopilot_campaigns',
                         'autopilot_ideas', 'autopilot_runs')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- The library is the same for everybody who bought OTO 2. Reading it is
-- open to any signed-in account; the tier check is what puts the screen
-- in front of them, and the content is marketing copy, not private data.
create policy dfy_niches_read on public.dfy_niches
  for select using (auth.uid() is not null and active);

create policy dfy_assets_read on public.dfy_assets
  for select using (auth.uid() is not null);

create policy dfy_niches_write on public.dfy_niches
  for all using (public.is_superadmin()) with check (public.is_superadmin());

create policy dfy_assets_write on public.dfy_assets
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- Campaigns are the customer's own work. A tenant admin can see what
-- their users are running; nobody else can.
create policy autopilot_campaigns_own on public.autopilot_campaigns
  for all
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant())
  )
  with check (user_id = auth.uid() or public.is_superadmin());

create policy autopilot_ideas_own on public.autopilot_ideas
  for all
  using (
    campaign_id in (select id from public.autopilot_campaigns where user_id = auth.uid())
    or public.is_superadmin()
  )
  with check (
    campaign_id in (select id from public.autopilot_campaigns where user_id = auth.uid())
    or public.is_superadmin()
  );

create policy autopilot_runs_own on public.autopilot_runs
  for all
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (
      public.is_tenant_admin()
      and user_id in (select id from public.profiles where tenant_id = public.current_tenant())
    )
  )
  with check (user_id = auth.uid() or public.is_superadmin());


-- ---------------------------------------------------------------------
--  8. WHAT EACH TIER UNLOCKS
-- ---------------------------------------------------------------------
--  Front End through OTO 1 already cover every tool. These two features
--  are what OTO 2 and OTO 3 add, and they are the reason to buy either.
--
--  Neither is metered: the DFY library is a library, and Autopilot is a
--  monthly subscription. The comics Autopilot produces are counted
--  against the comic allowance, which OTO 1 has already made unlimited
--  for anyone far enough up the chain to own OTO 3.

insert into public.plan_features (plan_id, feature, monthly_limit)
select p.id, 'dfy-business', null
  from public.plans p
 where p.code = 'oto2'
on conflict (plan_id, feature) do update set monthly_limit = null;

insert into public.plan_features (plan_id, feature, monthly_limit)
select p.id, 'autopilot', null
  from public.plans p
 where p.code = 'oto3'
on conflict (plan_id, feature) do update set monthly_limit = null;

update public.plans
   set name        = 'Done For You',
       description = 'Ten ready-made kids content businesses — websites, storybooks, videos, rhymes, printables, tutors and blog content, with commercial rights.'
 where code = 'oto2';

update public.plans
   set name        = 'Autopilot',
       description = 'Hands-free comic production. AI finds the ideas, writes the episodes and publishes them on your calendar.'
 where code = 'oto3';


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select p.code, p.name, f.feature, f.monthly_limit
  from public.plans p
  left join public.plan_features f on f.plan_id = p.id
 where p.code in ('oto2', 'oto3')
 order by p.sort_order, f.feature;
