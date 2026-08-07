import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { can } from '@/lib/auth/rbac'
import { callbackUrl } from '@/lib/social/oauth'
import { siteUrl } from '@/lib/settings/site-url.server'

/**
 * The platform owner's developer apps.
 *
 * One set of credentials serves every customer: they sign in to their own
 * account through our app, so the client secret is ours and stays here. It is
 * never sent to a browser — the screen shows only whether one is set.
 */

async function requireSuperadmin() {
  const session = await getSessionContext()

  if (!session) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }

  if (!can(session.role, 'settings.manage')) {
    return { error: NextResponse.json({ error: 'Not authorised' }, { status: 403 }) }
  }

  return { session }
}

export async function GET(request: NextRequest) {
  const gate = await requireSuperadmin()

  if ('error' in gate) return gate.error

  const { data } = await supabaseAdmin.from('social_apps').select('*').order('platform')

  // This is pasted into the platform's own settings, where an exact match is
  // required — so it must be the configured address, not this request's.
  const origin = await siteUrl(request.nextUrl.origin)

  const [{ count: connections }, { count: posts }] = await Promise.all([
    supabaseAdmin.from('social_connections').select('id', { count: 'exact', head: true }).neq('status', 'revoked'),
    supabaseAdmin.from('social_posts').select('id', { count: 'exact', head: true }).eq('status', 'posted'),
  ])

  return NextResponse.json({
    apps: ((data ?? []) as Record<string, unknown>[]).map((app) => ({
      platform: app.platform,
      clientId: app.client_id ?? '',
      // Presence only. The secret has no business in a browser.
      hasSecret: Boolean(app.client_secret),
      enabled: app.enabled,
      // `extra` is a free-form bag that may hold platform secrets, so it stays
      // on the server. Nothing in the console reads it.
      // Shown so it can be pasted into the platform's own settings, where an
      // exact match is required or the whole flow fails at the last step.
      redirectUri: callbackUrl(origin, String(app.platform)),
    })),
    stats: { connections: connections ?? 0, posts: posts ?? 0 },
  })
}

export async function POST(request: NextRequest) {
  const gate = await requireSuperadmin()

  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  const platform = String(body?.platform ?? '')

  if (!platform) return NextResponse.json({ error: 'platform is required' }, { status: 400 })

  const patch: Record<string, unknown> = {}

  if (typeof body.clientId === 'string') patch.client_id = body.clientId.trim() || null

  // An empty string clears it; leaving the field out keeps what is stored, so
  // saving the form never wipes a secret the screen was never given.
  if (typeof body.clientSecret === 'string' && body.clientSecret.trim()) {
    patch.client_secret = body.clientSecret.trim()
  }

  if (body.clearSecret === true) patch.client_secret = null
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  }

  // Turning a platform on without credentials would offer customers a Connect
  // button that can only fail.
  if (patch.enabled === true) {
    const { data: current } = await supabaseAdmin
      .from('social_apps')
      .select('client_id, client_secret')
      .eq('platform', platform)
      .maybeSingle()

    const row = (current ?? {}) as { client_id?: string; client_secret?: string }
    const clientId = patch.client_id ?? row.client_id
    const secret = patch.client_secret ?? row.client_secret

    if (!clientId || !secret) {
      return NextResponse.json(
        { error: 'Add the client id and secret before switching this on.' },
        { status: 400 }
      )
    }
  }

  const { error } = await supabaseAdmin
    .from('social_apps')
    .update(patch)
    .eq('platform', platform)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: gate.session.userId,
    actor_role: gate.session.role,
    tenant_id: gate.session.tenantId,
    action: 'social.app',
    target_type: 'setting',
    metadata: { platform, changed: Object.keys(patch), secretChanged: 'client_secret' in patch },
  })

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
