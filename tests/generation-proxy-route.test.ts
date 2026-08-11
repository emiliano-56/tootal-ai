import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The proxy actually forwarding.
 *
 * The static checks next door prove the allowlist matches what the app calls
 * and that no client component reaches the backend directly. Neither says the
 * forwarding works — and that is the link that carries every generation in
 * the product, so it is worth exercising rather than assuming.
 *
 * The session and the backend are both stubbed. What is under test is the
 * route: where it sends the request, what it sends, what it gives back, and
 * what it does when the other end misbehaves.
 */

const getSessionContext = vi.fn()
const resolveGenerationBackend = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  getSessionContext: () => getSessionContext(),
}))

vi.mock('@/lib/ai/generation-backend', () => ({
  resolveGenerationBackend: () => resolveGenerationBackend(),
}))

const BACKEND = 'https://backend.test'

/** A request the way Next hands one to a route handler. */
const post = (body = '{"prompt":"a cat"}') =>
  new Request('http://app.test/api/generate/coloring/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: 'sb-session=secret' },
    body,
  })

const params = (path: string[]) => ({ params: Promise.resolve({ path }) })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()

  getSessionContext.mockResolvedValue({ userId: 'u1', tenantId: 't1', role: 'user' })
  resolveGenerationBackend.mockResolvedValue({ url: BACKEND, source: 'database' })

  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

async function route() {
  return import('@/app/api/generate/[...path]/route')
}

describe('forwarding a generation request', () => {
  it('sends it to the configured backend at the same path', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, image_url: 'https://img.test/a.png' }), {
        status: 200,
      })
    )

    const { POST } = await route()
    const response = await POST(post() as never, params(['coloring', 'generate-image']) as never)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]

    expect(url).toBe(`${BACKEND}/coloring/generate-image`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"prompt":"a cat"}')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      image_url: 'https://img.test/a.png',
    })
  })

  it('never forwards the caller’s cookies to a third party', async () => {
    // The request carries our session cookie. Passing the caller's headers
    // through would hand it to somebody else's server.
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))

    const { POST } = await route()

    await POST(post() as never, params(['coloring', 'generate-image']) as never)

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>

    expect(Object.keys(headers).map((key) => key.toLowerCase())).toEqual(['content-type'])
  })

  it('passes the backend’s status through, not just its body', async () => {
    // A 422 from the backend means the caller sent something wrong, and
    // flattening it to 200 would make the page think it succeeded.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Field required' }), { status: 422 })
    )

    const { POST } = await route()
    const response = await POST(post() as never, params(['coloring', 'generate-image']) as never)

    expect(response.status).toBe(422)
  })

  it('refuses without a session, before it looks at anything else', async () => {
    getSessionContext.mockResolvedValue(null)

    const { POST } = await route()
    const response = await POST(post() as never, params(['coloring', 'generate-image']) as never)

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a path that is not a generation endpoint', async () => {
    // Forwarding anything would make this a general proxy into whatever else
    // is hosted on that origin.
    const { POST } = await route()
    const response = await POST(post() as never, params(['admin', 'secrets']) as never)

    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('turns a non-JSON reply into a readable error rather than crashing', async () => {
    // The backend falling over returns an HTML error page, and handing that
    // to `res.json()` in the browser throws somewhere unhelpful.
    fetchMock.mockResolvedValue(new Response('<html>502 Bad Gateway</html>', { status: 502 }))

    const { POST } = await route()
    const response = await POST(post() as never, params(['coloring', 'generate-image']) as never)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.success).toBe(false)
    expect(body.error).toContain('unexpected response')
  })

  it('says so plainly when the backend takes too long', async () => {
    const timeout = new Error('The operation was aborted due to timeout')

    timeout.name = 'TimeoutError'
    fetchMock.mockRejectedValue(timeout)

    const { POST } = await route()
    const response = await POST(post() as never, params(['coloring', 'generate-image']) as never)
    const body = await response.json()

    expect(response.status).toBe(504)
    expect(body.error).toContain('took too long')
  })

  it('says so plainly when the backend is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const { POST } = await route()
    const response = await POST(post() as never, params(['coloring', 'generate-image']) as never)

    expect((await response.json()).error).toContain('Could not reach')
  })

  it('gives the backend a real timeout rather than waiting forever', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))

    const { POST } = await route()

    await POST(post() as never, params(['coloring', 'generate-image']) as never)

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
})

describe('forwarding a download', () => {
  it('keeps the query string, which is where the image URL lives', async () => {
    fetchMock.mockResolvedValue(
      new Response('binary', {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-disposition': 'attachment' },
      })
    )

    const { GET } = await route()

    const response = await GET(
      new Request('http://app.test/api/generate/nano/download-image?image_url=https%3A%2F%2Fimg.test%2Fa.png') as never,
      params(['nano', 'download-image']) as never
    )

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BACKEND}/nano/download-image?image_url=https%3A%2F%2Fimg.test%2Fa.png`
    )
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('content-disposition')).toBe('attachment')
  })

  it('needs a session too', async () => {
    getSessionContext.mockResolvedValue(null)

    const { GET } = await route()
    const response = await GET(
      new Request('http://app.test/api/generate/nano/download-image') as never,
      params(['nano', 'download-image']) as never
    )

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
