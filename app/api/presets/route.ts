import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'

/**
 * Saved style presets.
 *
 * Art style, audience and tone get retyped on every screen and every run.
 * Someone with a series has one house style and no way to say so, so book
 * four looks like a different publisher's.
 */

const SELECT = 'id, name, art_style, audience, tone, settings, is_default, times_used, created_at'

export async function GET() {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('style_presets')
    .select(SELECT)
    .eq('user_id', session.userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(
    { presets: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = String(body?.action ?? 'create')

  const fields = {
    name: String(body?.name ?? '').trim().slice(0, 120),
    art_style: String(body?.artStyle ?? '').trim().slice(0, 300),
    audience: String(body?.audience ?? '').trim().slice(0, 200),
    tone: String(body?.tone ?? '').trim().slice(0, 200),
    settings: typeof body?.settings === 'object' && body.settings !== null ? body.settings : {},
  }

  if (action === 'create' || action === 'update') {
    if (!fields.name) return NextResponse.json({ error: 'A name is required' }, { status: 400 })

    if (action === 'update') {
      const { error } = await supabaseAdmin
        .from('style_presets')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', String(body?.id ?? ''))
        .eq('user_id', session.userId)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      return NextResponse.json({ ok: true })
    }

    const { data, error } = await supabaseAdmin
      .from('style_presets')
      .insert({ ...fields, user_id: session.userId, tenant_id: session.tenantId })
      .select(SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, preset: data })
  }

  if (action === 'default') {
    // Cleared first, because the database has a unique index allowing one
    // default per account — setting a second without clearing the first is
    // refused outright rather than silently leaving two.
    await supabaseAdmin
      .from('style_presets')
      .update({ is_default: false })
      .eq('user_id', session.userId)
      .eq('is_default', true)

    const { error } = await supabaseAdmin
      .from('style_presets')
      .update({ is_default: true })
      .eq('id', String(body?.id ?? ''))
      .eq('user_id', session.userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  }

  if (action === 'used') {
    const { data } = await supabaseAdmin
      .from('style_presets')
      .select('times_used')
      .eq('id', String(body?.id ?? ''))
      .eq('user_id', session.userId)
      .maybeSingle()

    await supabaseAdmin
      .from('style_presets')
      .update({ times_used: ((data as { times_used: number } | null)?.times_used ?? 0) + 1 })
      .eq('id', String(body?.id ?? ''))
      .eq('user_id', session.userId)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  await supabaseAdmin
    .from('style_presets')
    .delete()
    .eq('id', request.nextUrl.searchParams.get('id') ?? '')
    .eq('user_id', session.userId)

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
