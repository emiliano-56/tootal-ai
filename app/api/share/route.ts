import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { createShare, shareLink } from '@/lib/share/links'
import { tenantSiteUrl } from '@/lib/settings/site-url.server'

/**
 * Turning something you made into a public link.
 *
 * The caller names a file it wants shared, so this proves the file is theirs
 * before minting an address for it. Storage paths in this project begin with
 * the owner's user id; anything else is a request to publish someone else's
 * work.
 */

const ALLOWED_BUCKETS = ['comic-pdfs', 'video', 'covers', 'coloring-books']

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)

  if (!body?.title) return NextResponse.json({ error: 'A title is required' }, { status: 400 })

  const bucket = body.bucket ? String(body.bucket) : null
  const path = body.path ? String(body.path) : null
  const publicUrl = body.publicUrl ? String(body.publicUrl) : null

  if (!path && !publicUrl) {
    return NextResponse.json({ error: 'Nothing to share' }, { status: 400 })
  }

  if (bucket && !ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: 'That bucket cannot be shared' }, { status: 400 })
  }

  // Ownership. Every path in this project is `<user id>/<file>`, so anything
  // not starting with the caller's id belongs to somebody else.
  if (path && !path.startsWith(`${session.userId}/`)) {
    return NextResponse.json({ error: 'That file is not yours' }, { status: 403 })
  }

  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  /** Ours, and inside this caller's own folder. */
  const ownedStorageUrl = (value: string) =>
    Boolean(supabaseHost) && value.startsWith(supabaseHost) && value.includes(`/${session.userId}/`)

  // A public URL is checked the same way: it must point into storage at a path
  // the caller owns, or it is a request to put our name on a stranger's link.
  if (publicUrl && !path && !ownedStorageUrl(publicUrl)) {
    return NextResponse.json({ error: 'That link is not yours' }, { status: 403 })
  }

  // The preview becomes og:image on a page served from our domain, so an
  // arbitrary URL here would let someone build a card showing anything they
  // liked under our name. Only our own storage is accepted.
  const previewUrl = body.previewUrl ? String(body.previewUrl) : null

  if (previewUrl && !ownedStorageUrl(previewUrl)) {
    return NextResponse.json({ error: 'That preview image is not yours' }, { status: 403 })
  }

  const item = await createShare({
    userId: session.userId,
    tenantId: session.tenantId,
    kind: String(body.kind ?? 'comic'),
    title: String(body.title),
    caption: body.caption ? String(body.caption) : '',
    hashtags: Array.isArray(body.hashtags) ? body.hashtags.map(String) : [],
    bucket,
    path,
    publicUrl,
    previewUrl,
    projectId: body.projectId ? String(body.projectId) : null,
  })

  if (!item) return NextResponse.json({ error: 'Could not create the link' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    token: item.token,
    // A white label's share link belongs on their own domain, not ours.
    url: shareLink(await tenantSiteUrl(session.tenantId, request.nextUrl.origin), item.token),
    title: item.title,
    caption: item.caption,
    hashtags: item.hashtags,
  })
}

/** The customer's own links, for a "shared" list and for revoking. */
export async function GET() {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('shared_items')
    .select('id, token, kind, title, views, revoked, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ items: data ?? [] })
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Revoked rather than deleted: the row records that a link once existed and
  // was withdrawn, which matters if the customer is asking why it stopped.
  const { error } = await supabaseAdmin
    .from('shared_items')
    .update({ revoked: true })
    .eq('id', id)
    .eq('user_id', session.userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
