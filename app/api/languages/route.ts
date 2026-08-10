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

// A cached answer here is invisible and wrong: the picker would offer whatever
// list the browser held from before a plan change, or from before the
// catalogue was extended — and the customer has no way to tell.
const NO_CACHE = { headers: { 'Cache-Control': 'no-store, max-age=0' } }

export async function GET() {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const all = LANGUAGES.map((entry) => entry.code)

  if (session.role === 'superadmin') return NextResponse.json({ allowed: all }, NO_CACHE)

  const { plans } = await entitlementsFor(session.userId)

  if (plans.length === 0) return NextResponse.json({ allowed: all }, NO_CACHE)

  const { data } = await supabaseAdmin
    .from('plans')
    .select('languages')
    .in('code', plans.map((plan) => plan.code))

  return NextResponse.json(
    {
      allowed: allowedLanguages(
        ((data ?? []) as { languages: string[] }[]).map((row) => row.languages)
      ),
    },
    NO_CACHE
  )
}

export const dynamic = 'force-dynamic'
