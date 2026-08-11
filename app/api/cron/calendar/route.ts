import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { publishAll, loadConnections } from '@/lib/social/publish'
import { isDue, composeCaption, MAX_ATTEMPTS, STALE_POSTING_MS } from '@/lib/social/calendar'

/**
 * Draining the posting queue.
 *
 * Same shape as the autopilot scheduler and for the same reasons: called on a
 * timer from outside, authenticated by a shared secret because nobody is
 * signed in when it fires, and bounded by an explicit time budget so being
 * killed part-way cannot leave rows saying "posting" forever.
 *
 * Run it every five minutes. The queue rounds every scheduled time to a
 * five-minute slot, so anything finer would just be extra ticks finding
 * nothing.
 */

const BUDGET_MS = (Number(process.env.CRON_BUDGET_SECONDS) || 280) * 1000

/** Measured against the live publishers: a few seconds per network. */
const POST_ESTIMATE_MS = 20_000

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()

  // No secret means no scheduler. An open endpoint here would let a stranger
  // post to a customer's channels.
  if (!secret) return false

  const supplied =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    request.nextUrl.searchParams.get('secret') ??
    ''

  const a = Buffer.from(supplied)
  const b = Buffer.from(secret)

  // Length is compared first because timingSafeEqual throws on a mismatch,
  // and the length of a secret is not the part worth hiding.
  return a.length === b.length && timingSafeEqual(a, b)
}

interface Row {
  id: string
  user_id: string
  tenant_id: string | null
  caption: string
  hashtags: string[]
  image_url: string | null
  link_url: string | null
  connection_ids: string[]
  scheduled_for: string
  status: string
  attempts: number
  updated_at: string
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 })
  }

  const startedAt = Date.now()

  // Anything left mid-flight by a killed run. Reclaimed before the due query
  // so a stuck post is retried this tick rather than sitting until someone
  // notices.
  await supabaseAdmin
    .from('scheduled_posts')
    .update({ status: 'scheduled' })
    .eq('status', 'posting')
    .lt('updated_at', new Date(Date.now() - STALE_POSTING_MS).toISOString())

  const { data } = await supabaseAdmin
    .from('scheduled_posts')
    .select(
      'id, user_id, tenant_id, caption, hashtags, image_url, link_url, connection_ids, scheduled_for, status, attempts, updated_at'
    )
    .in('status', ['scheduled', 'posting'])
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)

  const queue = (data ?? []) as Row[]
  const results: { id: string; status: string; detail?: string }[] = []

  for (const post of queue) {
    // Stop starting work that cannot finish inside the budget.
    if (Date.now() - startedAt > BUDGET_MS - POST_ESTIMATE_MS) break

    const check = isDue(
      {
        status: post.status as never,
        scheduledFor: post.scheduled_for,
        attempts: post.attempts,
        startedAt: post.updated_at,
      },
      new Date()
    )

    if (!check.due) {
      // A post that will never be due again is closed out rather than left to
      // be re-examined on every tick forever.
      if (check.reason && /Gave up|six hours late/.test(check.reason)) {
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ status: 'failed', error: check.reason })
          .eq('id', post.id)

        results.push({ id: post.id, status: 'failed', detail: check.reason })
      }

      continue
    }

    // Claimed atomically: two overlapping ticks must not both post it.
    const { data: claimed } = await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'posting',
        attempts: post.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
      .eq('status', post.status)
      .eq('attempts', post.attempts)
      .select('id')
      .maybeSingle()

    if (!claimed) continue

    try {
      const connections = await loadConnections(post.user_id, post.connection_ids)

      if (connections.length === 0) {
        await supabaseAdmin
          .from('scheduled_posts')
          .update({
            status: 'failed',
            error: 'None of the chosen accounts are connected any more.',
          })
          .eq('id', post.id)

        results.push({ id: post.id, status: 'failed', detail: 'no connections' })
        continue
      }

      const outcome = await publishAll(
        connections,
        {
          caption: composeCaption(post.caption, post.hashtags ?? [], post.link_url),
          url: post.link_url ?? undefined,
          imageUrl: post.image_url ?? undefined,
          hashtags: post.hashtags ?? [],
        },
        {}
      )

      const succeeded = outcome.filter((entry) => entry.ok)

      // Partly succeeded still counts as posted: it went out, and retrying
      // would post it twice to the networks that worked.
      await supabaseAdmin
        .from('scheduled_posts')
        .update({
          status: succeeded.length > 0 ? 'posted' : post.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'scheduled',
          posted_at: succeeded.length > 0 ? new Date().toISOString() : null,
          results: outcome,
          error:
            succeeded.length > 0
              ? null
              : (outcome.find((entry) => !entry.ok)?.error ?? 'Every network refused it'),
        })
        .eq('id', post.id)

      results.push({
        id: post.id,
        status: succeeded.length > 0 ? 'posted' : 'retry',
        detail: `${succeeded.length}/${outcome.length}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      await supabaseAdmin
        .from('scheduled_posts')
        .update({
          status: post.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'scheduled',
          error: message.slice(0, 500),
        })
        .eq('id', post.id)

      results.push({ id: post.id, status: 'error', detail: message.slice(0, 120) })
    }
  }

  return NextResponse.json({
    ok: true,
    considered: queue.length,
    handled: results.length,
    results,
    ms: Date.now() - startedAt,
  })
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300
