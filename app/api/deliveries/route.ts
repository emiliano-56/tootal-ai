import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { makeToken, expiryFrom, preset, describeTerms } from '@/lib/delivery/links'
import { sendMail } from '@/lib/mail/mailer'
import { tenantSiteUrl } from '@/lib/settings/site-url.server'

/**
 * Delivery links the seller manages.
 *
 * The buyer's side is a separate, unauthenticated route. This one is entirely
 * about creating and revoking, and it holds the service-role client so every
 * read and write is scoped to the caller by hand.
 */

const SELECT =
  'id, token, title, message, filename, size_bytes, expires_at, max_downloads, downloads, sent_to, sent_at, revoked, created_at'

export async function GET() {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('deliveries')
    .select(SELECT)
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(
    { deliveries: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = String(body?.action ?? 'create')

  if (action === 'create') {
    const bucket = String(body?.bucket ?? '').trim()
    const path = String(body?.path ?? '').trim()

    if (!bucket || !path) {
      return NextResponse.json({ error: 'Choose a file to deliver' }, { status: 400 })
    }

    // The path has to be inside the caller's own folder. Without this check a
    // customer could mint a delivery link for somebody else's file, because
    // this route signs URLs with the service role.
    if (!path.startsWith(`${session.userId}/`)) {
      return NextResponse.json({ error: 'That file is not yours' }, { status: 403 })
    }

    const terms = preset(String(body?.preset ?? 'single'))

    // An explicit choice beats the preset; the preset is only a starting
    // point the form filled in.
    const days = body?.days === undefined ? terms.days : body.days === null ? null : Number(body.days)
    const maxDownloads =
      body?.maxDownloads === undefined
        ? terms.downloads
        : body.maxDownloads === null
          ? null
          : Math.max(1, Number(body.maxDownloads))

    const { data, error } = await supabaseAdmin
      .from('deliveries')
      .insert({
        user_id: session.userId,
        tenant_id: session.tenantId,
        token: makeToken(),
        title: String(body?.title ?? '').trim().slice(0, 200),
        message: String(body?.message ?? '').trim().slice(0, 1000),
        bucket,
        path,
        filename: String(body?.filename ?? 'download').slice(0, 200),
        size_bytes: Number(body?.sizeBytes) || null,
        expires_at: expiryFrom(days)?.toISOString() ?? null,
        max_downloads: maxDownloads,
      })
      .select(SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const origin = await tenantSiteUrl(session.tenantId, request.nextUrl.origin)
    const row = data as { token: string; title: string; message: string }

    return NextResponse.json({
      ok: true,
      delivery: data,
      url: `${origin.replace(/\/+$/, '')}/d/${row.token}`,
    })
  }

  const id = String(body?.id ?? '')

  const { data: existing } = await supabaseAdmin
    .from('deliveries')
    .select(SELECT)
    .eq('id', id)
    .eq('user_id', session.userId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const delivery = existing as { token: string; title: string; message: string; filename: string }

  if (action === 'revoke' || action === 'restore') {
    const { error } = await supabaseAdmin
      .from('deliveries')
      .update({ revoked: action === 'revoke' })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  }

  // ---- email it to the buyer ----------------------------------------------
  //
  // Goes out over whatever SMTP the account has configured — the platform's
  // for an ordinary customer, their own for a white label. `sendMail` already
  // resolves that from the tenant, so there is nothing to choose here.
  if (action === 'send') {
    const to = String(body?.to ?? '').trim()

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return NextResponse.json({ error: 'That does not look like an email address' }, { status: 400 })
    }

    const origin = await tenantSiteUrl(session.tenantId, request.nextUrl.origin)
    const url = `${origin.replace(/\/+$/, '')}/d/${delivery.token}`

    const result = await sendMail({
      to,
      subject: delivery.title || 'Your download is ready',
      html: `<p>${delivery.message || 'Thank you — your download is ready.'}</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Download ${delivery.filename}</a></p>
<p style="color:#64748b;font-size:13px">${describeTerms(existing as never)}</p>
<p style="color:#94a3b8;font-size:12px">If the button does not work, paste this into your browser:<br>${url}</p>`,
      tenantId: session.tenantId,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? 'Could not send that email. Check your SMTP settings.' },
        { status: 502 }
      )
    }

    await supabaseAdmin
      .from('deliveries')
      .update({ sent_to: to, sent_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id') ?? ''

  await supabaseAdmin.from('deliveries').delete().eq('id', id).eq('user_id', session.userId)

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
