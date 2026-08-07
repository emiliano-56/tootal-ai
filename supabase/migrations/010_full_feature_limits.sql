-- =====================================================================
--  010 — Front End covers every tool, at 10 a month
-- =====================================================================
--  008 gave Front End only the five core tools and left the agents to
--  OTO 2 and OTO 3, which meant a Front End customer saw the agents
--  locked rather than limited.
--
--  The intent is "ten of everything on Front End, unlimited on OTO 1", so
--  every feature is granted at 10/month on FE and unlimited on OTO 1.
--
--  OTO 2 and OTO 3 keep their own unlimited grants: someone who buys
--  FE + OTO 2 without OTO 1 gets unlimited agents while the rest stay at
--  ten — which is what makes those tiers worth selling separately.
--
--  These are starting values. Every number here is editable from
--  Superadmin → Plans without another migration.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  The full feature catalogue, mirroring lib/plans/entitlements.ts
-- ---------------------------------------------------------------------

create temporary table if not exists all_features (feature text primary key);

insert into all_features (feature)
values
  ('comic'), ('coloring'), ('video'), ('cover'), ('chat'),
  ('business-agent'), ('comic-agent'), ('comic-video'), ('cover-designer'),
  ('landing-pages'), ('marketing'), ('prompt-studio'),
  ('dfy-prompts'), ('analytics')
on conflict do nothing;


-- ---------------------------------------------------------------------
--  Front End — ten of each, per calendar month
-- ---------------------------------------------------------------------

insert into public.plan_features (plan_id, feature, monthly_limit)
select p.id, f.feature, 10
  from public.plans p
 cross join all_features f
 where p.code = 'fe'
on conflict (plan_id, feature) do update set monthly_limit = 10;


-- ---------------------------------------------------------------------
--  OTO 1 — the same tools with no cap
-- ---------------------------------------------------------------------

insert into public.plan_features (plan_id, feature, monthly_limit)
select p.id, f.feature, null
  from public.plans p
 cross join all_features f
 where p.code = 'oto1'
on conflict (plan_id, feature) do update set monthly_limit = null;


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------
--  fe should read 14 features at 10; oto1 14 unlimited.

select p.code,
       count(pf.feature)                                     as features,
       count(*) filter (where pf.monthly_limit is null)      as unlimited,
       min(pf.monthly_limit)                                 as lowest_limit
  from public.plans p
  left join public.plan_features pf on pf.plan_id = p.id
 group by p.code, p.sort_order
 order by p.sort_order;
