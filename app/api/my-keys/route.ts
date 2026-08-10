import { NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/supabase/server'
import { policyInputFor } from '@/lib/ai/policy.server'
import { canUsePersonalKeys, describePolicy, effectivePolicy } from '@/lib/ai/policy'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Whether this account may bring its own AI key, and whether it has.
 *
 * The policy is resolved server-side because the settings behind it are not
 * readable by a customer — `platform_settings` is superadmin-only, and it
 * should stay that way. The client needs the answer, not the inputs.
 *
 * Keys themselves are never returned. The rows belong to the customer and RLS
 * would allow it, but there is no screen that needs a key rendered back, and
 * the ones that do it end up in screenshots.
 */

export async function GET() {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const input = await policyInputFor(session.userId, session.apiPolicy)

  const { data } = await supabaseAdmin
    .from('api_credentials')
    .select('id, provider, label, enabled, last_test_ok, created_at')
    .eq('scope', 'user')
    .eq('owner_id', session.userId)
    .order('created_at')

  const keys = (data ?? []) as { id: string; provider: string }[]

  return NextResponse.json({
    allowed: canUsePersonalKeys(input),
    policy: effectivePolicy(input),
    explanation: describePolicy(input, keys.length > 0),
    keys,
  })
}

export const dynamic = 'force-dynamic'
