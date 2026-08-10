import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'

/**
 * Deleting by storage path rather than by library id.
 *
 * My Comics predates the library and knows a comic by its `pdf_path`. Rather
 * than teach it a second identifier, it names the path and this finds the row.
 *
 * It exists so there is exactly one delete path in the product. Two stores
 * that each delete their own half is how the library and the legacy tables
 * drifted apart: a comic removed in one place stayed in the other, still
 * counting against the customer's keep limit.
 */

export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const path = request.nextUrl.searchParams.get('path')

  if (!path) return NextResponse.json({ error: 'path is required' }, { status: 400 })

  // Paths are `<user id>/<file>`, so anything else is somebody else's work.
  if (!path.startsWith(`${session.userId}/`)) {
    return NextResponse.json({ error: 'That file is not yours' }, { status: 403 })
  }

  const { data } = await supabaseAdmin
    .from('library_items')
    .select('id, kind, bucket')
    .eq('user_id', session.userId)
    .eq('path', path)
    .maybeSingle()

  const row = data as { id: string; kind: string; bucket: string | null } | null

  const bucket = row?.bucket ?? 'comic-pdfs'

  const { error: storageError } = await supabaseAdmin.storage.from(bucket).remove([path])

  // A file that is already gone is the state we wanted; keep going so the
  // rows still get cleaned up.
  if (storageError) console.error('[library] storage remove:', storageError.message)

  // Both legacy tables, because a path alone does not say which one it is in
  // when there is no library row to ask.
  for (const table of ['comics', 'colorings']) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq('pdf_path', path)
      .eq('user_id', session.userId)

    if (error) console.error(`[library] legacy ${table}:`, error.message)
  }

  if (row) {
    await supabaseAdmin.from('library_items').delete().eq('id', row.id)
  }

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
