-- =====================================================================
--  015 — Share links and social accounts
-- =====================================================================
--  Two things, both needed before anything can be posted anywhere.
--
--  1. SHARE LINKS.
--     Comics live in a private bucket behind signed URLs that expire in an
--     hour, which is useless on Facebook. A share link is a permanent,
--     public address for one item; the page behind it signs a fresh URL
--     on every request, so the file itself stays private and the link
--     never rots. It is also the only way link previews work — every
--     network fetches the page and reads its Open Graph tags.
--
--  2. SOCIAL ACCOUNTS.
--     `social_apps` holds the developer app credentials, which belong to
--     the platform owner and are entered once. `social_connections`
--     holds each customer's own tokens, obtained through OAuth or pasted
--     in. Autopilot reads the second to post on their behalf.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. SHARE LINKS
-- ---------------------------------------------------------------------

create table if not exists public.shared_items (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  tenant_id   uuid references public.tenants (id) on delete set null,

  kind        text not null,
  title       text not null,
  caption     text not null default '',
  hashtags    text[] not null default '{}',

  -- Either a file in storage, signed fresh on each view…
  bucket      text,
  path        text,
  -- …or something already public, like a rendered video…
  public_url  text,
  -- …or text, for an Autopilot episode whose panels have not been drawn yet.
  -- Something has to be at the other end of the link, and the written episode
  -- is a real thing to read.
  body        text,
  -- The still used for the link preview. Networks will not read a PDF.
  preview_url text,

  project_id  uuid references public.projects (id) on delete set null,
  views       integer not null default 0,
  revoked     boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint shared_items_kind check (kind in ('comic', 'video', 'cover', 'coloring', 'episode')),
  -- A share with nothing at all behind it would render an empty page.
  constraint shared_items_has_target check (
    public_url is not null
    or body is not null
    or (bucket is not null and path is not null)
  )
);

create index if not exists shared_items_user_idx on public.shared_items (user_id, created_at desc);


-- ---------------------------------------------------------------------
--  2. THE PLATFORM OWNER'S DEVELOPER APPS
-- ---------------------------------------------------------------------
--  One row per network. The secret never leaves the server: the console
--  shows only whether one is set.

create table if not exists public.social_apps (
  platform      text primary key,
  client_id     text,
  client_secret text,
  -- Reddit wants one, and Meta rejects an app that does not send it.
  extra         jsonb not null default '{}'::jsonb,
  enabled       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

insert into public.social_apps (platform)
values ('facebook'), ('instagram'), ('twitter'), ('linkedin'), ('reddit')
on conflict (platform) do nothing;


-- ---------------------------------------------------------------------
--  3. EACH CUSTOMER'S CONNECTED ACCOUNTS
-- ---------------------------------------------------------------------
--  `access_token` is a live credential. RLS keeps it inside the owning
--  account, and no API route ever returns it — the screens work from
--  `account_name` and `status` alone.

create table if not exists public.social_connections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  tenant_id      uuid references public.tenants (id) on delete set null,

  platform       text not null,
  -- The page, channel or handle posts actually land on.
  --
  -- NOT NULL with an empty default on purpose: it is part of the unique key
  -- below, and Postgres treats two NULLs as distinct. Left nullable, a
  -- platform that returned no account id would defeat the upsert and grow a
  -- fresh duplicate row on every reconnect.
  account_id     text not null default '',
  account_name   text not null default '',

  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,
  scopes         text[] not null default '{}',
  -- Subreddit, channel id, page id — whatever that platform needs at post time.
  settings       jsonb not null default '{}'::jsonb,

  status         text not null default 'active',
  last_error     text,
  last_posted_at timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint social_connections_status check (status in ('active', 'expired', 'error', 'revoked')),
  -- One account per platform per customer keeps "post to Telegram" unambiguous.
  unique (user_id, platform, account_id)
);

create index if not exists social_connections_user_idx
  on public.social_connections (user_id, platform);


-- ---------------------------------------------------------------------
--  4. WHAT WAS POSTED
-- ---------------------------------------------------------------------

create table if not exists public.social_posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid references public.social_connections (id) on delete set null,
  run_id        uuid references public.autopilot_runs (id) on delete set null,
  shared_id     uuid references public.shared_items (id) on delete set null,

  platform      text not null,
  status        text not null default 'pending',
  remote_id     text,
  remote_url    text,
  caption       text,
  error         text,

  created_at    timestamptz not null default now(),

  constraint social_posts_status check (status in ('pending', 'posted', 'failed', 'skipped'))
);

create index if not exists social_posts_user_idx on public.social_posts (user_id, created_at desc);
create index if not exists social_posts_run_idx  on public.social_posts (run_id);


-- ---------------------------------------------------------------------
--  5. AUTOPILOT PUBLISHES TO CONNECTIONS
-- ---------------------------------------------------------------------

alter table public.autopilot_campaigns
  add column if not exists connection_ids uuid[] not null default '{}';


-- ---------------------------------------------------------------------
--  6. TOUCH TRIGGERS
-- ---------------------------------------------------------------------

do $$
declare
  target text;
begin
  foreach target in array array['shared_items', 'social_apps', 'social_connections']
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

alter table public.shared_items       enable row level security;
alter table public.social_apps        enable row level security;
alter table public.social_connections enable row level security;
alter table public.social_posts       enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('shared_items', 'social_apps', 'social_connections', 'social_posts')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- A share link is public by design, but only the owner manages it. The
-- public page reads through the service role, not through this policy.
create policy shared_items_own on public.shared_items
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());

-- App credentials are the platform owner's alone.
create policy social_apps_superadmin on public.social_apps
  for all using (public.is_superadmin()) with check (public.is_superadmin());

create policy social_connections_own on public.social_connections
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());

create policy social_posts_own on public.social_posts
  for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select platform, enabled, client_id is not null as has_client_id
  from public.social_apps
 order by platform;
