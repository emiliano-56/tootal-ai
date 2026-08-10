-- =====================================================================
--  020 — Languages, audio, and a real shot list
-- =====================================================================
--  Three additions that all land on the same feature in the end.
--
--  1. LANGUAGES.
--     Everything generated is English because nothing ever asks. The
--     model can write in any of these already — it just needs telling,
--     and the tiers need to say who may ask for what.
--
--  2. AUDIO.
--     Copyright-free music, searched from libraries that publish an API,
--     plus narration. Attribution is stored with the track: most Creative
--     Commons licences require crediting the artist, and a customer who
--     publishes without it is the one who gets the complaint.
--
--  3. THE SHOT LIST.
--     Comic-to-Video asks the customer to type a prompt per panel and
--     pick "zoom in" from a dropdown. The AI never reads the comic. A
--     stored shot list is what lets it direct instead.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. WHICH LANGUAGES A TIER UNLOCKS
-- ---------------------------------------------------------------------
--  An empty array means "every language", which is what the upper tiers
--  and any plan the owner adds later will want. Front End gets a starter
--  set; all of it is editable under Superadmin → Plans.

alter table public.plans add column if not exists languages text[] not null default '{}';

update public.plans
   set languages = '{en,es,fr,pt,hi}'
 where code = 'fe' and languages = '{}';

-- Everything above Front End lifts the restriction.
update public.plans
   set languages = '{}'
 where code in ('oto1', 'oto2', 'oto3', 'mega');


-- ---------------------------------------------------------------------
--  2. AUDIO PROVIDERS
-- ---------------------------------------------------------------------
--  Openverse needs no key at all, which is why it is the default and is
--  enabled from the start. The others are better catalogues but want a
--  key, so they stay off until the platform owner adds one.

create table if not exists public.audio_providers (
  provider    text primary key,
  label       text not null,
  api_key     text,
  enabled     boolean not null default false,
  -- What the customer must do with a track from here, in their words.
  attribution text not null default 'Credit the artist as shown.',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.audio_providers (provider, label, enabled, attribution)
values
  ('openverse', 'Openverse (Creative Commons)', true,
   'Most tracks are CC BY or CC BY-SA — credit the artist and link the licence.'),
  ('jamendo', 'Jamendo', false,
   'Free for non-commercial use with credit. A commercial licence must be bought from Jamendo.'),
  ('pixabay', 'Pixabay', false,
   'Pixabay licence — free for commercial use, no credit required.')
on conflict (provider) do update set
  label       = excluded.label,
  attribution = excluded.attribution;


-- ---------------------------------------------------------------------
--  3. TRACKS A CUSTOMER HAS CHOSEN
-- ---------------------------------------------------------------------
--  Kept rather than re-searched: a licence and a credit line have to
--  survive the search results disappearing, or a published video ends up
--  with no way to prove where its music came from.

create table if not exists public.audio_tracks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,

  provider     text not null,
  external_id  text,
  title        text not null,
  artist       text not null default '',
  url          text not null,
  duration     integer,

  licence      text not null default '',
  licence_url  text,
  -- The exact line to put in a video description.
  credit       text not null default '',

  created_at   timestamptz not null default now(),

  unique (user_id, provider, external_id)
);

create index if not exists audio_tracks_user_idx on public.audio_tracks (user_id, created_at desc);


-- ---------------------------------------------------------------------
--  4. WHAT A VIDEO WAS MADE FROM
-- ---------------------------------------------------------------------
--  The shot list the AI wrote, the language it narrated in and the track
--  behind it. Stored on the library row so a finished video can still
--  answer "where did this music come from" months later.

alter table public.library_items add column if not exists language   text;
alter table public.library_items add column if not exists shot_list  jsonb;
alter table public.library_items add column if not exists audio_credit text;


-- ---------------------------------------------------------------------
--  5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.audio_providers enable row level security;
alter table public.audio_tracks    enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname from pg_policies
     where schemaname = 'public' and tablename in ('audio_providers', 'audio_tracks')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Every signed-in account may see which providers exist; only the owner
-- edits them, and the key is never selected by a client query.
create policy audio_providers_read on public.audio_providers
  for select using (auth.uid() is not null);

create policy audio_providers_write on public.audio_providers
  for all using (public.is_superadmin()) with check (public.is_superadmin());

create policy audio_tracks_own on public.audio_tracks
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select code, name, languages from public.plans order by sort_order;
