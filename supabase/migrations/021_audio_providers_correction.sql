-- =====================================================================
--  021 — Audio providers, corrected
-- =====================================================================
--  Migration 020 offered Pixabay as a music source. It is not one.
--
--  Pixabay's website has a large music library, but their public API
--  documents two endpoints and neither is audio:
--
--      https://pixabay.com/api/          images
--      https://pixabay.com/api/videos/   videos
--
--  The search code pointed at the first of those, so a platform owner who
--  pasted in a Pixabay key would have got photographs listed as tracks,
--  with a JPEG thumbnail as the audio URL. Nothing would play and the
--  licence shown would be attached to the wrong kind of file entirely.
--
--  Pexels is the same story: photos and videos, no music endpoint.
--
--  What is left is what actually works and stays free:
--
--    - Openverse   no key at all, and it already aggregates Jamendo,
--                  ccMixter, Wikimedia and Freesound. This is why the
--                  feature works the moment the migration runs.
--    - Jamendo     a free client id, and the best free music catalogue
--                  of the three. Worth the two minutes of registering.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. REMOVE PIXABAY AS AN AUDIO SOURCE
-- ---------------------------------------------------------------------
--  Deleted rather than disabled. Left in the table it reads as "add a
--  key to switch this on", which is advice that cannot be followed —
--  there is no key that would make it work.

delete from public.audio_providers where provider = 'pixabay';


-- ---------------------------------------------------------------------
--  2. SAY WHAT EACH ONE NEEDS
-- ---------------------------------------------------------------------
--  `setup_url` so the console can link straight to where the key comes
--  from, and `needs_key` so it can stop asking for one that Openverse
--  has no use for.

alter table public.audio_providers add column if not exists needs_key  boolean not null default true;
alter table public.audio_providers add column if not exists setup_url  text;
alter table public.audio_providers add column if not exists notes      text;

update public.audio_providers
   set needs_key = false,
       setup_url = 'https://api.openverse.org/v1/',
       notes     = 'No key needed. Aggregates Jamendo, ccMixter, Wikimedia and Freesound, so it covers a lot on its own.'
 where provider = 'openverse';

update public.audio_providers
   set needs_key = true,
       setup_url = 'https://developer.jamendo.com/v3.0',
       notes     = 'Free client id. The largest free music catalogue of the two — worth adding.'
 where provider = 'jamendo';


-- ---------------------------------------------------------------------
--  3. DROP TRACKS SAVED FROM THE BROKEN PROVIDER
-- ---------------------------------------------------------------------
--  Any row here is an image that was stored as music. Its url does not
--  play and its credit line describes the wrong work, so keeping it
--  would only put a false attribution in a video description.

delete from public.audio_tracks where provider = 'pixabay';


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select provider, label, enabled, needs_key,
       case when api_key is null then 'not set' else 'set' end as key,
       setup_url
  from public.audio_providers
 order by provider;
