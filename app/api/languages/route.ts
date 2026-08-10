import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { entitlementsFor } from '@/lib/plans/server'
import { allowedLanguages, LANGUAGES } from '@/lib/i18n/languages'

/**
 * Which languages this account may generate in.
 *
 * Read from the plans it holds, so the picker never offers something the
 * generator would then refuse. A superadmin is not on a plan and gets
 * everything — the console is not a product tier.
 */

export async function GET() {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const all = LANGUAGES.map((entry) => entry.code)

  if (session.role === 'superadmin') return NextResponse.json({ allowed: all })

  const { plans } = await entitlementsFor(session.userId)

  if (plans.length === 0) return NextResponse.json({ allowed: all })

  const { data } = await supabaseAdmin
    .from('plans')
    .select('languages')
    .in('code', plans.map((plan) => plan.code))

  return NextResponse.json({
    allowed: allowedLanguages(((data ?? []) as { languages: string[] }[]).map((row) => row.languages)),
  })
}

export const dynamic = 'force-dynamic'
