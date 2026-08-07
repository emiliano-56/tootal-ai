-- =====================================================================
--  016 — Preview images
-- =====================================================================
--  Two gaps closed, both caused by the same missing thing: nowhere to put
--  a picture that the outside world is allowed to see.
--
--  1. A shared comic is a PDF. Handed to Facebook as og:image it draws a
--     broken card, so shares currently fall back to a plain text one. What
--     is needed is a PNG of the first page.
--
--  2. Autopilot writes an episode but nothing draws it, because panels are
--     rendered in the browser and a scheduler has no browser. Instagram
--     refuses a post without an image, so Autopilot could never reach it.
--
--  Both want a permanent, publicly readable image. Every other bucket in
--  this project is private and served by signed URLs that expire, which is
--  right for a customer's work and wrong for a link preview — networks
--  fetch og:image days later and cache it for weeks.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. THE PUBLIC PREVIEW BUCKET
-- ---------------------------------------------------------------------
--  Deliberately public, and deliberately separate from the buckets that
--  hold the actual work. Nothing goes in here except an image the
--  customer has chosen to share.

insert into storage.buckets (id, name, public)
values ('share-previews', 'share-previews', true)
on conflict (id) do update set public = true;


do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname like 'share_previews_%'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- Anyone may read: that is the entire point of the bucket, and it is what
-- lets a network fetch the card image without a session.
create policy share_previews_read on storage.objects
  for select
  using (bucket_id = 'share-previews');

-- Writing is confined to your own folder. Paths are `<user id>/<file>`,
-- so this stops one customer overwriting another's preview.
create policy share_previews_write on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'share-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy share_previews_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'share-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy share_previews_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'share-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ---------------------------------------------------------------------
--  2. A COVER FOR EACH SAVED COMIC
-- ---------------------------------------------------------------------
--  `comics` predates these migrations, so the column is added defensively:
--  a fresh database that has not run the original setup should not fail
--  here.

do $$
begin
  if to_regclass('public.comics') is not null then
    alter table public.comics add column if not exists cover_url text;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  3. A COVER FOR EACH AUTOPILOT EPISODE
-- ---------------------------------------------------------------------
--  Rendered on the server as the run finishes. It is what gets posted to
--  Instagram, and what Facebook and Telegram show instead of a bare link.

alter table public.autopilot_runs  add column if not exists cover_url text;
alter table public.shared_items    add column if not exists preview_url text;

-- How many panels a run should draw. One — the cover — by default: a run
-- is a single serverless invocation and each image is a round trip to the
-- generation backend, so drawing a dozen would time out halfway.
alter table public.autopilot_campaigns
  add column if not exists render_panels integer not null default 1;

alter table public.autopilot_campaigns
  drop constraint if exists autopilot_render_panels;

alter table public.autopilot_campaigns
  add constraint autopilot_render_panels check (render_panels between 0 and 2);


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select id, public from storage.buckets where id = 'share-previews';
