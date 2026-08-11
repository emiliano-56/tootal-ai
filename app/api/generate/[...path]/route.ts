import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/supabase/server'
import { resolveGenerationBackend } from '@/lib/ai/generation-backend'

/**
 * The generation backend, reached through our own origin.
 *
 * Every page used to call the backend straight from the browser. That worked
 * in development and broke the moment the app was deployed:
 *
 *     Access to fetch at 'https://zoop-a1-v2.onrender.com/coloring/generate-image'
 *     from origin 'https://comic-tale-ai-one.vercel.app' has been blocked by
 *     CORS policy: No 'Access-Control-Allow-Origin' header is present.
 *
 * The backend answers a preflight with HTTP 400 and no `Allow-Origin`, so the
 * browser refuses the request before it is ever sent. Nothing in this codebase
 * can fix that from the browser side — the header has to come from the other
 * server — so the request stops being cross-origin instead. The browser talks
 * to us, and we talk to the backend, where CORS does not apply at all.
 *
 * Three things this buys beyond fixing the bug:
 *
 *   - The backend URL stops being shipped to the browser, so repointing it is
 *     a server-side change rather than something a customer can read.
 *   - The call requires a session, so the backend is no longer an open
 *     endpoint anyone who read the page source could hammer.
 *   - Failures come back as a readable message instead of a CORS error in the
 *     console, which names nothing and points nowhere.
 */

/**
 * The endpoints the app actually uses.
 *
 * An allowlist rather than a passthrough. Forwarding any path would make this
 * a general-purpose proxy into whatever else is hosted on that origin, which
 * is a much bigger thing than "generate an image".
 */
const ALLOWED = new Set([
  'coloring/generate-comic-story',
  'coloring/generate-image',
  'coloring/download-image',
  'comic/generate-coloring-book',
  'comic/generate-image',
  'comic/download-image',
  'nano/generate-image',
  'nano/download-image',
  'text-video/generate-video',
])

/**
 * How long to wait for the backend.
 *
 * Measured against the live service: 32s for a simple image, 47s with a
 * reference attached, and 202s on a bad day. Anything shorter turns a slow
 * render into a failure the customer has to pay for twice.
 */
const BACKEND_TIMEOUT_MS = 280_000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { path } = await params
  const endpoint = (path ?? []).join('/')

  if (!ALLOWED.has(endpoint)) {
    return NextResponse.json(
      { error: `That is not a generation endpoint: ${endpoint}` },
      { status: 404 }
    )
  }

  const body = await request.text()
  const { url } = await resolveGenerationBackend()

  try {
    const response = await fetch(`${url}/${endpoint}`, {
      method: 'POST',
      // Only the content type is forwarded. Passing the caller's headers on
      // would send our session cookie to a third party.
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    })

    const text = await response.text()

    // Passed through as-is when it is JSON, because callers read `success`
    // and `image_url` off it. A non-JSON body means the backend fell over,
    // and the raw HTML of its error page helps nobody.
    try {
      return NextResponse.json(JSON.parse(text), { status: response.status })
    } catch {
      console.error(`[generate] ${endpoint} returned non-JSON:`, text.slice(0, 300))

      return NextResponse.json(
        {
          success: false,
          error: `The generation service returned an unexpected response (HTTP ${response.status}).`,
        },
        { status: 502 }
      )
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'

    console.error(`[generate] ${endpoint} failed:`, error)

    return NextResponse.json(
      {
        success: false,
        error: timedOut
          ? 'The generation service took too long to answer. Try again in a moment.'
          : 'Could not reach the generation service. Try again in a moment.',
      },
      { status: 504 }
    )
  }
}

/**
 * The download endpoints, which are GETs opened in a new tab.
 *
 * `window.open` is a navigation rather than a fetch, so CORS never applied to
 * it and this one was never broken. It is here because the base URL moved: a
 * page that builds `${API}/nano/download-image?...` now points at this route,
 * and without a GET handler that download button would 404.
 *
 * The body is streamed rather than buffered — these are finished images and
 * reading one fully into memory before sending it on is a waste on both ends.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { path } = await params
  const endpoint = (path ?? []).join('/')

  if (!ALLOWED.has(endpoint)) {
    return NextResponse.json({ error: `Not a generation endpoint: ${endpoint}` }, { status: 404 })
  }

  const { url } = await resolveGenerationBackend()

  // From `request.url` rather than `request.nextUrl`: the latter exists only
  // on Next's own request type, so depending on it makes this handler
  // impossible to call with a plain Request — including from a test.
  const query = new URL(request.url).search

  try {
    const response = await fetch(`${url}/${endpoint}${query}`, {
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    })

    const headers = new Headers()

    // Only the headers that describe the file. Anything else the backend sets
    // is its own business and should not be replayed to our customer.
    for (const name of ['content-type', 'content-disposition', 'content-length']) {
      const value = response.headers.get(name)

      if (value) headers.set(name, value)
    }

    return new NextResponse(response.body, { status: response.status, headers })
  } catch (error) {
    console.error(`[generate] GET ${endpoint} failed:`, error)

    return NextResponse.json(
      { error: 'Could not reach the generation service.' },
      { status: 504 }
    )
  }
}

export const dynamic = 'force-dynamic'

/**
 * Long, because the backend is.
 *
 * Note for whoever deploys this: a Vercel Hobby function is capped at 60
 * seconds regardless of what is set here, and a render that takes longer will
 * be cut off. Pro allows the full 300. On a VPS there is no cap.
 */
export const maxDuration = 300
