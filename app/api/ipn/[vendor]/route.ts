import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { loadIpnSettings, processIpn } from '@/lib/ipn/process'
import { siteUrl } from '@/lib/settings/site-url.server'

/**
 * The payment processor's endpoint.
 *
 * Public by necessity — launchpadjv.com posts here with no session — so the
 * shared secret is the only thing standing between a stranger and a free
 * account. It is compared in constant time and required whenever one is set.
 *
 * The response is always 200 once the post is authenticated, including for a
 * payload we decide to ignore. Vendors retry on any non-200, and retrying will
 * not make an unmapped product id become mapped; the reason is recorded on the
 * event instead, where a superadmin can see it.
 */

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  // Compare lengths separately: timingSafeEqual throws on a mismatch, and the
  // throw itself would leak the length.
  if (left.length !== right.length) return false

  return timingSafeEqual(left, right)
}

/** Vendors post form-encoded or JSON; accept both, and query strings too. */
async function readPayload(request: NextRequest): Promise<Record<string, unknown>> {
  const fromQuery = Object.fromEntries(request.nextUrl.searchParams.entries())
  const type = request.headers.get('content-type') ?? ''

  if (type.includes('application/json')) {
    const body = await request.json().catch(() => ({}))

    return { ...fromQuery, ...(body && typeof body === 'object' ? body : {}) }
  }

  const form = await request.formData().catch(() => null)

  if (!form) return fromQuery

  const body: Record<string, unknown> = { ...fromQuery }

  for (const [key, value] of form.entries()) {
    body[key] = typeof value === 'string' ? value : value.name
  }

  return body
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ vendor: string }> }
) {
  const { vendor } = await params
  const settings = await loadIpnSettings()

  if (!settings) {
    return NextResponse.json({ error: 'IPN is not set up' }, { status: 503 })
  }

  if (!settings.enabled) {
    return NextResponse.json({ error: 'IPN is turned off' }, { status: 503 })
  }

  if (vendor.toLowerCase() !== settings.vendor.toLowerCase()) {
    return NextResponse.json({ error: 'Unknown vendor' }, { status: 404 })
  }

  const payload = await readPayload(request)

  if (settings.secret) {
    const supplied =
      request.headers.get('x-ipn-secret') ??
      request.nextUrl.searchParams.get('secret') ??
      String(payload.secret ?? payload.key ?? '')

    if (!supplied || !constantTimeEqual(supplied, settings.secret)) {
      return NextResponse.json({ error: 'Bad secret' }, { status: 401 })
    }
  }

  // The secret is authentication, not data — it must never reach the stored
  // payload, which a superadmin can read in the events table.
  delete payload.secret
  delete payload.key

  try {
    const outcome = await processIpn(vendor, payload, settings, await siteUrl(request.nextUrl.origin))

    return NextResponse.json({ ok: outcome.status !== 'failed', ...outcome })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error('[ipn] processing failed:', message)

    // A 500 here asks the vendor to retry, which is what we want for an
    // unexpected fault — the sale is real and has not been recorded.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
