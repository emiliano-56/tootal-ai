-- =====================================================================
--  025 — Character Studio
-- =====================================================================
--  The single loudest complaint about AI comics: the character changes
--  between panels, and changes completely between books. Today the only
--  defence is a written description repeated into every image prompt,
--  which drifts because words are not a face.
--
--  The generation backend turns out to accept `image_urls` on all three
--  image endpoints, and it honours them properly — measured against the
--  live API, a reference photo came back redrawn in the requested style
--  with the subject, markings and pose intact. So a character can be
--  pinned to an actual picture rather than to a paragraph about one.
--
--  That is what this table stores: a name, the written appearance (still
--  useful — it goes in the prompt text), and a reference image that gets
--  passed to every panel the character appears in.
--
--  Two things this deliberately does NOT do:
--
--    * Store the backend's returned URL. Those are ephemeral —
--      `img.theapi.app/ephemeral/...` — and a character whose reference
--      expires is worse than one with no reference, because it fails
--      silently weeks later. The image is copied into storage first and
--      only the storage path is kept.
--
--    * Reuse `autopilot_campaigns.series_bible`. That is a snapshot of one
--      series' cast, owned by the campaign and rewritten every run. A
--      character here belongs to the account and outlives any one project.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. THE CHARACTERS
-- ---------------------------------------------------------------------

create table if not exists public.characters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  tenant_id     uuid references public.tenants (id) on delete set null,

  name          text not null,
  -- What the reader is told. Short.
  role          text not null default '',
  -- What the image model is told. Long, specific, and repeated verbatim
  -- into every prompt — "never write 'the same character as before'" is a
  -- rule the prompts already carry and this is what makes it possible.
  appearance    text not null default '',
  personality   text not null default '',

  -- The reference the backend is handed. `image_path` is the copy we own;
  -- `image_url` is its public URL, cached so every prompt build does not
  -- have to ask storage to sign one.
  image_path    text,
  image_url     text,

  -- Where the reference came from, so the UI can say so and so a photo
  -- upload can be treated differently from a generated turnaround.
  source        text not null default 'generated',

  -- Art style the reference was drawn in. Mixing a Pixar character into a
  -- manga page is a legitimate thing to want and a surprising thing to get
  -- by accident, so it is recorded and shown.
  art_style     text not null default '',

  archived      boolean not null default false,
  times_used    integer not null default 0,
  last_used_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint characters_source check (source in ('generated', 'uploaded', 'extracted')),
  constraint characters_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists characters_user_idx
  on public.characters (user_id, archived, created_at desc);


-- ---------------------------------------------------------------------
--  2. EXTRA POSES AND EXPRESSIONS
-- ---------------------------------------------------------------------
--  A model sheet: the same character from a few angles and in a few
--  moods. More than one reference image measurably steadies a face, and
--  it is also the deliverable customers ask for by name ("character
--  sheet"). Kept in its own table so a character can have none, or nine.

create table if not exists public.character_poses (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references public.characters (id) on delete cascade,

  label         text not null default '',
  image_path    text not null,
  image_url     text not null,
  -- Whether this one is sent along with the main reference by default.
  primary_ref   boolean not null default false,

  created_at    timestamptz not null default now()
);

create index if not exists character_poses_idx
  on public.character_poses (character_id, created_at);


-- ---------------------------------------------------------------------
--  3. WHICH CHARACTERS A PROJECT USED
-- ---------------------------------------------------------------------
--  So "where has this character appeared" is answerable, and so deleting
--  a character can warn about the books that used it.

create table if not exists public.character_appearances (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references public.characters (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,

  -- Free-form: a library item, a project, an autopilot run. Not a foreign
  -- key because it spans three tables and a dangling reference here is
  -- harmless — this is a history note, not a rule.
  subject_kind  text not null default 'library_item',
  subject_id    uuid,
  title         text not null default '',

  created_at    timestamptz not null default now()
);

create index if not exists character_appearances_idx
  on public.character_appearances (character_id, created_at desc);


-- ---------------------------------------------------------------------
--  4. STORAGE
-- ---------------------------------------------------------------------
--  Public, because the generation backend fetches the reference over the
--  open internet — a signed URL would expire mid-job and a private bucket
--  cannot be read by it at all. Nothing sensitive lives here: these are
--  drawings the customer intends to publish.

insert into storage.buckets (id, name, public)
values ('characters', 'characters', true)
on conflict (id) do update set public = true;


-- ---------------------------------------------------------------------
--  5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.characters            enable row level security;
alter table public.character_poses       enable row level security;
alter table public.character_appearances enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('characters', 'character_poses', 'character_appearances')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy characters_own on public.characters
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());

-- Ownership follows the character, so the rule lives in one place.
create policy character_poses_own on public.character_poses
  for all
  using (
    exists (
      select 1 from public.characters c
       where c.id = character_id and (c.user_id = auth.uid() or public.is_superadmin())
    )
  )
  with check (
    exists (
      select 1 from public.characters c
       where c.id = character_id and (c.user_id = auth.uid() or public.is_superadmin())
    )
  );

create policy character_appearances_own on public.character_appearances
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());


-- ---------------------------------------------------------------------
--  6. STORAGE POLICIES
-- ---------------------------------------------------------------------
--  Anyone may read (the backend has to). Only the owner may write, and
--  only inside a folder named after their own id.

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'characters_%'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy characters_public_read on storage.objects
  for select using (bucket_id = 'characters');

create policy characters_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'characters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy characters_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'characters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy characters_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'characters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select table_name, count(*) as columns
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('characters', 'character_poses', 'character_appearances')
 group by table_name
 order by table_name;

select id, public from storage.buckets where id = 'characters';
