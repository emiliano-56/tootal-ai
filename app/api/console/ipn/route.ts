import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { can } from '@/lib/auth/rbac'
import { loadIpnSettings, processIpn } from '@/lib/ipn/process'
import { siteUrl } from '@/lib/settings/site-url.server'

/**
 * IPN configuration.
 *
 * Behind `plans.manage` because mapping a product id to a tier is the same
 * decision as granting that tier by hand — it decides what a payment buys.
 *
 * The secret is never sent to the browser. The screen shows whether one is
 * set and lets it be replaced, which is all an operator needs.
 */

async function requireSuperadmin() {
  const session = await getSessionContext()

  if (!session) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }

  if (!can(session.role, 'plans.manage')) {
    return { error: NextResponse.json({ error: 'Not authorised' }, { status: 403 }) }
  }

  return { session }
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireSuperadmin()
  if (error) return error

  const [{ data: settings }, { data: plans }, { data: events }] = await Promise.all([
    supabaseAdmin.from('ipn_settings').select('*').limit(1).maybeSingle(),
    supabaseAdmin
      .from('plans')
      .select('id, code, name, tier, seats, is_bundle, ipn_product_id')
      .order('sort_order'),
    supabaseAdmin
      .from('ipn_events')
      .select('id, vendor, external_id, event_type, product_id, email, plan_code, status, message, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const row = settings as Record<string, unknown> | null

  const origin = await siteUrl(request.nextUrl.origin)

  return NextResponse.json({
    webhookBase: origin,
    settings: row
      ? {
          ...row,
          // Never leave the server. Presence is all the screen shows.
          secret: undefined,
          hasSecret: Boolean(row.secret),
        }
      : null,
    plans: plans ?? [],
    events: events ?? [],
    actor: session!.role,
  })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSuperadmin()
  if (error) return error

  const body = await request.json().catch(() => null)

  if (!body?.action) return NextResponse.json({ error: 'action is required' }, { status: 400 })

  // ---- map one product id onto one plan
  if (body.action === 'map') {
    const productId = String(body.productId ?? '').trim()

    if (!body.planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    // Two plans sharing a product id would make a purchase ambiguous, and the
    // unique index would reject it anyway — say so in words.
    if (productId) {
      const { data: clash } = await supabaseAdmin
        .from('plans')
        .select('name')
        .eq('ipn_product_id', productId)
        .neq('id', body.planId)
        .limit(1)
        .maybeSingle()

      if (clash) {
        return NextResponse.json(
          { error: `That product id is already mapped to ${(clash as { name: string }).name}.` },
          { status: 409 }
        )
      }
    }

    const { error: writeError } = await supabaseAdmin
      .from('plans')
      .update({ ipn_product_id: productId || null })
      .eq('id', body.planId)

    if (writeError) return NextResponse.json({ error: writeError.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  }

  // ---- vendor, secret, field names
  if (body.action === 'settings') {
    const patch: Record<string, unknown> = {}
    const text = ['vendor', 'field_email', 'field_name', 'field_product', 'field_transaction', 'field_event', 'welcome_template']

    for (const key of text) {
      if (typeof body[key] === 'string' && body[key].trim()) patch[key] = body[key].trim()
    }

    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled

    for (const key of ['sale_events', 'refund_events']) {
      if (Array.isArray(body[key])) {
        patch[key] = body[key].map((value: unknown) => String(value).trim()).filter(Boolean)
      }
    }

    // An empty string clears the secret; undefined leaves it alone, so saving
    // the form does not wipe a secret the screen never received.
    if (typeof body.secret === 'string') patch.secret = body.secret.trim() || null

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
    }

    const { error: writeError } = await supabaseAdmin
      .from('ipn_settings')
      .update(patch)
      .eq('id', true)

    if (writeError) return NextResponse.json({ error: writeError.message }, { status: 400 })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: session!.userId,
      actor_role: session!.role,
      tenant_id: session!.tenantId,
      action: 'ipn.settings',
      target_type: 'setting',
      metadata: { changed: Object.keys(patch), secretChanged: 'secret' in patch },
    })

    return NextResponse.json({ ok: true })
  }

  // ---- replay a stored payload
  if (body.action === 'replay') {
    const { data: stored } = await supabaseAdmin
      .from('ipn_events')
      .select('vendor, payload')
      .eq('id', body.eventId)
      .maybeSingle()

    if (!stored) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const settings = await loadIpnSettings()

    if (!settings) return NextResponse.json({ error: 'IPN is not set up' }, { status: 400 })

    const event = stored as { vendor: string; payload: Record<string, unknown> }
    const outcome = await processIpn(
      event.vendor,
      event.payload ?? {},
      settings,
      await siteUrl(request.nextUrl.origin)
    )

    return NextResponse.json({ ok: outcome.status !== 'failed', outcome })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export const dynamic = 'force-dynamic'
