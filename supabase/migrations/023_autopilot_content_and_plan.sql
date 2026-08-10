-- =====================================================================
--  023 — Autopilot: what to post, and whose idea it was
-- =====================================================================
--  Two things the campaign form never asked, and both matter more than
--  anything it did ask.
--
--  1. WHAT IT POSTS.
--     Every campaign produced a comic episode, because that is what the
--     engine was written to produce. Somebody running a colouring-page
--     channel got comics; somebody who wanted captions paid for artwork
--     they threw away.
--
--  2. WHOSE IDEA IT IS.
--     The engine invents one every run. That is the right default and it
--     is not always what is wanted — a thirty-day launch already has the
--     thirty ideas written down, in order, and handing them to a model
--     that will cheerfully invent a thirty-first is not automation.
--
--  Both default to exactly what campaigns do today, so nothing that is
--  running changes behaviour when this lands.
--
--  Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. WHAT A CAMPAIGN POSTS
-- ---------------------------------------------------------------------

alter table public.autopilot_campaigns
  add column if not exists content_kind text not null default 'comic';

alter table public.autopilot_campaigns
  drop constraint if exists autopilot_content_kind;

alter table public.autopilot_campaigns
  add constraint autopilot_content_kind
  check (content_kind in ('comic', 'coloring', 'post', 'video'));


-- ---------------------------------------------------------------------
--  2. WHERE THE IDEAS COME FROM
-- ---------------------------------------------------------------------
--  'ai'      the model invents each one — what every campaign does today
--  'planned' the customer supplied a day-by-day list

alter table public.autopilot_campaigns
  add column if not exists idea_source text not null default 'ai';

alter table public.autopilot_campaigns
  drop constraint if exists autopilot_idea_source;

alter table public.autopilot_campaigns
  add constraint autopilot_idea_source
  check (idea_source in ('ai', 'planned'));

--  What happens on the day after the plan runs out. 'stop' is the default
--  on purpose: continuing would post something the customer never approved
--  under a campaign they thought had ended.
alter table public.autopilot_campaigns
  add column if not exists when_plan_ends text not null default 'stop';

alter table public.autopilot_campaigns
  drop constraint if exists autopilot_when_plan_ends;

alter table public.autopilot_campaigns
  add constraint autopilot_when_plan_ends
  check (when_plan_ends in ('stop', 'continue_with_ai', 'repeat'));


-- ---------------------------------------------------------------------
--  3. THE PLAN
-- ---------------------------------------------------------------------
--  A separate table rather than more columns on autopilot_ideas. The two
--  are genuinely different things: an idea is a title and a hook the model
--  scored, a plan item is an instruction the customer wrote and expects
--  back verbatim. Mixing them would mean the scoring column is meaningless
--  for half the rows and the prompt column null for the other half.

create table if not exists public.autopilot_plan_items (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.autopilot_campaigns (id) on delete cascade,

  -- 1-based. Day 1 is the campaign's first run, not a calendar date — a
  -- paused campaign should resume where it stopped, not skip to today.
  day          integer not null,
  title        text not null default '',
  prompt       text not null,

  used         boolean not null default false,
  used_at      timestamptz,
  run_id       uuid,

  created_at   timestamptz not null default now(),

  constraint autopilot_plan_day check (day >= 1 and day <= 365),
  unique (campaign_id, day)
);

create index if not exists autopilot_plan_next_idx
  on public.autopilot_plan_items (campaign_id, used, day);


-- ---------------------------------------------------------------------
--  4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
--  Ownership lives on the campaign, so the policy follows the join rather
--  than duplicating user_id onto every row — one place for the rule means
--  it cannot drift.

alter table public.autopilot_plan_items enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'autopilot_plan_items'
  loop
    execute format('drop policy if exists %I on public.autopilot_plan_items', pol.policyname);
  end loop;
end $$;

create policy autopilot_plan_own on public.autopilot_plan_items
  for all
  using (
    exists (
      select 1 from public.autopilot_campaigns c
       where c.id = campaign_id
         and (c.user_id = auth.uid() or public.is_superadmin())
    )
  )
  with check (
    exists (
      select 1 from public.autopilot_campaigns c
       where c.id = campaign_id
         and (c.user_id = auth.uid() or public.is_superadmin())
    )
  );


-- ---------------------------------------------------------------------
--  5. WHICH PLAN ITEM A RUN USED
-- ---------------------------------------------------------------------
--  So a failed run can be traced back to the day it was meant to be, and
--  so the history screen can say "day 12 of 30" rather than a bare title.

alter table public.autopilot_runs
  add column if not exists plan_item_id uuid references public.autopilot_plan_items (id) on delete set null;

alter table public.autopilot_runs
  add column if not exists plan_day integer;


-- ---------------------------------------------------------------------
--  VERIFY
-- ---------------------------------------------------------------------

select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'autopilot_campaigns'
   and column_name in ('content_kind', 'idea_source', 'when_plan_ends')
 order by column_name;
