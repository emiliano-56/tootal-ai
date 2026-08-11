import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { VERSION_LIMIT, type Snapshot } from '@/lib/projects/versions'

/**
 * Version history for a comic in progress.
 *
 * Snapshots carry no images — see lib/projects/versions.ts for why — so a row
 * here is small and saving one is cheap enough to do on every meaningful edit.
 */

const SELECT = 'id, label, note, panel_count, created_at'

export async function GET(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const subjectId = request.nextUrl.searchParams.get('subject') ?? ''
  const kind = request.nextUrl.searchParams.get('kind') ?? 'comic'

  if (!subjectId) return NextResponse.json({ error: 'Which project?' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('project_versions')
    .select(SELECT)
    .eq('user_id', session.userId)
    .eq('subject_kind', kind)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })
    .limit(VERSION_LIMIT)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(
    { versions: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)

  // ---- fetch one back -----------------------------------------------------
  if (body?.action === 'restore') {
    const { data } = await supabaseAdmin
      .from('project_versions')
      .select('id, label, snapshot')
      .eq('id', String(body?.id ?? ''))
      .eq('user_id', session.userId)
      .maybeSingle()

    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ok: true, version: data })
  }

  // ---- save one -----------------------------------------------------------
  const snapshot = body?.snapshot as Snapshot | undefined
  const subjectId = String(body?.subjectId ?? '').trim()

  if (!snapshot || !Array.isArray(snapshot.panels)) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  }

  if (!subjectId) return NextResponse.json({ error: 'Which project?' }, { status: 400 })

  const kind = String(body?.kind ?? 'comic')

  const { data, error } = await supabaseAdmin
    .from('project_versions')
    .insert({
      user_id: session.userId,
      subject_kind: kind,
      subject_id: subjectId.slice(0, 200),
      label: String(body?.label ?? '').slice(0, 200),
      note: String(body?.note ?? '').slice(0, 500),
      snapshot,
      panel_count: snapshot.panels.length,
    })
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Trimmed after the insert rather than before: the newest version is the
  // one worth keeping, so the oldest goes only once the new one is safe.
  const { data: extra } = await supabaseAdmin
    .from('project_versions')
    .select('id')
    .eq('user_id', session.userId)
    .eq('subject_kind', kind)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })
    .range(VERSION_LIMIT, VERSION_LIMIT + 50)

  const stale = ((extra ?? []) as { id: string }[]).map((row) => row.id)

  if (stale.length > 0) {
    await supabaseAdmin.from('project_versions').delete().in('id', stale)
  }

  return NextResponse.json({ ok: true, version: data })
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  await supabaseAdmin
    .from('project_versions')
    .delete()
    .eq('id', request.nextUrl.searchParams.get('id') ?? '')
    .eq('user_id', session.userId)

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
