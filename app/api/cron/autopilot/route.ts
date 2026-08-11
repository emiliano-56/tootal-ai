import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hasFeature } from '@/lib/plans/server'
import { runCampaign, type Campaign } from '@/lib/autopilot/engine'
import { tenantSiteUrl } from '@/lib/settings/site-url.server'

/**
 * The scheduler.
 *
 * Called on a timer from outside — Vercel Cron, a cPanel cron job, or any
 * uptime service that can hit a URL. Hourly is the right cadence: campaigns
 * pick an hour, not a minute.
 *
 * Authenticated by CRON_SECRET rather than a session, since nobody is signed
 * in when it fires. Without that secret set the route refuses to run at all —
 * an open endpoint here would let a stranger burn a customer's allowance.
 */

/**
 * How long this tick may run before the host kills it.
 *
 * One episode measures 70-100 seconds against the live services — the script
 * takes 20-40 and the cover render 48-64. That comfortably exceeds the 60
 * seconds a Vercel Hobby function gets, and being killed mid-run is not a
 * clean failure: the run row is left saying "running" forever and nothing
 * reaps it.
 *
 * So the budget is explicit and the loop stops starting new work when it
 * cannot finish. Set CRON_BUDGET_SECONDS to match wherever this is deployed:
 * 55 for Vercel Hobby, 290 for Pro, and anything you like on a VPS.
 */
const BUDGET_MS = (Number(process.env.CRON_BUDGET_SECONDS) || 280) * 1000

/** Longest a single run should take, from measurement rather than hope. */
const RUN_ESTIMATE_MS = 110_000

/**
 * A run still marked "running" long after it could possibly be alive.
 *
 * The host killed the function part-way. The row has to be closed or the
 * history shows a spinner that never resolves.
 */
const STUCK_AFTER_MS = 15 * 60 * 1000

async function reapStuckRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString()

  const { data } = await supabaseAdmin
    .from('autopilot_runs')
    .update({
      status: 'failed',
      error: 'The run was cut short — the host stopped it before it finished.',
      finished_at: new Date().toISOString(),
    })
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .select('id')

  return (data ?? []).length
}

const MAX_PER_TICK = 10

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET

  if (!secret) return false

  const supplied =
    request.headers.get('authorization')?.replace(/^Bearer /i, '') ??
    request.nextUrl.searchParams.get('key') ??
    ''

  const left = Buffer.from(supplied)
  const right = Buffer.from(secret)

  if (left.length !== right.length) return false

  return timingSafeEqual(left, right)
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json(
      { error: process.env.CRON_SECRET ? 'Bad key' : 'CRON_SECRET is not set' },
      { status: 401 }
    )
  }

  const startedAt = Date.now()
  const now = new Date().toISOString()

  // Close anything a previous tick had killed under it, before deciding what
  // is due — otherwise those campaigns look busy and get skipped forever.
  const reaped = await reapStuckRuns()

  // An external scheduler on a constrained host can ask for fewer.
  const limit = Math.min(
    MAX_PER_TICK,
    Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || MAX_PER_TICK)
  )



  // Oldest slot first, so a backlog drains in the order it built up.
  const { data, error } = await supabaseAdmin
    .from('autopilot_campaigns')
    .select('*')
    .eq('status', 'active')
    .lte('next_run_at', now)
    .order('next_run_at')
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const due = (data ?? []) as Campaign[]
  const results: { campaign: string; status: string; title?: string; error?: string }[] = []

  // One at a time. Ten episodes in parallel would hit the AI provider's rate
  // limit and fail most of them.
  let ranOut = false

  for (const campaign of due) {
    // Stop before the host does. A clean exit leaves the campaign due, so the
    // next tick picks it up; being killed leaves a half-written run row.
    if (Date.now() - startedAt + RUN_ESTIMATE_MS > BUDGET_MS && results.length > 0) {
      ranOut = true
      break
    }

    // A lapsed subscription stops producing, but the campaign is left alone so
    // it resumes intact when they renew.
    if (!(await hasFeature(campaign.user_id, 'autopilot'))) {
      await supabaseAdmin
        .from('autopilot_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaign.id)

      results.push({ campaign: campaign.name, status: 'paused', error: 'Autopilot not in plan' })
      continue
    }

    // Per campaign: each tenant may sit on its own white-label domain.
    const result = await runCampaign(
      campaign,
      await tenantSiteUrl(campaign.tenant_id, request.nextUrl.origin)
    )

    results.push({
      campaign: campaign.name,
      status: result.status,
      title: result.title,
      error: result.error,
    })
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    due: due.length,
    reaped,
    // True when work is still waiting: either more were due than one tick
    // takes, or the budget ran out part-way. Either way the operator can tell
    // a backlog from a quiet hour, and knows to schedule more often.
    more: due.length === limit || ranOut,
    ranOutOfTime: ranOut,
    tookSeconds: Math.round((Date.now() - startedAt) / 1000),
    results,
  })
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300
