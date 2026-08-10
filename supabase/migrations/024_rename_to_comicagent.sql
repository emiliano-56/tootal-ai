-- =====================================================================
--  024 — The product is called ComicAgent AI
-- =====================================================================
--  The name was seeded into the database by migrations 002, 006, 008 and
--  012. Those files have been corrected so a fresh install comes up with
--  the right name, but editing a migration that has already run does
--  nothing to a database that already ran it — the rows still say
--  ComicTale AI. This migration is what actually renames them.
--
--  Deliberately narrow. It rewrites the platform's own branding and the
--  copy on the plans we sell, and it does NOT touch:
--
--    * White-label tenants. Their name is their own brand, and the whole
--      product they bought is that our name never appears. A blanket
--      find-and-replace would rename someone's business.
--    * Anything a customer typed — campaign names, project titles,
--      landing page copy. If a customer wrote "ComicTale" in their own
--      sales page, that is their text to change.
--    * The support email. Changing the address on a mailbox that may not
--      exist yet would silently break support mail; change it under
--      Superadmin -> Settings once the new inbox is live.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. THE PLATFORM'S OWN NAME
-- ---------------------------------------------------------------------

update public.platform_settings
   set value = '"ComicAgent AI"'::jsonb
 where key = 'platform_name'
   and value::text like '%ComicTale%';

-- The platform tenant, whose id is fixed so it can be addressed directly.
-- Matched on the id rather than the name so a white-label tenant that
-- happens to contain the old word is never caught by this.
update public.tenants
   set name = 'ComicAgent AI'
 where id = '00000000-0000-0000-0000-000000000001'
   and name in ('Comic Tale AI', 'ComicTale AI', 'ComicTale');


-- ---------------------------------------------------------------------
--  2. THE COPY ON OUR OWN PLANS
-- ---------------------------------------------------------------------
--  Plan names and descriptions are shown on the pricing screen and in the
--  console, so they are ours to rename. Restricted to the seeded codes so
--  a plan the owner added by hand is left alone.

update public.plans
   set name        = replace(replace(name, 'ComicTale AI', 'ComicAgent AI'), 'Comic Tale AI', 'ComicAgent AI'),
       description = replace(replace(description, 'ComicTale AI', 'ComicAgent AI'), 'Comic Tale AI', 'ComicAgent AI')
 where code in ('fe', 'oto1', 'oto2', 'oto3', 'oto4', 'oto4_100', 'oto4_150',
                'oto5', 'oto5_15', 'oto5_25', 'mega')
   and (name like '%Comic%Tale%' or description like '%Comic%Tale%');


-- ---------------------------------------------------------------------
--  3. EMAIL TEMPLATES WE SHIPPED
-- ---------------------------------------------------------------------
--  Only the platform's own templates. A white label's templates carry
--  their branding and must not be rewritten — hence the tenant filter
--  rather than a blanket update.

update public.email_templates
   set subject = replace(replace(subject, 'ComicTale AI', 'ComicAgent AI'), 'Comic Tale AI', 'ComicAgent AI'),
       body_html = replace(replace(body_html, 'ComicTale AI', 'ComicAgent AI'), 'Comic Tale AI', 'ComicAgent AI')
 where (tenant_id is null or tenant_id = '00000000-0000-0000-0000-000000000001')
   and (subject like '%Comic%Tale%' or body_html like '%Comic%Tale%');


-- ---------------------------------------------------------------------
--  4. THE PLATFORM'S OWN BRANDING
-- ---------------------------------------------------------------------
--  brand_name lives on tenants, alongside the name. Same rule as above and
--  for a stronger reason: a white label's brand_name is the entire thing
--  they paid for, so this is pinned to the platform tenant's fixed id.

update public.tenants
   set brand_name = 'ComicAgent AI'
 where id = '00000000-0000-0000-0000-000000000001'
   and brand_name in ('Comic Tale AI', 'ComicTale AI', 'ComicTale');


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select 'platform_name' as what, value::text as value
  from public.platform_settings where key = 'platform_name'
union all
select 'platform tenant', name
  from public.tenants where id = '00000000-0000-0000-0000-000000000001';

-- Anything still carrying the old name, so it can be looked at by hand.
select code, name from public.plans where name like '%Comic%Tale%' or description like '%Comic%Tale%';
