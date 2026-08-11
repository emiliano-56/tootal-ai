import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { roundToSlot, captionProblems } from '@/lib/social/calendar'

/**
 * The posting queue.
 *
 * Reads and writes only the caller's own rows. The scheduler that drains this
 * queue is a separate cron route — this one never posts anything, so a bug
 * here cannot put something out early.
 */

const SELECT =
  'id, caption, hashtags, image_url, link_url, connection_ids, scheduled_for, timezone, status, attempts, posted_at, error, results, created_at'

/** Connection ids that actually belong to this account. */
async function ownedConnections(userId: string, ids: unknown): Promise<string[]> {
  const wanted = Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string').slice(0, 12)
    : []

  if (wanted.length === 0) return []

  const { data } = await supabaseAdmin
    .from('social_connections')
    .select('id, platform')
    .eq('user_id', userId)
    .in('id', wanted)

  return ((data ?? []) as { id: string }[]).map((row) => row.id)
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')

  let query = supabaseAdmin
    .from('scheduled_posts')
    .select(SELECT)
    .eq('user_id', session.userId)
    .order('scheduled_for', { ascending: true })
    .limit(500)

  if (from) query = query.gte('scheduled_for', from)
  if (to) query = query.lte('scheduled_for', to)

  const [{ data, error }, { data: connections }] = await Promise.all([
    query,
    supabaseAdmin
      .from('social_connections')
      .select('id, platform, account_name')
      .eq('user_id', session.userId)
      .eq('status', 'active'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(
    { posts: data ?? [], connections: connections ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = String(body?.action ?? 'create')

  if (action === 'create' || action === 'update') {
    const caption = String(body?.caption ?? '').trim()
    const connectionIds = await ownedConnections(session.userId, body?.connectionIds)

    if (connectionIds.length === 0) {
      return NextResponse.json(
        { error: 'Choose at least one connected account to post to' },
        { status: 400 }
      )
    }

    if (!caption && !body?.imageUrl) {
      return NextResponse.json({ error: 'A post needs a caption or a picture' }, { status: 400 })
    }

    const when = new Date(String(body?.scheduledFor ?? ''))

    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'Pick a date and time' }, { status: 400 })
    }

    // Rounded where the customer can see it: the scheduler ticks, so a post
    // asked for at 09:02 was never going out at 09:02.
    const scheduledFor = roundToSlot(when)

    const patch = {
      caption: caption.slice(0, 5000),
      hashtags: Array.isArray(body?.hashtags)
        ? body.hashtags.map((tag: unknown) => String(tag).slice(0, 60)).slice(0, 30)
        : [],
      image_url: String(body?.imageUrl ?? '').trim() || null,
      link_url: String(body?.linkUrl ?? '').trim() || null,
      library_item_id: body?.libraryItemId ?? null,
      connection_ids: connectionIds,
      scheduled_for: scheduledFor.toISOString(),
      timezone: String(body?.timezone ?? 'UTC').slice(0, 64),
      updated_at: new Date().toISOString(),
    }

    if (action === 'update') {
      const { error } = await supabaseAdmin
        .from('scheduled_posts')
        .update({ ...patch, status: 'scheduled', attempts: 0, error: null })
        .eq('id', String(body?.id ?? ''))
        .eq('user_id', session.userId)
        // A post already out cannot be rescheduled; editing it would suggest
        // the live one changed too.
        .in('status', ['scheduled', 'failed', 'cancelled'])

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      return NextResponse.json({ ok: true })
    }

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .insert({ ...patch, user_id: session.userId, tenant_id: session.tenantId })
      .select(SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Reported rather than refused: the customer may be posting to four
    // networks and only one is fussy, and they can shorten it or drop that
    // one. Refusing would make them guess which.
    const { data: chosen } = await supabaseAdmin
      .from('social_connections')
      .select('platform')
      .in('id', connectionIds)

    const problems = captionProblems(
      caption,
      ((chosen ?? []) as { platform: string }[]).map((row) => row.platform)
    )

    return NextResponse.json({ ok: true, post: data, problems })
  }

  const id = String(body?.id ?? '')

  if (action === 'cancel' || action === 'reschedule') {
    const patch: Record<string, unknown> =
      action === 'cancel'
        ? { status: 'cancelled' }
        : { status: 'scheduled', attempts: 0, error: null }

    const { error } = await supabaseAdmin
      .from('scheduled_posts')
      .update(patch)
      .eq('id', id)
      .eq('user_id', session.userId)
      .neq('status', 'posted')

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  await supabaseAdmin
    .from('scheduled_posts')
    .delete()
    .eq('id', request.nextUrl.searchParams.get('id') ?? '')
    .eq('user_id', session.userId)

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
