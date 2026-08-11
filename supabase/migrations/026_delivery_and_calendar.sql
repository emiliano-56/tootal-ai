-- =====================================================================
--  026 — Delivering the work, and scheduling posts
-- =====================================================================
--  Two things a customer needs once they have made something and want to
--  sell it, neither of which existed.
--
--  1. DELIVERY LINKS.
--     The only way to give a buyer a file was to attach it to an email by
--     hand. A delivery link is a token that serves one file, expires, and
--     stops after a set number of downloads — so a link posted somewhere
--     public does not become free distribution of the thing being sold.
--
--  2. A POSTING SCHEDULE.
--     Autopilot posts what Autopilot generated, on Autopilot's own clock.
--     Nothing could take a comic the customer made by hand and put it out
--     on Friday morning. The connections, the publisher and the cron that
--     drives them all already exist; what was missing was a queue.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. DELIVERY LINKS
-- ---------------------------------------------------------------------
--  Deliberately separate from `shares`. A share is a public page meant to
--  be spread as widely as possible; a delivery is the opposite — one
--  buyer, a countdown, and a file that stops being available. Putting
--  both in one table would mean every query had to remember which kind it
--  was looking at.

create table if not exists public.deliveries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  tenant_id     uuid references public.tenants (id) on delete set null,

  -- The unguessable part of the URL.
  token         text not null unique,

  title         text not null default '',
  -- Shown to the buyer above the download button.
  message       text not null default '',

  -- What is being delivered. Stored as bucket + path rather than a URL so
  -- the file can live in a private bucket and be signed at download time —
  -- a public URL would defeat the expiry entirely.
  bucket        text not null,
  path          text not null,
  filename      text not null default 'download',
  size_bytes    bigint,

  -- Null means no limit. Both are limits in their own right: a link can
  -- expire before its downloads run out, or the other way round.
  expires_at    timestamptz,
  max_downloads integer,
  downloads     integer not null default 0,

  -- Who it was sent to, when it was sent. Null until it is emailed.
  sent_to       text,
  sent_at       timestamptz,

  revoked       boolean not null default false,

  created_at    timestamptz not null default now(),

  constraint deliveries_max_downloads check (max_downloads is null or max_downloads > 0)
);

create index if not exists deliveries_user_idx on public.deliveries (user_id, created_at desc);
create index if not exists deliveries_token_idx on public.deliveries (token);

-- Every time a link was opened, so "did they get it" has an answer.
create table if not exists public.delivery_downloads (
  id           bigserial primary key,
  delivery_id  uuid not null references public.deliveries (id) on delete cascade,
  -- Truncated to a /24 before it is stored: enough to spot a link being
  -- passed around, not enough to be a record of where someone lives.
  ip_prefix    text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists delivery_downloads_idx
  on public.delivery_downloads (delivery_id, created_at desc);


-- ---------------------------------------------------------------------
--  2. THE POSTING QUEUE
-- ---------------------------------------------------------------------

create table if not exists public.scheduled_posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  tenant_id      uuid references public.tenants (id) on delete set null,

  -- What to say, and what to show.
  caption        text not null default '',
  hashtags       text[] not null default '{}',
  image_url      text,
  link_url       text,

  -- Where the picture came from, so the calendar can show a thumbnail and
  -- link back to the thing being promoted.
  library_item_id uuid,

  -- Which connected accounts to post to.
  connection_ids uuid[] not null default '{}',

  -- When. Stored in UTC; the timezone is kept so the calendar can show the
  -- customer the hour they actually chose rather than a converted one.
  scheduled_for  timestamptz not null,
  timezone       text not null default 'UTC',

  status         text not null default 'scheduled',
  attempts       integer not null default 0,
  posted_at      timestamptz,
  error          text,
  -- Per-platform outcome, so one network failing does not hide four that
  -- worked.
  results        jsonb not null default '[]'::jsonb,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint scheduled_posts_status
    check (status in ('scheduled', 'posting', 'posted', 'failed', 'cancelled'))
);

-- The scheduler's query: what is due, oldest first.
create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts (status, scheduled_for)
  where status = 'scheduled';

create index if not exists scheduled_posts_user_idx
  on public.scheduled_posts (user_id, scheduled_for desc);


-- ---------------------------------------------------------------------
--  3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
--  `deliveries` is owner-only for reading. The buyer never queries this
--  table — they hit a route that looks the token up with the service role,
--  checks the expiry itself, and signs a URL. Letting anonymous callers
--  select from here would hand out every token in it.

alter table public.deliveries        enable row level security;
alter table public.delivery_downloads enable row level security;
alter table public.scheduled_posts   enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('deliveries', 'delivery_downloads', 'scheduled_posts')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy deliveries_own on public.deliveries
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());

create policy delivery_downloads_own on public.delivery_downloads
  for select
  using (
    exists (
      select 1 from public.deliveries d
       where d.id = delivery_id and (d.user_id = auth.uid() or public.is_superadmin())
    )
  );

create policy scheduled_posts_own on public.scheduled_posts
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());


-- ---------------------------------------------------------------------
--  4. A PRIVATE BUCKET FOR DELIVERED FILES
-- ---------------------------------------------------------------------
--  Private on purpose, and this is the whole point of the feature: a
--  public URL cannot expire, cannot be counted and cannot be revoked. The
--  download route signs a short-lived URL after it has checked the link.

insert into storage.buckets (id, name, public)
values ('deliveries', 'deliveries', false)
on conflict (id) do update set public = false;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'deliveries_%'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- Only the owner may put files in, and only under their own id. Reads go
-- through signed URLs issued by the server, so there is no read policy.
create policy deliveries_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deliveries'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy deliveries_owner_manage on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'deliveries'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select table_name, count(*) as columns
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('deliveries', 'delivery_downloads', 'scheduled_posts')
 group by table_name
 order by table_name;

select id, public from storage.buckets where id = 'deliveries';
