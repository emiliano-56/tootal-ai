import 'server-only'

import { NextResponse } from 'next/server'
import { getSessionContext, type SessionContext } from '@/lib/supabase/server'
import { hasFeature } from '@/lib/plans/server'

/**
 * "Do they own the tier this screen belongs to?"
 *
 * The sidebar hides a locked tool and the page shows an upsell, but neither is
 * a control — the data still sits behind an API anyone can call directly. Every
 * route that serves a tier's content asks here first.
 *
 * Distinct from consuming an allowance: this asks whether the feature is
 * unlocked at all, and spends nothing.
 */

export interface GateResult {
  session: SessionContext
}

export async function requireFeature(
  feature: string
): Promise<{ error: NextResponse } | GateResult> {
  const session = await getSessionContext()

  if (!session) {
    return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  }

  // The platform owner works on every tier without owning any of them.
  if (session.role === 'superadmin') return { session }

  // Ownership, not remaining allowance: someone who has used all ten comics
  // this month still owns the comic tool.
  if (!(await hasFeature(session.userId, feature))) {
    return {
      error: NextResponse.json(
        { error: 'Not included in your plan', locked: true, feature },
        { status: 403 }
      ),
    }
  }

  return { session }
}
