import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { entitlementsFor } from '@/lib/plans/server'
import {
  mergeLibraryLimits,
  limitWithGrant,
  quotaFor,
  decideOnSave,
  LIBRARY_KINDS,
  type LibraryKind,
} from '@/lib/library/quota'
import { loadDrive, backupItem } from '@/lib/drive/client'

/**
 * The library: what has been kept, and whether there is room for more.
 *
 * The cap is enforced here rather than in the browser. The dialog exists to
 * let the customer choose what goes, not to be the thing stopping them — a
 * client-side check is advisory and anyone could skip it.
 *
 * Nothing is ever deleted without being asked for by name. A save that would
 * exceed the limit is refused with the details the dialog needs, and the
 * customer comes back having decided.
 */

const KINDS = LIBRARY_KINDS.map((entry) => entry.kind) as string[]

/**
 * How many of each kind this account may keep.
 *
 * The plans give a base; a grant made to this customer personally is added on
 * top, so a superadmin can lift one account without moving it to a tier it
 * does not otherwise want.
 */
async function limitFor(userId: string, kind?: string): Promise<number | null> {
  const { plans } = await entitlementsFor(userId)

  if (plans.length === 0) return null

  const codes = plans.map((plan) => plan.code)

  const { data } = await supabaseAdmin
    .from('plans')
    .select('code, library_limit')
    .in('code', codes)

  const base = mergeLibraryLimits(
    ((data ?? []) as { library_limit: number | null }[]).map((row) => row.library_limit)
  )

  if (base === null || !kind) return base

  const { data: grant } = await supabaseAdmin
    .from('user_feature_grants')
    .select('extra_library')
    .eq('user_id', userId)
    .eq('feature', kind)
    .maybeSingle()

  return limitWithGrant(base, (grant as { extra_library: number } | null)?.extra_library ?? 0)
}

async function usedFor(userId: string, kind: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('library_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)

  return count ?? 0
}

/** The item that would go if the customer chooses to make room. */
async function oldestFor(userId: string, kind: string) {
  const { data } = await supabaseAdmin
    .from('library_items')
    .select('id, title, created_at, drive_file_id')
    .eq('user_id', userId)
    .eq('kind', kind)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const row = data as { id: string; title: string; created_at: string; drive_file_id: string | null }

  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    backedUp: Boolean(row.drive_file_id),
  }
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const kind = request.nextUrl.searchParams.get('kind')
  const limit = await limitFor(session.userId, kind ?? undefined)

  // ---- one kind: everything the save dialog needs before it draws
  if (kind && KINDS.includes(kind)) {
    const [used, oldest, drive] = await Promise.all([
      usedFor(session.userId, kind),
      oldestFor(session.userId, kind),
      loadDrive(session.userId),
    ])

    const quota = quotaFor(limit, used)

    return NextResponse.json({
      quota,
      oldest,
      driveConnected: Boolean(drive),
      autoSync: Boolean(drive?.auto_sync),
      decision: decideOnSave({ quota, oldest, driveConnected: Boolean(drive) }),
    })
  }

  // ---- the whole library
  const { data: items } = await supabaseAdmin
    .from('library_items')
    .select('id, kind, title, bucket, path, public_url, cover_url, drive_link, drive_synced_at, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(500)

  const counts: Record<string, number> = {}

  for (const row of ((items ?? []) as { kind: string }[])) {
    counts[row.kind] = (counts[row.kind] ?? 0) + 1
  }

  const drive = await loadDrive(session.userId)

  // Grants are per kind, so they are read once here rather than by calling
  // limitFor five times.
  const { data: grants } = await supabaseAdmin
    .from('user_feature_grants')
    .select('feature, extra_library')
    .eq('user_id', session.userId)

  const extras = Object.fromEntries(
    ((grants ?? []) as { feature: string; extra_library: number }[]).map((row) => [
      row.feature,
      row.extra_library ?? 0,
    ])
  )

  return NextResponse.json({
    items: items ?? [],
    quotas: Object.fromEntries(
      KINDS.map((entry) => [
        entry,
        quotaFor(limitWithGrant(limit, extras[entry] ?? 0), counts[entry] ?? 0),
      ])
    ),
    driveConnected: Boolean(drive),
    autoSync: Boolean(drive?.auto_sync),
  })
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const kind = String(body?.kind ?? '')

  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
  }

  const path = body.path ? String(body.path) : null
  const publicUrl = body.publicUrl ? String(body.publicUrl) : null

  if (!path && !publicUrl) {
    return NextResponse.json({ error: 'Nothing to record' }, { status: 400 })
  }

  // Storage paths are `<user id>/<file>`, so anything else is a request to
  // record someone else's file as your own.
  if (path && !path.startsWith(`${session.userId}/`)) {
    return NextResponse.json({ error: 'That file is not yours' }, { status: 403 })
  }

  const limit = await limitFor(session.userId, kind)
  const used = await usedFor(session.userId, kind)
  const quota = quotaFor(limit, used)

  // ---- the customer has already chosen what to remove
  const replaceId = body.replaceId ? String(body.replaceId) : null

  if (quota.full && !replaceId) {
    const oldest = await oldestFor(session.userId, kind)
    const drive = await loadDrive(session.userId)

    return NextResponse.json(
      {
        error: 'Your library is full',
        full: true,
        quota,
        oldest,
        driveConnected: Boolean(drive),
      },
      { status: 409 }
    )
  }

  if (replaceId) {
    const { data: victim } = await supabaseAdmin
      .from('library_items')
      .select('id, title, kind, bucket, path, public_url, drive_file_id')
      .eq('id', replaceId)
      .eq('user_id', session.userId)
      .maybeSingle()

    if (!victim) return NextResponse.json({ error: 'That item is not yours' }, { status: 404 })

    const row = victim as {
      id: string
      title: string
      kind: string
      bucket: string | null
      path: string | null
      public_url: string | null
      drive_file_id: string | null
    }

    // Back it up first if asked. If that fails, nothing is removed — losing
    // the file is the one outcome this flow exists to prevent.
    if (body.backupFirst && !row.drive_file_id) {
      const drive = await loadDrive(session.userId)

      if (!drive) {
        return NextResponse.json({ error: 'Google Drive is not connected' }, { status: 409 })
      }

      const result = await backupItem(drive, row)

      if (!result.ok) {
        return NextResponse.json(
          { error: `Could not back it up, so nothing was removed: ${result.error}` },
          { status: 502 }
        )
      }
    }

    await removeItem(row)
  }

  const { data: created, error } = await supabaseAdmin
    .from('library_items')
    .insert({
      user_id: session.userId,
      tenant_id: session.tenantId,
      kind,
      title: String(body.title ?? 'Untitled').slice(0, 200),
      bucket: body.bucket ? String(body.bucket) : null,
      path,
      public_url: publicUrl,
      cover_url: body.coverUrl ? String(body.coverUrl) : null,
      size_bytes: Number(body.sizeBytes) || null,
      meta: body.meta && typeof body.meta === 'object' ? body.meta : {},
    })
    .select('*')
    .single()

  if (error) {
    // The unique index means a second save of the same file is a no-op, not
    // an error the customer should see.
    if (error.code === '23505') return NextResponse.json({ ok: true, duplicate: true })

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Auto-sync: back the new item up straight away, without blocking the save.
  const drive = await loadDrive(session.userId)
  let backedUp = false

  if (drive?.auto_sync) {
    const result = await backupItem(drive, created as Parameters<typeof backupItem>[1])

    backedUp = result.ok
  }

  return NextResponse.json({ ok: true, item: created, backedUp })
}

/** Remove the row and the file behind it. */
async function removeItem(row: {
  id: string
  bucket: string | null
  path: string | null
}): Promise<void> {
  if (row.bucket && row.path) {
    const { error } = await supabaseAdmin.storage.from(row.bucket).remove([row.path])

    // A missing object should not block the row from going: the outcome the
    // customer asked for is that it stops taking up a slot.
    if (error) console.error('[library] could not remove the file:', error.message)
  }

  await supabaseAdmin.from('library_items').delete().eq('id', row.id)
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('library_items')
    .select('id, bucket, path')
    .eq('id', id)
    .eq('user_id', session.userId)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await removeItem(data as { id: string; bucket: string | null; path: string | null })

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300
