import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkDelivery, ipPrefix, SIGNED_URL_SECONDS } from '@/lib/delivery/links'

/**
 * The buyer's side of a delivery link.
 *
 * Unauthenticated on purpose — the buyer has no account here, only a token —
 * which makes this the one place where all of the enforcement has to happen.
 * Two things follow from that and both matter:
 *
 *   - The file lives in a private bucket. A signed URL is minted here, after
 *     the checks, and lives two minutes. A public URL would be a second
 *     delivery link that none of the limits apply to.
 *
 *   - The download is counted before the URL is handed over, not after. A
 *     buyer who closes the tab has still had the link, and counting on
 *     success would let a cap of three be used indefinitely by cancelling.
 */

interface Row {
  id: string
  title: string
  message: string
  bucket: string
  path: string
  filename: string
  size_bytes: number | null
  expires_at: string | null
  max_downloads: number | null
  downloads: number
  revoked: boolean
}

async function load(token: string): Promise<Row | null> {
  if (!token || token.length > 64) return null

  const { data } = await supabaseAdmin
    .from('deliveries')
    .select(
      'id, title, message, bucket, path, filename, size_bytes, expires_at, max_downloads, downloads, revoked'
    )
    .eq('token', token)
    .maybeSingle()

  return (data as Row | null) ?? null
}

/** What the download page shows before the buyer presses anything. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const delivery = await load(token)

  // The same answer for a token that never existed and one that has been
  // deleted: anything else lets someone test which tokens are real.
  if (!delivery) {
    return NextResponse.json(
      { error: 'This link is not valid. Ask the seller for a new one.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const state = checkDelivery(delivery, new Date())

  return NextResponse.json(
    {
      title: delivery.title,
      message: delivery.message,
      filename: delivery.filename,
      sizeBytes: delivery.size_bytes,
      usable: state.usable,
      reason: state.usable ? undefined : state.reason,
      remaining: state.usable ? state.remaining : 0,
      expiresAt: state.usable ? state.expiresAt : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

/** Hand over the file, once. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const delivery = await load(token)

  if (!delivery) {
    return NextResponse.json({ error: 'This link is not valid.' }, { status: 404 })
  }

  const state = checkDelivery(delivery, new Date())

  if (!state.usable) {
    return NextResponse.json({ error: state.reason }, { status: 410 })
  }

  // Counted first. A buyer who closes the tab has still had the link, and
  // counting on success would let a cap of three be used forever by
  // cancelling the download each time.
  //
  // The condition on `downloads` makes this an atomic check-and-increment:
  // two requests arriving together cannot both see the same count and both
  // pass a cap of one.
  const { data: claimed } = await supabaseAdmin
    .from('deliveries')
    .update({ downloads: delivery.downloads + 1 })
    .eq('id', delivery.id)
    .eq('downloads', delivery.downloads)
    .select('id')
    .maybeSingle()

  if (!claimed) {
    return NextResponse.json(
      { error: 'That download was already counted. Reload the page and try again.' },
      { status: 409 }
    )
  }

  const { data: signed, error } = await supabaseAdmin.storage
    .from(delivery.bucket)
    .createSignedUrl(delivery.path, SIGNED_URL_SECONDS, { download: delivery.filename })

  if (error || !signed?.signedUrl) {
    // Give the download back — the buyer got nothing, so charging them a
    // slot would be taking one of a limited number for no file.
    await supabaseAdmin
      .from('deliveries')
      .update({ downloads: delivery.downloads })
      .eq('id', delivery.id)

    console.error('[delivery] could not sign:', error?.message)

    return NextResponse.json(
      { error: 'The file could not be prepared. Tell the seller.' },
      { status: 502 }
    )
  }

  await supabaseAdmin.from('delivery_downloads').insert({
    delivery_id: delivery.id,
    ip_prefix: ipPrefix(
      request.headers.get('x-forwarded-for')?.split(',')[0] ??
        request.headers.get('x-real-ip')
    ),
    user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  })

  return NextResponse.json(
    { url: signed.signedUrl, filename: delivery.filename },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export const dynamic = 'force-dynamic'
