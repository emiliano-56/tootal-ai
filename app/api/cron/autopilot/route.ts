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

  const now = new Date().toISOString()



  // Oldest slot first, so a backlog drains in the order it built up.
  const { data, error } = await supabaseAdmin
    .from('autopilot_campaigns')
    .select('*')
    .eq('status', 'active')
    .lte('next_run_at', now)
    .order('next_run_at')
    .limit(MAX_PER_TICK)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const due = (data ?? []) as Campaign[]
  const results: { campaign: string; status: string; title?: string; error?: string }[] = []

  // One at a time. Ten episodes in parallel would hit the AI provider's rate
  // limit and fail most of them.
  for (const campaign of due) {
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
    checked: due.length,
    // True when more were waiting than one tick handles, so an operator can
    // tell a backlog from a quiet hour.
    more: due.length === MAX_PER_TICK,
    results,
  })
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300
