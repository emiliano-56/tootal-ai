import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { can } from '@/lib/auth/rbac'
import { sendMail, verifySmtp } from '@/lib/mail/mailer'
import { renderTemplate, htmlToText } from '@/lib/services/templates'
import { rateLimit } from '@/lib/security/guards'

/**
 * Mail operations: verify a server, send a test, run a broadcast.
 *
 * Broadcasts are sent in sequence with the counters written as they go, so a
 * run that dies halfway leaves an accurate record rather than a row claiming
 * it finished.
 */

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)

  if (!body?.action) return NextResponse.json({ error: 'action is required' }, { status: 400 })

  // ---- verify an SMTP server
  if (body.action === 'verify') {
    if (!can(session.role, 'smtp.manage')) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    const result = await verifySmtp(body.id)

    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }

  // ---- send a test message
  if (body.action === 'test') {
    if (!can(session.role, 'smtp.manage')) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    // A test button is an open relay if it will mail anywhere on demand.
    const limit = rateLimit(`mail-test:${session.userId}`, { limit: 5, windowMs: 60 * 60 * 1000 })

    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many test emails. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.` },
        { status: 429 }
      )
    }

    const to = body.to || session.email

    if (!to) return NextResponse.json({ error: 'No recipient address.' }, { status: 400 })

    const result = await sendMail({
      to,
      subject: 'ComicTale AI — test message',
      html: '<p>This is a test from your ComicTale AI console.</p><p>If you are reading it, the mail server works.</p>',
      tenantId: session.tenantId,
    })

    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }

  // ---- run a queued broadcast
  if (body.action === 'send_broadcast') {
    if (!can(session.role, 'leads.manage')) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    const { data: broadcast } = await supabaseAdmin
      .from('email_broadcasts')
      .select('id, subject, body_html, audience, status, tenant_id')
      .eq('id', body.id)
      .maybeSingle()

    if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })

    if (session.role !== 'superadmin' && broadcast.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
    }

    if (broadcast.status === 'sent') {
      return NextResponse.json({ error: 'This broadcast has already been sent.' }, { status: 409 })
    }

    // Resolve the audience the same way the compose screen counted it.
    let query = supabaseAdmin.from('profiles').select('email, first_name, username')

    const role = (broadcast.audience as { role?: string })?.role

    if (role === 'user') query = query.eq('role', 'user')
    if (role === 'active') query = query.eq('status', 'active')
    if (role === 'suspended') query = query.eq('status', 'suspended')
    if (session.role !== 'superadmin') query = query.eq('tenant_id', session.tenantId)

    const { data: recipients } = await query

    const list = (recipients ?? []) as { email: string; first_name: string | null; username: string | null }[]

    await supabaseAdmin
      .from('email_broadcasts')
      .update({ status: 'pending', started_at: new Date().toISOString(), total_count: list.length })
      .eq('id', broadcast.id)

    let sent = 0
    let failed = 0

    for (const recipient of list) {
      if (!recipient.email) continue

      const context = {
        first_name: recipient.first_name ?? recipient.username ?? 'there',
        email: recipient.email,
        brand_name: 'ComicTale AI',
      }

      const subject = renderTemplate(broadcast.subject as string, context, { escape: false })
      const html = renderTemplate(broadcast.body_html as string, context)

      const result = await sendMail({
        to: recipient.email,
        subject: subject.output,
        html: html.output,
        text: htmlToText(html.output),
        tenantId: broadcast.tenant_id as string,
      })

      result.ok ? sent++ : failed++

      // Written every 10 so progress survives a crash mid-run.
      if ((sent + failed) % 10 === 0) {
        await supabaseAdmin
          .from('email_broadcasts')
          .update({ sent_count: sent, failed_count: failed })
          .eq('id', broadcast.id)
      }
    }

    await supabaseAdmin
      .from('email_broadcasts')
      .update({
        sent_count: sent,
        failed_count: failed,
        status: failed > 0 && sent === 0 ? 'failed' : 'sent',
        completed_at: new Date().toISOString(),
      })
      .eq('id', broadcast.id)

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: session.userId,
      actor_role: session.role,
      tenant_id: session.tenantId,
      action: 'broadcast.send',
      target_type: 'email_broadcast',
      target_id: broadcast.id as string,
      metadata: { sent, failed, total: list.length },
    })

    return NextResponse.json({ ok: true, sent, failed, total: list.length })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60
