import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext, PLATFORM_TENANT_ID } from '@/lib/supabase/server'
import { can, canCreateRole, type Role } from '@/lib/auth/rbac'
import { checkSeatAvailable, isValidLicenceTier } from '@/lib/services/licences'

/**
 * Account management for all three consoles.
 *
 * This route holds the service-role client, which bypasses every RLS policy,
 * so it re-establishes the caller's identity and re-checks every rule itself.
 * The database trigger in 002 enforces the same hierarchy and seat limits a
 * second time — this layer exists to return a readable error, not to be the
 * only thing standing in the way.
 */

interface Actor {
  userId: string
  role: Role
  tenantId: string
}

async function requireActor(permission: Parameters<typeof can>[1]) {
  const session = await getSessionContext()

  if (!session) {
    return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  }

  if (session.status === 'suspended') {
    return { error: NextResponse.json({ error: 'Account suspended' }, { status: 403 }) }
  }

  if (!can(session.role, permission)) {
    return { error: NextResponse.json({ error: 'Not authorised' }, { status: 403 }) }
  }

  return { actor: { userId: session.userId, role: session.role, tenantId: session.tenantId } as Actor }
}

async function writeAudit(actor: Actor, action: string, targetId: string, metadata: object = {}) {
  // Never let an audit failure roll back the action it describes.
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: actor.userId,
    actor_role: actor.role,
    tenant_id: actor.tenantId,
    action,
    target_type: 'profile',
    target_id: targetId,
    metadata,
  })

  if (error) console.error('[audit] write failed:', error.message)
}

/** Confirm the target sits inside the caller's reach before touching it. */
async function loadTarget(actor: Actor, targetId: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, tenant_id, status')
    .eq('id', targetId)
    .maybeSingle()

  if (!data) return { error: 'Account not found' as const }

  if (actor.role !== 'superadmin') {
    if (data.tenant_id !== actor.tenantId) return { error: 'Account not found' as const }

    // A tenant admin manages plain users, never another admin.
    if (data.role !== 'user') return { error: 'Not authorised' as const }
  }

  return { target: data }
}

// ---------------------------------------------------------------------------
//  POST — create an account
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { actor, error } = await requireActor('users.create')
  if (error) return error

  const body = await request.json().catch(() => null)

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const role: Role = body.role ?? 'user'

  if (!canCreateRole(actor!.role, role)) {
    return NextResponse.json(
      { error: `A ${actor!.role} cannot create ${role} accounts` },
      { status: 403 }
    )
  }

  if (String(body.password).length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Resellers and white labels own a tenant of their own; plain users join the
  // creator's tenant.
  let tenantId = actor!.tenantId

  if (role === 'reseller' || role === 'white_label') {
    const seats = Number(body.seatLimit)

    if (!isValidLicenceTier(role === 'reseller' ? 'reseller' : 'white_label', seats)) {
      return NextResponse.json(
        { error: 'Choose a valid licence tier for this account type' },
        { status: 400 }
      )
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        type: role === 'reseller' ? 'reseller' : 'white_label',
        name: body.tenantName || body.email,
        seat_limit: seats,
      })
      .select('id')
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: tenantError?.message ?? 'Could not create tenant' },
        { status: 400 }
      )
    }

    tenantId = tenant.id
  } else {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'user')

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('seat_limit')
      .eq('id', tenantId)
      .maybeSingle()

    const seatCheck = checkSeatAvailable({ limit: tenant?.seat_limit ?? null, used: count ?? 0 })

    if (!seatCheck.allowed) {
      return NextResponse.json({ error: seatCheck.reason }, { status: 409 })
    }
  }

  const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  })

  if (authError || !created?.user) {
    return NextResponse.json({ error: authError?.message ?? 'Could not create login' }, { status: 400 })
  }

  // Upsert, not insert: this project has a trigger on auth.users that already
  // creates a profiles row, and a plain insert collides with it. Upserting
  // works whether or not that trigger is present, and fills in the tenancy
  // fields the trigger knows nothing about.
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
    {
      id: created.user.id,
      email: body.email,
      username: body.username ?? String(body.email).split('@')[0],
      role,
      tenant_id: tenantId,
      created_by: actor!.userId,
        plans: body.plan ?? 'free',
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    // Roll back the login so a failed profile insert does not strand an
    // account that can authenticate but has no record.
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)

    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  if (role === 'reseller' || role === 'white_label') {
    await supabaseAdmin.from('tenants').update({ owner_id: created.user.id }).eq('id', tenantId)
  }

  await writeAudit(actor!, 'account.create', created.user.id, { email: body.email, role })

  return NextResponse.json({ id: created.user.id, email: body.email, role })
}

// ---------------------------------------------------------------------------
//  PATCH — suspend, reactivate, adjust credits, reset password
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body?.id || !body?.action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
  }

  const permission = body.action === 'password' ? 'users.reset_password' : 'users.suspend'

  const { actor, error } = await requireActor(permission)
  if (error) return error

  const { target, error: targetError } = await loadTarget(actor!, body.id)

  if (targetError) {
    return NextResponse.json({ error: targetError }, { status: targetError === 'Not authorised' ? 403 : 404 })
  }

  if (target!.id === actor!.userId) {
    return NextResponse.json({ error: 'You cannot do that to your own account' }, { status: 400 })
  }

  switch (body.action) {
    case 'suspend':
    case 'activate': {
      const suspending = body.action === 'suspend'

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          status: suspending ? 'suspended' : 'active',
          suspended_at: suspending ? new Date().toISOString() : null,
        })
        .eq('id', target!.id)

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

      await writeAudit(actor!, `account.${body.action}`, target!.id, { email: target!.email })
      break
    }

    case 'password': {
      if (!body.password || String(body.password).length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(target!.id, {
        password: body.password,
      })

      if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

      // The new password itself is never written to the audit trail.
      await writeAudit(actor!, 'account.password_reset', target!.id, { email: target!.email })
      break
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
//  DELETE — remove an account
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const { actor, error } = await requireActor('users.delete')
  if (error) return error

  const id = new URL(request.url).searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  if (id === actor!.userId) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const { target, error: targetError } = await loadTarget(actor!, id)

  if (targetError) {
    return NextResponse.json({ error: targetError }, { status: targetError === 'Not authorised' ? 403 : 404 })
  }

  // A reseller or white-label owner is referenced by tenants.owner_id, which is
  // ON DELETE RESTRICT — deleting the profile fails until that link is broken.
  const { data: ownedTenant } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('owner_id', target!.id)
    .maybeSingle()

  if (ownedTenant) {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ownedTenant.id)
      .neq('id', target!.id)

    // Removing an owner while their users remain would orphan those accounts
    // with nobody able to administer them.
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error: `This account still has ${count} user${count === 1 ? '' : 's'} under it. Delete or move them first.`,
        },
        { status: 409 }
      )
    }

    await supabaseAdmin.from('tenants').update({ owner_id: null }).eq('id', ownedTenant.id)
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(target!.id)

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', target!.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  // An empty tenant left behind serves no purpose.
  if (ownedTenant) {
    await supabaseAdmin.from('tenants').delete().eq('id', ownedTenant.id)
  }

  await writeAudit(actor!, 'account.delete', target!.id, {
    email: target!.email,
    role: target!.role,
  })

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
