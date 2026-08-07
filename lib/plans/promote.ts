import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { PLATFORM_TENANT_ID } from '@/lib/supabase/server'
import { roleFromPlans, seatBreakdown, type PlanWithRole } from '@/lib/plans/roles'
import type { Role } from '@/lib/auth/rbac'

export { roleFromPlans, seatBreakdown } from '@/lib/plans/roles'
export type { PlanWithRole } from '@/lib/plans/roles'

/**
 * Turning a purchase into an account type.
 *
 * OTO 4 sells a reseller licence and OTO 5 a white-label one, so buying either
 * has to actually produce that account — a tenant of their own, the matching
 * role, and the seats the licence includes. Without this the tier is a row in a
 * table that changes nothing.
 *
 * The seat count comes from the licences held rather than from the caller: the
 * customer bought a named product, and the console should not be able to hand
 * out a different number by accident.
 */

export interface PromotionResult {
  changed: boolean
  role?: Role
  tenantId?: string
  seats?: number | null
  /** "150 reseller + 25 white label" */
  breakdown?: string
  note?: string
}

/**
 * Bring an account's role, tenant and seat limit in line with what it owns.
 *
 * Called after any grant or revoke, so the two can never drift: a reseller who
 * loses OTO 4 goes back to being an ordinary user, and their tenant is removed
 * once it is empty.
 */
export async function syncAccountRole(
  userId: string,
  catalogue: PlanWithRole[],
  ownedCodes: string[]
): Promise<PromotionResult> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, tenant_id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return { changed: false, note: 'Account not found' }

  // Never touch a superadmin: the console is not a product tier.
  if (profile.role === 'superadmin') return { changed: false, note: 'Superadmin left as is' }

  const { role: wanted, licences, seats } = roleFromPlans(ownedCodes, catalogue)
  const breakdown = seatBreakdown(licences)

  // ---- nothing entitles them to an account type any more
  if (!wanted) {
    if (profile.role === 'user') return { changed: false }

    const oldTenant = profile.tenant_id as string

    await supabaseAdmin
      .from('profiles')
      .update({ role: 'user', tenant_id: PLATFORM_TENANT_ID })
      .eq('id', userId)

    // Their tenant only goes if nobody else is left inside it.
    if (oldTenant && oldTenant !== PLATFORM_TENANT_ID) {
      await supabaseAdmin.from('tenants').update({ owner_id: null }).eq('id', oldTenant)

      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', oldTenant)

      if ((count ?? 0) === 0) {
        await supabaseAdmin.from('tenants').delete().eq('id', oldTenant)
      }
    }

    return { changed: true, role: 'user', note: 'Demoted — no tier grants an account type' }
  }

  const type = wanted === 'white_label' ? 'white_label' : 'reseller'

  // ---- upgrading, or changing licence size, on a tenant they already have
  if (profile.tenant_id && profile.tenant_id !== PLATFORM_TENANT_ID) {
    // Reseller → white label keeps the same tenant, and with it their users.
    await supabaseAdmin
      .from('tenants')
      .update({ type, seat_limit: seats })
      .eq('id', profile.tenant_id as string)

    const changed = profile.role !== wanted

    if (changed) {
      await supabaseAdmin.from('profiles').update({ role: wanted }).eq('id', userId)
    }

    return {
      changed,
      role: wanted,
      tenantId: profile.tenant_id as string,
      seats,
      breakdown,
    }
  }

  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .insert({
      type,
      name: (profile.email as string) ?? 'New tenant',
      seat_limit: seats,
      owner_id: userId,
    })
    .select('id')
    .single()

  if (error || !tenant) {
    return { changed: false, note: error?.message ?? 'Could not create the tenant' }
  }

  await supabaseAdmin
    .from('profiles')
    .update({ role: wanted, tenant_id: tenant.id })
    .eq('id', userId)

  return { changed: true, role: wanted, tenantId: tenant.id as string, seats, breakdown }
}
