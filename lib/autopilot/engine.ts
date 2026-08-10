import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { completeJson, AiError } from '@/lib/ai/deepseek'
import { sendMail } from '@/lib/mail/mailer'
import { consumeFeature } from '@/lib/plans/server'
import { nextRunAt, type Frequency } from '@/lib/autopilot/schedule'
import { publishAll, loadConnections } from '@/lib/social/publish'
import { createShare, shareLink } from '@/lib/share/links'
import { renderPreview, coverPromptFor } from '@/lib/ai/images'
import {
  contentKind,
  featureFor,
  drawsArtwork,
  ideaSource,
  whenPlanEnds,
  decideNext,
  CONTENT_KINDS,
  type ContentKind,
} from '@/lib/autopilot/content'

/**
 * Producing one episode, unattended.
 *
 * The customer is asleep, so nothing here may throw into the void: every exit
 * writes a run row, and a failure records why. A campaign that quietly stopped
 * would be the worst possible outcome for a product sold on not having to
 * check on it.
 *
 * The run is deliberately small — one episode, one script, one delivery. Long
 * work would hit the serverless timeout and leave a half-written row.
 */

export interface Campaign {
  id: string
  user_id: string
  tenant_id: string | null
  name: string
  niche: string
  audience: string
  art_style: string
  tone: string
  episodes_per_run: number
  frequency: Frequency
  publish_hour: number
  timezone: string
  platforms: string[]
  connection_ids: string[]
  render_panels: number
  webhook_url: string | null
  deliver_email: string | null
  status: string
  series_bible: Record<string, unknown>
  next_run_at: string | null
  last_run_at: string | null
  total_runs: number
  created_at: string
  /** Null on a campaign made before migration 023 — all of those are comics. */
  content_kind?: string | null
  idea_source?: string | null
  when_plan_ends?: string | null
}

export interface Idea {
  id: string
  title: string
  hook: string
  angle: string | null
  score: number
  /** Set only for a planned day: the brief the customer wrote themselves. */
  prompt?: string
  /** The plan row this came from, so the run can be traced back to its day. */
  planItemId?: string
  planDay?: number
}

// ---------------------------------------------------------------------------
//  Ideas
// ---------------------------------------------------------------------------

interface IdeaDraft {
  title: string
  hook: string
  angle: string
  score: number
}

/**
 * Fresh story ideas for a campaign.
 *
 * "Trending" for children's content does not mean the news — it means the
 * seasons, the school year and what a child that age is preoccupied with. The
 * model is told that explicitly, because asked for trends it will otherwise
 * return current affairs, which is the last thing this audience wants.
 */
export async function discoverIdeas(campaign: Campaign, count = 6): Promise<IdeaDraft[]> {
  const { data: recent } = await supabaseAdmin
    .from('autopilot_ideas')
    .select('title')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: false })
    .limit(30)

  const seen = ((recent ?? []) as { title: string }[]).map((row) => row.title)
  const month = new Date().toLocaleString('en-GB', { month: 'long' })

  const result = await completeJson<{ ideas: IdeaDraft[] }>({
    system: `You plan episodes for a children's comic series.

Return JSON exactly as: { "ideas": [{ "title": "", "hook": "one sentence", "angle": "what makes this one different", "score": 0 }] }

"Trending" for this audience means the season, the school year, and what a child
of this age is preoccupied with right now — starting school, losing a tooth, a
new sibling, the first frost, a birthday. It does NOT mean news, politics or
anything adults are talking about.

Score 0-100 for how well the idea suits the audience and how likely a parent is
to pick it. Be honest; a flat list of 90s is useless.`,
    prompt: `Series: ${campaign.name}
Niche: ${campaign.niche}
Audience: ${campaign.audience}
Tone: ${campaign.tone}
Current month: ${month}

${seen.length > 0 ? `Already used, do not repeat or rephrase:\n${seen.map((title) => `- ${title}`).join('\n')}` : 'This is the first batch.'}

Give me ${count} ideas.`,
    temperature: 0.9,
    maxTokens: 1500,
  })

  return (result?.ideas ?? [])
    .filter((idea) => idea?.title)
    .slice(0, count)
    .map((idea) => ({
      title: String(idea.title).slice(0, 200),
      hook: String(idea.hook ?? '').slice(0, 500),
      angle: String(idea.angle ?? '').slice(0, 500),
      // Clamped: the model occasionally returns 0-10 or 0-1 despite the prompt.
      score: Math.min(100, Math.max(0, Math.round(Number(idea.score) || 50))),
    }))
}

/** Store a batch of ideas, keeping the campaign's queue topped up. */
export async function refillIdeas(campaign: Campaign, count = 6): Promise<number> {
  const drafts = await discoverIdeas(campaign, count)

  if (drafts.length === 0) return 0

  const { error } = await supabaseAdmin.from('autopilot_ideas').insert(
    drafts.map((draft) => ({
      campaign_id: campaign.id,
      title: draft.title,
      hook: draft.hook,
      angle: draft.angle,
      score: draft.score,
    }))
  )

  if (error) throw new Error(error.message)

  return drafts.length
}

/** The best unused AI idea, generating more if the queue has run dry. */
async function nextAiIdea(campaign: Campaign): Promise<Idea | null> {
  const pick = async () => {
    const { data } = await supabaseAdmin
      .from('autopilot_ideas')
      .select('id, title, hook, angle, score')
      .eq('campaign_id', campaign.id)
      .eq('status', 'new')
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle()

    return (data as Idea | null) ?? null
  }

  const existing = await pick()

  if (existing) return existing

  await refillIdeas(campaign)

  return pick()
}

interface PlanRow {
  id: string
  day: number
  title: string
  prompt: string
  used: boolean
}

/**
 * What this run should make.
 *
 * A planned campaign takes the next day the customer wrote. When the plan runs
 * out, `when_plan_ends` decides — and the default is to stop, because
 * continuing would post something under a campaign the customer believed had
 * finished. `null` means stop, with the reason recorded on the run.
 */
async function nextIdea(campaign: Campaign): Promise<{ idea: Idea | null; reason?: string }> {
  const source = ideaSource(campaign.idea_source)

  if (source === 'ai') return { idea: await nextAiIdea(campaign) }

  const { data } = await supabaseAdmin
    .from('autopilot_plan_items')
    .select('id, day, title, prompt, used')
    .eq('campaign_id', campaign.id)
    .order('day')

  const plan = (data ?? []) as PlanRow[]

  const decision = decideNext({
    source,
    plan: plan.map((row) => ({ day: row.day, used: row.used })),
    whenEnds: whenPlanEnds(campaign.when_plan_ends),
  })

  if (decision.action === 'stop') return { idea: null, reason: decision.reason }

  if (decision.action === 'use_ai') return { idea: await nextAiIdea(campaign) }

  // Repeating: every day is used, so the flags are cleared before day one is
  // taken again. Done here rather than in the pure decision so that function
  // stays free of side effects.
  if (plan.every((row) => row.used)) {
    await supabaseAdmin
      .from('autopilot_plan_items')
      .update({ used: false, used_at: null, run_id: null })
      .eq('campaign_id', campaign.id)
  }

  const item = plan.find((row) => row.day === decision.day)

  if (!item) return { idea: null, reason: 'The planned day went missing.' }

  return {
    idea: {
      id: item.id,
      title: item.title || item.prompt.slice(0, 120),
      hook: item.prompt.slice(0, 500),
      angle: null,
      score: 100,
      prompt: item.prompt,
      planItemId: item.id,
      planDay: item.day,
    },
  }
}

// ---------------------------------------------------------------------------
//  The episode
// ---------------------------------------------------------------------------

export interface EpisodeScript {
  title: string
  logline: string
  pages: {
    page_number: number
    scene_summary: string
    panels: { panel_number: number; image_prompt: string; caption: string }[]
  }[]
  characters: { name: string; appearance: string }[]
  post: { caption: string; hashtags: string[] }
}

/**
 * The brief for each kind of thing a campaign can post.
 *
 * All four return the same JSON shape on purpose. Delivery, the share page,
 * the project row and the history screen all read `pages[].panels[].caption`
 * and `post.caption`, and giving each kind its own shape would mean four
 * versions of every one of those. What changes is the instruction, which is
 * the part that actually differs.
 */
const BRIEF: Record<ContentKind, string> = {
  comic: `You write short comic episodes for children.

Six pages, two panels each. Every image_prompt must stand alone — it is sent to
an image model that has not read the rest — and must restate the character's
appearance every time, word for word from the character list.

Captions are read aloud by a parent. Short sentences. No dialogue tags.`,

  coloring: `You design colouring-book pages for children.

Six pages, ONE panel each — a colouring page is a single drawing, not a strip.

Every image_prompt must ask for clean black outlines on pure white, no shading,
no grey, no colour and thick lines a child can colour inside. State that every
time; an image model that is not told will return a full-colour illustration.

The caption is the one line printed under the drawing. Keep it to a few words.`,

  post: `You write social posts for a children's comic brand.

ONE page with ONE panel: a single image and a single caption. This is a post,
not a story, and padding it into six pages wastes the customer's allowance on
artwork nobody asked for.

The image_prompt is for the post's picture. The post caption is the thing that
has to earn the scroll — write that properly and keep the hashtags relevant.`,

  video: `You write short narrated video scripts for a children's comic brand.

Six pages, one panel each — each one is a shot. The caption is what the
narrator SAYS over that shot, so write it to be read aloud: short sentences,
natural rhythm, no stage directions.

image_prompt describes what is on screen for that shot. Nothing is rendered
from it here, so it can be a description rather than a full prompt.`,
}

/**
 * Write one episode.
 *
 * The series bible goes in whole and comes back updated, so episode nine has
 * the same cast as episode one. That consistency is the difference between a
 * series and a pile of unrelated comics.
 *
 * A planned idea carries the customer's own prompt, and it goes in as the
 * instruction rather than as a hint. Somebody who wrote out thirty days wants
 * day twelve to be what they wrote, not the model's improvement on it.
 */
export async function writeEpisode(campaign: Campaign, idea: Idea): Promise<EpisodeScript> {
  const bible = campaign.series_bible ?? {}
  const cast = (bible.characters as { name: string; appearance: string }[] | undefined) ?? []
  const kind = contentKind(campaign.content_kind)

  return completeJson<EpisodeScript>({
    system: `${BRIEF[kind]}

Return JSON exactly as:
{
  "title": "",
  "logline": "one sentence",
  "characters": [{ "name": "", "appearance": "detailed and unchanging" }],
  "pages": [{ "page_number": 1, "scene_summary": "", "panels": [{ "panel_number": 1, "image_prompt": "", "caption": "" }] }],
  "post": { "caption": "for social media", "hashtags": ["", ""] }
}`,
    prompt: `Series: ${campaign.name}
Niche: ${campaign.niche}
Audience: ${campaign.audience}
Tone: ${campaign.tone}
Art style for every image prompt: ${campaign.art_style}

${cast.length > 0 ? `Existing cast — keep these EXACTLY as described:\n${cast.map((c) => `${c.name}: ${c.appearance}`).join('\n')}` : 'This is the first one. Invent a small cast and describe each one precisely enough to redraw.'}

This one:
Title idea: ${idea.title}
Hook: ${idea.hook}
${idea.angle ? `Angle: ${idea.angle}` : ''}${
      idea.prompt
        ? `\n\nThe customer wrote this brief themselves. Follow it — do not replace it with a better idea of your own:\n${idea.prompt}`
        : ''
    }`,
    temperature: 0.8,
    maxTokens: 4000,
  })
}

// ---------------------------------------------------------------------------
//  Delivery
// ---------------------------------------------------------------------------

/** The episode as something a reader can follow, for the share page. */
function episodeText(script: EpisodeScript): string {
  const pages = script.pages ?? []

  return [
    script.logline ?? '',
    '',
    ...pages.flatMap((page) => [
      `Page ${page.page_number} — ${page.scene_summary ?? ''}`,
      ...(page.panels ?? []).map((panel) => `  ${panel.caption ?? ''}`),
      '',
    ]),
  ]
    .join('\n')
    .trim()
}

/**
 * Hand the finished episode over.
 *
 * Posting directly to YouTube or Instagram needs an OAuth app each platform has
 * to approve, so what ships is a webhook and an email — both of which work
 * today, and either of which drives Zapier, Make or a publishing tool the
 * customer already uses. The platform list is recorded so the payload says
 * where it is meant to go.
 */
export async function deliver(
  campaign: Campaign,
  script: EpisodeScript,
  runId: string,
  origin = '',
  coverUrl: string | null = null
): Promise<string[]> {
  const delivered: string[] = []

  // Posting to the customer's own accounts, if they attached any. This is the
  // part OTO 3 actually promises: the episode appears on their channels
  // without them being awake for it.
  if ((campaign.connection_ids ?? []).length > 0) {
    const connections = await loadConnections(campaign.user_id, campaign.connection_ids)

    if (connections.length > 0) {
      // A share link first: several networks render a preview card from it,
      // and the ones that cannot take an image still get somewhere to point.
      const share = await createShare({
        userId: campaign.user_id,
        tenantId: campaign.tenant_id,
        kind: 'episode',
        title: script.title,
        caption: script.post?.caption ?? script.logline ?? '',
        hashtags: (script.post?.hashtags ?? []).map((tag) => tag.replace(/^#/, '')),
        // The written episode still backs the link, so the share page has
        // something to read even when the drawing failed.
        body: episodeText(script),
        previewUrl: coverUrl,
      })

      const caption = [script.post?.caption ?? script.logline ?? script.title]
        .filter(Boolean)
        .join(' ')

      const results = await publishAll(
        connections,
        {
          caption,
          url: share && origin ? shareLink(origin, share.token) : undefined,
          // Instagram refuses a post without one, and Facebook and Telegram
          // both do better with a picture than with a bare link.
          imageUrl: coverUrl ?? undefined,
          hashtags: script.post?.hashtags ?? [],
        },
        { runId, sharedId: share?.id }
      )

      for (const result of results) {
        if (result.ok) delivered.push(result.platform)
      }
    }
  }

  if (campaign.webhook_url) {
    try {
      const response = await fetch(campaign.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'autopilot.episode',
          campaign: { id: campaign.id, name: campaign.name, niche: campaign.niche },
          run_id: runId,
          platforms: campaign.platforms,
          episode: script,
        }),
        // A customer's endpoint must not be able to hold the scheduler open.
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) delivered.push('webhook')
    } catch {
      // Recorded by omission: the run still succeeded, the handover did not.
    }
  }

  if (campaign.deliver_email) {
    const pages = script.pages ?? []

    const result = await sendMail({
      to: campaign.deliver_email,
      subject: `${campaign.name}: ${script.title}`,
      html: `<p><strong>${script.title}</strong></p>
<p>${script.logline ?? ''}</p>
${pages
  .map(
    (page) =>
      `<p><strong>Page ${page.page_number}</strong> — ${page.scene_summary}<br>` +
      (page.panels ?? [])
        .map((panel) => `<em>${panel.caption}</em>`)
        .join('<br>') +
      '</p>'
  )
  .join('')}
<p>${script.post?.caption ?? ''}<br>${(script.post?.hashtags ?? []).join(' ')}</p>`,
      tenantId: campaign.tenant_id,
    })

    if (result.ok) delivered.push('email')
  }

  return delivered
}

// ---------------------------------------------------------------------------
//  One run
// ---------------------------------------------------------------------------

export interface RunResult {
  runId: string
  status: 'done' | 'failed' | 'skipped'
  title?: string
  error?: string
  delivered?: string[]
}

/**
 * Produce one episode for one campaign, from scheduling to delivery.
 *
 * Always advances `next_run_at`, whatever happens. A campaign that failed and
 * kept its old slot would be retried by every scheduler tick from then on.
 */
export async function runCampaign(campaign: Campaign, origin = ''): Promise<RunResult> {
  const { data: created, error: runError } = await supabaseAdmin
    .from('autopilot_runs')
    .insert({
      campaign_id: campaign.id,
      user_id: campaign.user_id,
      scheduled_for: campaign.next_run_at ?? new Date().toISOString(),
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (runError || !created) {
    return { runId: '', status: 'failed', error: runError?.message ?? 'Could not start the run' }
  }

  const runId = (created as { id: string }).id

  const advance = async (patch: Record<string, unknown> = {}) => {
    const next = nextRunAt(
      {
        frequency: campaign.frequency,
        publishHour: campaign.publish_hour,
        timezone: campaign.timezone,
        startedAt: new Date(campaign.created_at),
      },
      new Date()
    )

    await supabaseAdmin
      .from('autopilot_campaigns')
      .update({
        next_run_at: next.toISOString(),
        last_run_at: new Date().toISOString(),
        total_runs: campaign.total_runs + 1,
        ...patch,
      })
      .eq('id', campaign.id)
  }

  const fail = async (message: string, status: 'failed' | 'skipped' = 'failed') => {
    await supabaseAdmin
      .from('autopilot_runs')
      .update({ status, error: message.slice(0, 500), finished_at: new Date().toISOString() })
      .eq('id', runId)

    await advance()

    return { runId, status, error: message }
  }

  try {
    const kind = contentKind(campaign.content_kind)
    const kindLabel = CONTENT_KINDS.find((entry) => entry.kind === kind)?.label ?? kind

    // Charged against the allowance for what it actually makes. A colouring
    // campaign spending the comic allowance is how a customer runs out of the
    // wrong thing and cannot see why.
    const spend = await consumeFeature(campaign.user_id, featureFor(kind))

    if (!spend.ok) {
      return (await fail(
        spend.error ?? `Monthly ${kindLabel.toLowerCase()} allowance is gone`,
        'skipped'
      )) as RunResult
    }

    const { idea, reason } = await nextIdea(campaign)

    if (!idea) {
      // A finished plan is not a failure, and marking it as one would fill the
      // history with red rows for a campaign that did exactly what was asked.
      // The campaign is paused so the scheduler stops picking it up.
      if (reason) {
        await supabaseAdmin
          .from('autopilot_campaigns')
          .update({ status: 'complete' })
          .eq('id', campaign.id)

        return (await fail(reason, 'skipped')) as RunResult
      }

      return (await fail('Could not come up with an idea', 'skipped')) as RunResult
    }

    const script = await writeEpisode(campaign, idea)

    if (!script?.title) return (await fail('The episode came back empty')) as RunResult

    // Mark whichever queue it came from. A planned day is marked before the
    // artwork so a failure later cannot serve the same day twice.
    if (idea.planItemId) {
      await supabaseAdmin
        .from('autopilot_plan_items')
        .update({ used: true, used_at: new Date().toISOString(), run_id: runId })
        .eq('id', idea.planItemId)
    } else {
      await supabaseAdmin.from('autopilot_ideas').update({ status: 'used' }).eq('id', idea.id)
    }

    // A project row so the episode shows up in My Comics with everything else.
    const { data: project } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: campaign.user_id,
        title: script.title,
        idea: idea.hook,
        niche: campaign.niche,
        audience: campaign.audience,
        art_style: campaign.art_style,
        status: 'complete',
      })
      .select('id')
      .single()

    // Draw the cover. One image: a run is a single serverless invocation
    // and each one is a round trip to the generation backend, so a whole
    // book would time out halfway and leave a part-written row.
    let coverUrl: string | null = null

    // A video script renders nothing — it is a shot list to record against —
    // so skipping the image saves the customer a generation and the run a
    // round trip to the backend.
    if (drawsArtwork(kind) && (campaign.render_panels ?? 1) > 0) {
      coverUrl = await renderPreview(
        campaign.user_id,
        coverPromptFor(
          script.title,
          script.pages?.[0]?.panels?.[0]?.image_prompt,
          campaign.art_style
        ),
        { name: 'episode' }
      )
    }

    const delivered = await deliver(campaign, script, runId, origin, coverUrl)

    await supabaseAdmin
      .from('autopilot_runs')
      .update({
        status: 'done',
        title: script.title,
        script,
        // A planned day has no row in autopilot_ideas, so the foreign key
        // would not resolve — it is recorded on the plan columns instead.
        idea_id: idea.planItemId ? null : idea.id,
        plan_item_id: idea.planItemId ?? null,
        plan_day: idea.planDay ?? null,
        project_id: (project as { id: string } | null)?.id ?? null,
        cover_url: coverUrl,
        delivered_to: delivered,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)

    // Keep the cast stable for the next episode.
    if ((script.characters ?? []).length > 0) {
      await advance({
        series_bible: { ...campaign.series_bible, characters: script.characters },
      })
    } else {
      await advance()
    }

    return { runId, status: 'done', title: script.title, delivered }
  } catch (error) {
    const message =
      error instanceof AiError
        ? `The writer failed: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error)

    return (await fail(message)) as RunResult
  }
}
