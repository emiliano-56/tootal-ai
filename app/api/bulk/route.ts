import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { parseIdeas, progressOf, type BulkItem } from '@/lib/bulk/queue'

/**
 * Bulk generation jobs.
 *
 * Creating and steering only — the work itself is done by the cron worker, so
 * a bug here cannot generate anything unexpectedly.
 */

const JOB_SELECT =
  'id, name, kind, preset_id, settings, status, total, done, failed, started_at, finished_at, error, created_at'

const ITEM_SELECT =
  'id, position, idea, title, status, attempts, library_item_id, project_id, error, started_at, finished_at'

export async function GET(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const jobId = request.nextUrl.searchParams.get('job')

  if (jobId) {
    const [{ data: job }, { data: items }] = await Promise.all([
      supabaseAdmin
        .from('bulk_jobs')
        .select(JOB_SELECT)
        .eq('id', jobId)
        .eq('user_id', session.userId)
        .maybeSingle(),
      supabaseAdmin.from('bulk_items').select(ITEM_SELECT).eq('job_id', jobId).order('position'),
    ])

    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(
      {
        job,
        items: items ?? [],
        progress: progressOf(((items ?? []) as unknown as BulkItem[]) ?? []),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('bulk_jobs')
    .select(JOB_SELECT)
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ jobs: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = String(body?.action ?? 'create')

  if (action === 'create') {
    const parsed = parseIdeas(String(body?.ideas ?? ''))

    if (parsed.ideas.length === 0) {
      return NextResponse.json(
        { error: 'No usable ideas in that list', problems: parsed.problems },
        { status: 400 }
      )
    }

    const { data: job, error } = await supabaseAdmin
      .from('bulk_jobs')
      .insert({
        user_id: session.userId,
        tenant_id: session.tenantId,
        name: String(body?.name ?? '').trim().slice(0, 200) || `${parsed.ideas.length} ideas`,
        kind: String(body?.kind ?? 'comic'),
        preset_id: body?.presetId ?? null,
        settings: typeof body?.settings === 'object' && body.settings ? body.settings : {},
        total: parsed.ideas.length,
        // Queued rather than running: the worker decides when to start, so a
        // job created while the scheduler is down is picked up later rather
        // than sitting in a state nothing owns.
        status: 'queued',
      })
      .select(JOB_SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const created = job as { id: string }

    const { error: itemError } = await supabaseAdmin.from('bulk_items').insert(
      parsed.ideas.map((idea, index) => ({
        job_id: created.id,
        position: index + 1,
        idea,
      }))
    )

    if (itemError) {
      // A job with no items would sit in the queue forever looking like work.
      await supabaseAdmin.from('bulk_jobs').delete().eq('id', created.id)

      return NextResponse.json({ error: itemError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, job, problems: parsed.problems })
  }

  const id = String(body?.id ?? '')

  const { data: existing } = await supabaseAdmin
    .from('bulk_jobs')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', session.userId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'pause' || action === 'resume' || action === 'cancel') {
    const status =
      action === 'pause' ? 'paused' : action === 'cancel' ? 'cancelled' : 'queued'

    const { error } = await supabaseAdmin
      .from('bulk_jobs')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      // A finished job cannot be resumed into existence.
      .not('status', 'in', '("done","failed")')

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  // Items cascade.
  await supabaseAdmin
    .from('bulk_jobs')
    .delete()
    .eq('id', request.nextUrl.searchParams.get('id') ?? '')
    .eq('user_id', session.userId)

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
