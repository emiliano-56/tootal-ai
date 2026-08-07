import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { can } from '@/lib/auth/rbac'
import { verifyDomain, txtRecordName } from '@/lib/domains/verify'
import { rateLimit } from '@/lib/security/guards'
import { siteUrl } from '@/lib/settings/site-url.server'

/**
 * Domain verification.
 *
 * Runs real DNS lookups, so it lives in a route handler rather than the
 * browser: `node:dns` is not available client-side, and a client-reported
 * "verified" would be trivially forged.
 */

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  if (!can(session.role, 'domains.manage') && !can(session.role, 'domains.approve')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)

  if (body?.action !== 'verify' || !body?.id) {
    return NextResponse.json({ error: 'action and id are required' }, { status: 400 })
  }

  // DNS lookups are cheap but not free, and users hammer a verify button while
  // waiting for propagation.
  const limit = rateLimit(`domain-verify:${session.userId}`, { limit: 20, windowMs: 60_000 })

  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many checks. Wait ${limit.retryAfter}s — DNS changes take minutes anyway.` },
      { status: 429 }
    )
  }

  const { data: domain } = await supabaseAdmin
    .from('custom_domains')
    .select('id, domain, verification_token, tenant_id, verified')
    .eq('id', body.id)
    .maybeSingle()

  if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })

  // A tenant admin may only verify their own domains.
  if (session.role !== 'superadmin' && domain.tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
  }

  // The CNAME must point at the platform's own hostname — the configured Site
  // URL, not this request's host. Behind a reverse proxy that does not rewrite
  // the host header, the header says `localhost`, and every customer would be
  // told to point their domain at it and then watch verification fail forever.
  const configured = await siteUrl('')
  const target =
    (configured ? new URL(configured).host : '') ||
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    ''

  const result = await verifyDomain(
    domain.domain as string,
    domain.verification_token as string,
    target
  )

  await supabaseAdmin
    .from('custom_domains')
    .update({
      verified: result.verified,
      last_checked_at: new Date().toISOString(),
      verified_at: result.verified ? new Date().toISOString() : null,
      status: result.verified ? 'active' : 'verifying',
    })
    .eq('id', domain.id)

  if (result.verified && !domain.verified) {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: session.userId,
      actor_role: session.role,
      tenant_id: domain.tenant_id as string,
      action: 'domain.verified',
      target_type: 'custom_domain',
      target_id: domain.id as string,
      metadata: { domain: domain.domain },
    })
  }

  return NextResponse.json({
    ...result,
    expectedTarget: target,
    txtName: txtRecordName(domain.domain as string),
  })
}

export const dynamic = 'force-dynamic'
