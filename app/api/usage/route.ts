import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/supabase/server'
import { entitlementsFor, consumeFeature, checkFeature } from '@/lib/plans/server'
import { FEATURE_KEYS } from '@/lib/plans/entitlements'

/**
 * Monthly allowance: what is left, and spending one.
 *
 * Replaces the old credit balance. Counting happens server-side because a
 * browser-side decrement is advisory only — anyone could skip it.
 */

export async function GET() {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const entitlements = await entitlementsFor(session.userId)

  return NextResponse.json(entitlements)
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const feature = String(body?.feature ?? '')

  if (!FEATURE_KEYS.includes(feature as never)) {
    return NextResponse.json({ error: 'Unknown feature' }, { status: 400 })
  }

  // `check` answers without spending, for enabling or disabling a button.
  if (body?.mode === 'check') {
    const entitlement = await checkFeature(session.userId, feature)

    return NextResponse.json({ ok: entitlement.allowed, entitlement })
  }

  const result = await consumeFeature(session.userId, feature)

  return NextResponse.json(result, { status: result.ok ? 200 : 402 })
}

export const dynamic = 'force-dynamic'
