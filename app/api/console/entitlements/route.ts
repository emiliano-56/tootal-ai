import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { can } from '@/lib/auth/rbac'
import { canGrantPlan, dependentsOf, FEATURE_KEYS, type Plan } from '@/lib/plans/entitlements'
import { syncAccountRole, type PlanWithRole } from '@/lib/plans/promote'

/**
 * Granting tiers and extra allowances to one account.
 *
 * The tiers are sold in order, so granting OTO 2 to someone without OTO 1 is
 * refused here as well as by the database trigger. Revoking works the other
 * way: taking OTO 1 away also takes everything above it, because leaving a
 * gap is the state the chain exists to prevent.
 */

export async function loadCatalogue(): Promise<PlanWithRole[]> {
  const { data } = await supabaseAdmin
    .from('plans')
    .select('id, code, name, is_bundle, includes, requires, grants_role, tier, seats')
    .order('sort_order')

  return (data ?? []).map((row) => {
    const plan = row as {
      id: string
      code: string
      name: string
      is_bundle: boolean
      includes: string[]
      requires: string | null
      grants_role: string | null
      tier: string | null
      seats: number | null
    }

    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      isBundle: plan.is_bundle,
      includes: plan.includes ?? [],
      requires: plan.requires,
      grantsRole: (plan.grants_role as PlanWithRole['grantsRole']) ?? null,
      tier: plan.tier ?? plan.code,
      seats: plan.seats,
      features: {},
    }
  })
}

async function ownedCodes(userId: string, catalogue: PlanWithRole[]): Promise<string[]> {
  const { data } = await supabaseAdmin.from('user_plans').select('plan_id').eq('user_id', userId)

  const ids = new Set((data ?? []).map((row) => (row as { plan_id: string }).plan_id))

  return catalogue.filter((plan) => ids.has(plan.id)).map((plan) => plan.code)
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  // Tiers and extras are commercial decisions, so they stay with the platform
  // owner rather than the tenant admins who resell it.
  if (!can(session.role, 'plans.manage')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)

  if (!body?.action || !body?.userId) {
    return NextResponse.json({ error: 'action and userId are required' }, { status: 400 })
  }

  const catalogue = await loadCatalogue()
  const owned = await ownedCodes(body.userId, catalogue)

  // ---- grant a tier
  if (body.action === 'grant') {
    const plan = catalogue.find((candidate) => candidate.code === body.code)

    if (!plan) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })

    const check = canGrantPlan(plan, owned, catalogue)

    if (!check.allowed) {
      return NextResponse.json({ error: check.reason, missing: check.missing }, { status: 409 })
    }

    const { error } = await supabaseAdmin
      .from('user_plans')
      .insert({ user_id: body.userId, plan_id: plan.id, granted_by: session.userId })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Changing licence size swaps the two products; the database trigger has
    // already removed the old one, so it must go from the list here too.
    const held = [...owned.filter((code) => code !== check.replaces), plan.code]

    // A tier that sells an account type has to actually produce one.
    const promotion = await syncAccountRole(body.userId, catalogue, held)

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: session.userId,
      actor_role: session.role,
      tenant_id: session.tenantId,
      action: 'plan.grant',
      target_type: 'profile',
      target_id: body.userId,
      metadata: { plan: plan.code, replaced: check.replaces ?? null, promotion },
    })

    return NextResponse.json({
      ok: true,
      granted: [plan.code],
      replaced: check.replaces ?? null,
      promotion,
    })
  }

  // ---- revoke a tier, and everything that depends on it
  if (body.action === 'revoke') {
    const plan = catalogue.find((candidate) => candidate.code === body.code)

    if (!plan) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })

    const alsoRemoved = plan.isBundle ? [] : dependentsOf(plan.code, catalogue).filter((code) => owned.includes(code))
    const codes = [plan.code, ...alsoRemoved]

    const ids = catalogue.filter((candidate) => codes.includes(candidate.code)).map((c) => c.id)

    const { error } = await supabaseAdmin
      .from('user_plans')
      .delete()
      .eq('user_id', body.userId)
      .in('plan_id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Losing the tier has to take the account type with it, or a former
    // reseller keeps a console they no longer pay for.
    const promotion = await syncAccountRole(
      body.userId,
      catalogue,
      owned.filter((code) => !codes.includes(code))
    )

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: session.userId,
      actor_role: session.role,
      tenant_id: session.tenantId,
      action: 'plan.revoke',
      target_type: 'profile',
      target_id: body.userId,
      metadata: { plans: codes, promotion },
    })

    return NextResponse.json({ ok: true, revoked: codes, promotion })
  }

  // ---- set how many extra items this account may KEEP
  if (body.action === 'grant_library') {
    const feature = String(body.feature ?? '')
    const extra = Number(body.extra)

    if (!FEATURE_KEYS.includes(feature as never)) {
      return NextResponse.json({ error: 'Unknown feature' }, { status: 400 })
    }

    if (!Number.isFinite(extra) || extra < 0) {
      return NextResponse.json({ error: 'Extra must be zero or more' }, { status: 400 })
    }

    // Upsert rather than delete-on-zero: the same row may still carry a
    // monthly grant, which clearing the library one must not take with it.
    const { error } = await supabaseAdmin.from('user_feature_grants').upsert(
      {
        user_id: body.userId,
        feature,
        extra_library: extra,
        granted_by: session.userId,
      },
      { onConflict: 'user_id,feature' }
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: session.userId,
      actor_role: session.role,
      tenant_id: session.tenantId,
      action: 'plan.extra_library',
      target_type: 'profile',
      target_id: body.userId,
      metadata: { feature, extra },
    })

    return NextResponse.json({ ok: true })
  }

  // ---- set an extra monthly allowance for one feature
  if (body.action === 'grant_extra') {
    const feature = String(body.feature ?? '')
    const extra = Number(body.extra)

    if (!FEATURE_KEYS.includes(feature as never)) {
      return NextResponse.json({ error: 'Unknown feature' }, { status: 400 })
    }

    if (!Number.isFinite(extra) || extra < 0) {
      return NextResponse.json({ error: 'Extra must be zero or more' }, { status: 400 })
    }

    // Zero means "remove the extra" rather than storing a pointless row.
    if (extra === 0) {
      await supabaseAdmin
        .from('user_feature_grants')
        .delete()
        .eq('user_id', body.userId)
        .eq('feature', feature)
    } else {
      const { error } = await supabaseAdmin.from('user_feature_grants').upsert(
        {
          user_id: body.userId,
          feature,
          extra_monthly: extra,
          note: body.note ?? null,
          granted_by: session.userId,
        },
        { onConflict: 'user_id,feature' }
      )

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: session.userId,
      actor_role: session.role,
      tenant_id: session.tenantId,
      action: 'plan.extra_allowance',
      target_type: 'profile',
      target_id: body.userId,
      metadata: { feature, extra },
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export const dynamic = 'force-dynamic'
