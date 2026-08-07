import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { can } from '@/lib/auth/rbac'
import { getAdapter, pushToAll } from '@/lib/autoresponders/adapters'
import type { Connection } from '@/lib/autoresponders/types'

/**
 * Autoresponder operations that must run server-side.
 *
 * Provider APIs reject browser origins and the keys must never reach the
 * client, so verifying credentials, listing audiences and pushing subscribers
 * all happen here. Connection rows themselves are managed directly through
 * RLS — only the outbound calls need a server.
 */

async function requireTenantAdmin() {
  const session = await getSessionContext()

  if (!session) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }

  if (!can(session.role, 'leads.manage')) {
    return { error: NextResponse.json({ error: 'Not authorised' }, { status: 403 }) }
  }

  return { session }
}

/** Load a connection, refusing anything outside the caller's tenant. */
async function loadConnection(id: string, tenantId: string, isSuperadmin: boolean) {
  const { data } = await supabaseAdmin
    .from('autoresponder_connections')
    .select('id, provider, api_key, api_secret, list_id, extra, tenant_id')
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  if (!isSuperadmin && data.tenant_id !== tenantId) return null

  return data as {
    id: string
    provider: string
    api_key: string
    api_secret: string | null
    list_id: string | null
    extra: Record<string, unknown>
    tenant_id: string
  }
}

function toConnection(row: {
  provider: string
  api_key: string
  api_secret: string | null
  list_id: string | null
  extra: Record<string, unknown>
}): Connection {
  return {
    provider: row.provider as Connection['provider'],
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    listId: row.list_id,
    extra: row.extra,
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireTenantAdmin()
  if (error) return error

  const body = await request.json().catch(() => null)

  if (!body?.action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  const isSuperadmin = session!.role === 'superadmin'

  // ---- verify / lists: work on a saved connection, or on unsaved form values
  if (body.action === 'verify' || body.action === 'lists') {
    let connection: Connection

    if (body.id) {
      const row = await loadConnection(body.id, session!.tenantId, isSuperadmin)

      if (!row) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

      connection = toConnection(row)
    } else {
      if (!body.provider || !body.apiKey) {
        return NextResponse.json({ error: 'provider and apiKey are required' }, { status: 400 })
      }

      connection = {
        provider: body.provider,
        apiKey: body.apiKey,
        apiSecret: body.apiSecret ?? null,
        listId: body.listId ?? null,
      }
    }

    const adapter = getAdapter(connection.provider)

    if (!adapter) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

    if (body.action === 'lists') {
      const result = await adapter.lists(connection)

      return NextResponse.json(result, { status: result.ok ? 200 : 400 })
    }

    const result = await adapter.verify(connection)

    // Record the outcome so the table can show health without re-testing.
    if (body.id) {
      await supabaseAdmin
        .from('autoresponder_connections')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_ok: result.ok,
          last_error: result.ok ? null : (result.error ?? '').slice(0, 500),
        })
        .eq('id', body.id)
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }

  // ---- push: fan leads out to every enabled connection
  if (body.action === 'push') {
    const leadIds: string[] = Array.isArray(body.leadIds) ? body.leadIds : []

    if (leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds is required' }, { status: 400 })
    }

    // Cap the batch: each lead costs one HTTP call per connection.
    if (leadIds.length > 200) {
      return NextResponse.json(
        { error: 'Push at most 200 leads at a time.' },
        { status: 400 }
      )
    }

    let leadQuery = supabaseAdmin
      .from('leads')
      .select('id, email, first_name, last_name, phone, tags, tenant_id')
      .in('id', leadIds)

    if (!isSuperadmin) leadQuery = leadQuery.eq('tenant_id', session!.tenantId)

    const { data: leads } = await leadQuery

    let connQuery = supabaseAdmin
      .from('autoresponder_connections')
      .select('id, provider, api_key, api_secret, list_id, extra, tenant_id')
      .eq('enabled', true)

    if (!isSuperadmin) connQuery = connQuery.eq('tenant_id', session!.tenantId)

    const { data: connections } = await connQuery

    if (!connections || connections.length === 0) {
      return NextResponse.json({ error: 'No enabled autoresponder connections.' }, { status: 400 })
    }

    let sent = 0
    let failed = 0
    let skipped = 0

    for (const lead of leads ?? []) {
      const row = lead as {
        id: string
        email: string
        first_name: string | null
        last_name: string | null
        phone: string | null
        tags: string[]
      }

      const results = await pushToAll(
        connections.map((c) => ({
          id: (c as { id: string }).id,
          ...toConnection(c as never),
        })),
        {
          email: row.email,
          firstName: row.first_name ?? undefined,
          lastName: row.last_name ?? undefined,
          phone: row.phone ?? undefined,
          tags: row.tags,
        }
      )

      for (const { connectionId, result } of results) {
        if (result.ok) {
          result.alreadySubscribed ? skipped++ : sent++
        } else {
          failed++
        }

        // One row per (lead, connection) so a retry only touches what failed.
        await supabaseAdmin.from('lead_deliveries').upsert(
          {
            lead_id: row.id,
            connection_id: connectionId,
            status: result.ok ? (result.alreadySubscribed ? 'skipped' : 'sent') : 'failed',
            error_message: result.error?.slice(0, 500) ?? null,
            delivered_at: result.ok ? new Date().toISOString() : null,
          },
          { onConflict: 'lead_id,connection_id' }
        )
      }
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: session!.userId,
      actor_role: session!.role,
      tenant_id: session!.tenantId,
      action: 'leads.push_autoresponders',
      target_type: 'leads',
      metadata: { leads: leadIds.length, sent, skipped, failed },
    })

    return NextResponse.json({ ok: true, sent, skipped, failed })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export const dynamic = 'force-dynamic'
