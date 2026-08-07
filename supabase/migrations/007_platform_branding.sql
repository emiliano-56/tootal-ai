-- =====================================================================
--  007 — Let the platform tenant carry its own branding
-- =====================================================================
--  002 added a check constraint meant to stop resellers from rebranding:
--
--    type = 'white_label' or (brand_name is null and logo_url is null ...)
--
--  Written that way it also blocked the platform tenant, so a superadmin
--  could not upload the platform's own logo or favicon — the upload API
--  failed with "Branding is only available on white-label accounts".
--
--  The product rule is about resellers specifically: they sell the official
--  product and must not rebrand it. The platform branding itself, and white
--  labels brand themselves.
--
--  Safe to re-run.
-- =====================================================================

alter table public.tenants
  drop constraint if exists tenants_branding_only_white_label;

alter table public.tenants
  add constraint tenants_branding_not_reseller check (
    type <> 'reseller'
    or (brand_name is null and logo_url is null and custom_css is null)
  );


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.tenants'::regclass
   and conname like 'tenants_branding%';
