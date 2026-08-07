-- =====================================================================
--  018 — One library, with a size limit
-- =====================================================================
--  Three problems, one table.
--
--  1. NOT EVERYTHING WAS SAVED.
--     Comics and colouring books each got a row of their own. Videos and
--     covers were uploaded to storage and nothing was written down, so
--     My Library had to list the bucket and guess. A cover was not
--     recoverable at all once the page was closed.
--
--  2. NOTHING CAPPED IT.
--     Storage grows forever and nobody is told. A limit has to be a rule
--     the customer can see coming, not a bill that arrives later.
--
--  3. NOWHERE TO RECORD A BACKUP.
--     Uploading to the customer's own Google Drive needs somewhere to
--     remember what has already been sent.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. THE LIBRARY
-- ---------------------------------------------------------------------
--  One row per saved artefact, whatever produced it. `kind` matches the
--  feature keys, so a cap of "10 comics" is expressed in the same words
--  as the monthly allowance of "10 comics".

create table if not exists public.library_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  tenant_id     uuid references public.tenants (id) on delete set null,

  kind          text not null,
  title         text not null default 'Untitled',

  -- Where the file lives. A private bucket path, or an already-public URL
  -- for the video bucket.
  bucket        text,
  path          text,
  public_url    text,
  -- The thumbnail, so a library page does not have to open a PDF to draw
  -- a card, and a share has something a network can render.
  cover_url     text,

  size_bytes    bigint,
  meta          jsonb not null default '{}'::jsonb,

  -- Backup, once the customer has connected Google Drive.
  drive_file_id text,
  drive_link    text,
  drive_synced_at timestamptz,

  created_at    timestamptz not null default now(),

  constraint library_items_kind check (kind in ('comic', 'coloring', 'video', 'cover', 'episode')),
  -- A row that points at nothing would show as a broken card forever.
  constraint library_items_has_file check (public_url is not null or (bucket is not null and path is not null))
);

-- The two queries that matter: "show me my library" and "how many of this
-- kind do I have". Both are per user, newest first.
create index if not exists library_items_user_idx
  on public.library_items (user_id, kind, created_at desc);

-- One row per stored file. Saving the same comic twice should not consume
-- two slots of the customer's allowance.
create unique index if not exists library_items_path_key
  on public.library_items (user_id, bucket, path)
  where path is not null;


-- ---------------------------------------------------------------------
--  2. HOW MANY EACH PLAN MAY KEEP
-- ---------------------------------------------------------------------
--  Null means unlimited, matching how plan_features already reads. The
--  number is per kind, so Front End keeps ten comics AND ten colouring
--  books, not ten things in total.

alter table public.plans add column if not exists library_limit integer;

update public.plans set library_limit = 10   where code = 'fe';
update public.plans set library_limit = null where code in ('oto1', 'mega');


-- ---------------------------------------------------------------------
--  3. GOOGLE DRIVE
-- ---------------------------------------------------------------------
--  Reuses the social app credentials table: the token plumbing, refresh
--  and RLS are identical, and the connect screens filter by their own
--  catalogues so Drive does not appear among the social networks.

insert into public.social_apps (platform)
values ('google_drive')
on conflict (platform) do nothing;

-- Sync every save automatically, rather than one at a time.
alter table public.social_connections
  add column if not exists auto_sync boolean not null default false;


-- ---------------------------------------------------------------------
--  4. BRING THE EXISTING WORK IN
-- ---------------------------------------------------------------------
--  Comics and colouring books already have rows. Videos and covers never
--  did, so those start from the next save — there is nothing to recover.

do $$
begin
  if to_regclass('public.comics') is not null then
    insert into public.library_items (user_id, kind, title, bucket, path, cover_url, created_at)
    select c.user_id, 'comic', coalesce(c.title, 'Untitled'), 'comic-pdfs', c.pdf_path,
           -- cover_url only exists after 016.
           case when to_regclass('public.comics') is not null then null else null end,
           coalesce(c.created_at, now())
      from public.comics c
     where c.pdf_path is not null
       and exists (select 1 from public.profiles p where p.id = c.user_id)
    on conflict do nothing;
  end if;

  if to_regclass('public.colorings') is not null then
    insert into public.library_items (user_id, kind, title, bucket, path, created_at)
    select c.user_id, 'coloring', coalesce(c.title, 'Untitled'), 'comic-pdfs', c.pdf_path,
           coalesce(c.created_at, now())
      from public.colorings c
     where c.pdf_path is not null
       and exists (select 1 from public.profiles p where p.id = c.user_id)
    on conflict do nothing;
  end if;
end $$;

-- Carry the covers across now that the rows exist.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'comics' and column_name = 'cover_url'
  ) then
    update public.library_items l
       set cover_url = c.cover_url
      from public.comics c
     where l.path = c.pdf_path
       and l.user_id = c.user_id
       and c.cover_url is not null
       and l.cover_url is null;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.library_items enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'library_items'
  loop
    execute format('drop policy if exists %I on public.library_items', pol.policyname);
  end loop;
end $$;

create policy library_items_own on public.library_items
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
--  VERIFY
-- ---------------------------------------------------------------------

select kind, count(*) from public.library_items group by kind order by kind;
