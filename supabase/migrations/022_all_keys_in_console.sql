-- =====================================================================
--  022 — Every key in the console, and one leak closed
-- =====================================================================
--  Two jobs.
--
--  1. A LEAK.
--     Migration 020 gave audio_providers this read policy:
--
--         for select using (auth.uid() is not null)
--
--     The table has an `api_key` column, so that reads as: any signed-in
--     account may select every audio provider key. The intent was to let
--     the picker see which providers exist, but nothing client-side ever
--     queried this table — the search route reads it with the service
--     role. So the policy granted nothing that was used and exposed a
--     credential to every customer on the platform.
--
--     Reads are now superadmin-only, matching api_credentials.
--
--  2. THE POLICY SWITCH.
--     `allow_personal_api_keys` and `default_api_policy` have existed
--     since migration 006 and nothing ever read them. The runtime now
--     does, so the descriptions are rewritten to say what they actually
--     do — the old wording described an intention, and an owner reading
--     it could not tell that turning the switch on was enough.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. CLOSE THE AUDIO PROVIDER KEY LEAK
-- ---------------------------------------------------------------------

drop policy if exists audio_providers_read on public.audio_providers;

create policy audio_providers_read on public.audio_providers
  for select using (public.is_superadmin());


-- ---------------------------------------------------------------------
--  2. SAY WHAT THE POLICY SETTINGS DO
-- ---------------------------------------------------------------------

update public.platform_settings
   set label       = 'Let users bring their own AI key',
       description = 'Master switch. Off, everything runs on your keys and the '
                  || 'personal-key screen is hidden. On, accounts may add their '
                  || 'own — subject to the policy below. Turning this off '
                  || 'immediately stops every personal key, including on '
                  || 'accounts granted one individually; their setting is kept '
                  || 'and comes back when you switch it on again.'
 where key = 'allow_personal_api_keys';

update public.platform_settings
   set label       = 'Default for new accounts',
       description = 'Which keys an account uses when it has no override of its '
                  || 'own. "Their key first, yours as backup" is the one that '
                  || 'reduces your bill without risking a failed job. Only '
                  || 'applies while the switch above is on.'
 where key = 'default_api_policy';


-- ---------------------------------------------------------------------
--  3. LET A SUPERADMIN SEE WHOSE KEY RAN
-- ---------------------------------------------------------------------
--  Without this the analytics screen can say a provider was slow but not
--  whether it was the platform's key or a customer's — which is the first
--  question asked when one account's generations start failing.

create or replace view public.api_usage_with_scope as
  select l.id,
         l.provider,
         l.user_id,
         l.tenant_id,
         l.operation,
         l.latency_ms,
         l.succeeded,
         l.error_message,
         l.created_at,
         coalesce(c.scope, 'platform') as scope,
         c.label                       as credential_label
    from public.api_usage_logs l
    left join public.api_credentials c on c.id = l.credential_id;

-- Views run as their owner, so the underlying RLS is what protects this.
-- Granting to authenticated only; the policies on api_usage_logs and
-- api_credentials still decide what any given caller actually sees.
grant select on public.api_usage_with_scope to authenticated;


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select key, label from public.platform_settings where category = 'ai' order by key;

select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'audio_providers'
 order by policyname;
