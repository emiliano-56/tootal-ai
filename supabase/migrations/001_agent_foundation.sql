-- =====================================================================
--  ComicTale AI — Agent Foundation
--  Run once in: Supabase Dashboard → SQL Editor → New query → Run
--
--  Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE.
--  Existing tables (profiles, comics, colorings, book_covers, chats)
--  are NOT touched.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helper: keep updated_at fresh
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 1. projects — one idea produces a whole package (AI Business Agent)
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  idea        text,
  niche       text,
  audience    text,
  art_style   text,
  status      text not null default 'draft'
              check (status in ('draft','running','complete','failed')),
  cover_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_user_idx on public.projects (user_id, created_at desc);


-- ---------------------------------------------------------------------
-- 2. agent_jobs — every agent run, so long tasks survive a page refresh
-- ---------------------------------------------------------------------
create table if not exists public.agent_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete cascade,
  agent         text not null,   -- 'story_to_comic' | 'marketing' | 'landing_page' | ...
  status        text not null default 'queued'
                check (status in ('queued','running','succeeded','failed','cancelled')),
  progress      int  not null default 0 check (progress between 0 and 100),
  current_step  text,
  total_steps   int  not null default 1,
  input         jsonb not null default '{}'::jsonb,
  output        jsonb,
  error         text,
  credits_used  int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists agent_jobs_user_idx    on public.agent_jobs (user_id, created_at desc);
create index if not exists agent_jobs_project_idx on public.agent_jobs (project_id);
create index if not exists agent_jobs_status_idx  on public.agent_jobs (status);

drop trigger if exists agent_jobs_updated_at on public.agent_jobs;
create trigger agent_jobs_updated_at
  before update on public.agent_jobs
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 3. comic_pages / comic_panels
--    Today only a PDF path is stored, so a finished comic can never be
--    re-edited or re-used. These keep the structured data.
-- ---------------------------------------------------------------------
create table if not exists public.comic_pages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  comic_id    uuid,
  page_number int  not null,
  scene_title text,
  scene_text  text,
  image_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists comic_pages_project_idx on public.comic_pages (project_id, page_number);

create table if not exists public.comic_panels (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  page_id       uuid not null references public.comic_pages(id) on delete cascade,
  panel_number  int  not null,
  image_prompt  text,
  image_url     text,
  -- Dialogue + bubble geometry, e.g.
  -- [{ "speaker":"Robot", "text":"Stand back!", "x":0.2,"y":0.1,"tail":"bottom-left" }]
  dialogues     jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists comic_panels_page_idx on public.comic_panels (page_id, panel_number);


-- ---------------------------------------------------------------------
-- 4. landing_pages + custom_domains
-- ---------------------------------------------------------------------
create table if not exists public.landing_pages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  slug        text not null unique,
  title       text not null,
  -- Structured section content so the page stays editable after generation
  config      jsonb not null default '{}'::jsonb,
  html        text,
  published   boolean not null default false,
  views       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists landing_pages_user_idx on public.landing_pages (user_id, created_at desc);

drop trigger if exists landing_pages_updated_at on public.landing_pages;
create trigger landing_pages_updated_at
  before update on public.landing_pages
  for each row execute function public.set_updated_at();

create table if not exists public.custom_domains (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  landing_page_id  uuid references public.landing_pages(id) on delete cascade,
  domain           text not null unique,
  -- User adds a TXT record containing this token to prove ownership.
  -- Derived from gen_random_uuid() so no pgcrypto extension is required.
  verification_token text not null
    default replace(gen_random_uuid()::text, '-', ''),
  status           text not null default 'pending'
                   check (status in ('pending','verifying','active','failed')),
  last_checked_at  timestamptz,
  verified_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists custom_domains_user_idx on public.custom_domains (user_id);


-- ---------------------------------------------------------------------
-- 5. marketing_assets — ads, emails, captions, SEO copy
-- ---------------------------------------------------------------------
create table if not exists public.marketing_assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  kind        text not null,   -- 'facebook_ad' | 'email' | 'seo_title' | 'instagram' | ...
  title       text,
  content     text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists marketing_assets_project_idx on public.marketing_assets (project_id, kind);


-- ---------------------------------------------------------------------
-- 6. prompt_library — shared presets + a user's own saved prompts
--    user_id NULL  => built-in prompt, visible to everyone
-- ---------------------------------------------------------------------
create table if not exists public.prompt_library (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  category    text not null,
  title       text not null,
  prompt      text not null,
  is_builtin  boolean not null default false,
  uses        int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists prompt_library_category_idx on public.prompt_library (category);
create index if not exists prompt_library_user_idx     on public.prompt_library (user_id);


-- =====================================================================
--  ROW LEVEL SECURITY
--  Without this, any logged-in user could read everyone else's rows.
-- =====================================================================
alter table public.projects         enable row level security;
alter table public.agent_jobs       enable row level security;
alter table public.comic_pages      enable row level security;
alter table public.comic_panels     enable row level security;
alter table public.landing_pages    enable row level security;
alter table public.custom_domains   enable row level security;
alter table public.marketing_assets enable row level security;
alter table public.prompt_library   enable row level security;

-- Owner-only access for the user-scoped tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects','agent_jobs','comic_pages','comic_panels',
    'landing_pages','custom_domains','marketing_assets'
  ]
  loop
    execute format('drop policy if exists "%1$s_owner" on public.%1$I', t);
    execute format(
      'create policy "%1$s_owner" on public.%1$I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Prompt library: built-ins readable by all, personal prompts owner-only
drop policy if exists "prompt_library_read" on public.prompt_library;
create policy "prompt_library_read" on public.prompt_library
  for select
  using (is_builtin = true or auth.uid() = user_id);

drop policy if exists "prompt_library_write" on public.prompt_library;
create policy "prompt_library_write" on public.prompt_library
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Published landing pages must be readable by anonymous visitors
drop policy if exists "landing_pages_public_read" on public.landing_pages;
create policy "landing_pages_public_read" on public.landing_pages
  for select
  using (published = true);


-- =====================================================================
--  SEED: built-in prompt library
-- =====================================================================
-- `is_builtin` is supplied here rather than in the VALUES list, so the row
-- literals and the column aliases below stay the same width (3).
insert into public.prompt_library (category, title, prompt, is_builtin)
select seed.category, seed.title, seed.prompt, true
from (values
  ('Superhero','City Rescue','A masked superhero catching a falling car above a busy city street at sunset, cape flowing, dramatic low angle'),
  ('Superhero','Origin Moment','A teenager discovering their powers for the first time in a rain-soaked alley, electricity arcing between their hands'),
  ('Horror','Abandoned Hospital','An empty hospital corridor at night lit only by a flickering bulb, a silhouette at the far end, heavy fog'),
  ('Horror','The Watcher','A child looking out a rainy window while a tall shadow stands motionless in the garden behind them'),
  ('Anime','Rooftop Duel','Two anime swordsmen facing each other on a rooftop under a full moon, cherry blossoms in the wind'),
  ('Anime','School Festival','A lively anime school festival with lanterns, food stalls and students in yukata at dusk'),
  ('Manga','Training Arc','Black and white manga panel of a young fighter training alone on a mountain in heavy rain, speed lines'),
  ('Manga','Rival Meeting','Two rivals meeting in a quiet dojo, intense eye contact, dramatic screentone shading'),
  ('Kids','Dinosaur Friends','A friendly cartoon dinosaur teaching happy children about volcanoes in a bright prehistoric jungle'),
  ('Kids','Space Puppy','A cute puppy in a tiny astronaut suit floating past a colourful planet, big smile, playful stars'),
  ('Romance','Rainy Umbrella','Two people sharing one umbrella on a quiet city street, warm streetlights reflecting on wet pavement'),
  ('Romance','Letter on the Pier','A young woman reading a handwritten letter at the end of a wooden pier at golden hour'),
  ('Fantasy','Dragon Valley','A young rider standing before an enormous sleeping dragon in a misty green valley at dawn'),
  ('Fantasy','Wizard Library','An ancient library with floating candles and endless spiral staircases, a wizard reading a glowing book'),
  ('Business','Startup Pitch','A confident founder presenting to investors in a modern glass boardroom, city skyline behind'),
  ('Business','Growth Journey','A stylised illustration of a person climbing a rising bar chart towards a glowing goal'),
  ('Motivation','Summit Sunrise','A lone climber reaching a mountain summit as the sun rises, arms raised in triumph'),
  ('Motivation','Early Grind','A person studying at a desk before dawn, warm lamp light, city still dark outside the window'),
  ('History','Ancient Marketplace','A bustling ancient Roman marketplace with traders, togas and stone architecture at midday'),
  ('History','Explorer Ship','A wooden sailing ship battling tall waves under a stormy sky, crew holding the rigging'),
  ('Sci-Fi','Neon Megacity','A rain-soaked neon cyberpunk megacity with flying cars and holographic billboards at night'),
  ('Sci-Fi','First Contact','An astronaut standing before a glowing alien monolith on a red desert planet, two moons overhead')
) as seed(category, title, prompt)
where not exists (
  select 1
  from public.prompt_library existing
  where existing.is_builtin = true
    and existing.title = seed.title
);

-- =====================================================================
--  Done.
-- =====================================================================
