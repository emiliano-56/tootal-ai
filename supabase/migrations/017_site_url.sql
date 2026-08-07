-- =====================================================================
--  017 — One address the platform calls itself by
-- =====================================================================
--  Every generated link is absolute and was being built from whatever
--  host the incoming request happened to carry. That is right most of
--  the time and wrong in three cases that all matter:
--
--    - Behind a reverse proxy. Shared hosting and nginx often forward
--      without setting X-Forwarded-Host, so the app sees localhost:3000
--      and stamps it into links it emails to customers.
--
--    - The scheduler. Cron calls in from outside, so whichever URL the
--      cron job uses becomes the origin for every share link Autopilot
--      creates that night.
--
--    - OAuth. A redirect URI has to match what was registered with
--      Facebook or X character for character. It cannot be allowed to
--      vary at all.
--
--  Setting this once fixes all three. Left empty, the request origin is
--  still used, so an installation works before anyone visits Settings.
--
--  Safe to re-run.
-- =====================================================================

insert into public.platform_settings (key, value, label, description, category, input_type, options)
values (
  'site_url',
  '""'::jsonb,
  'Site URL',
  'The public address of this platform, e.g. https://abc.com. Used for share links, OAuth redirects and the sign-in link in emails. Leave empty to use whatever address the request arrives on.',
  'general',
  'text',
  null
)
on conflict (key) do update set
  label       = excluded.label,
  description = excluded.description,
  category    = excluded.category,
  input_type  = excluded.input_type;


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select key, value, label from public.platform_settings where key = 'site_url';
