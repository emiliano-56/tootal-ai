import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { NetworkId } from '@/lib/social/networks'

/**
 * Connecting a customer's social account.
 *
 * Each platform's OAuth differs enough that a single generic implementation
 * would be a pile of conditionals; each one gets its own small function and
 * they share only the state handling, which is the part that must not vary.
 *
 * The `state` parameter is a signed token rather than a random value in a
 * session. Nothing else identifies who came back from the platform, so if it
 * could be forged an attacker could attach their own account to somebody
 * else's login — or worse, the reverse.
 */

export interface SocialApp {
  platform: string
  client_id: string | null
  client_secret: string | null
  extra: Record<string, unknown>
  enabled: boolean
}

export async function loadApp(platform: string): Promise<SocialApp | null> {
  const { data } = await supabaseAdmin
    .from('social_apps')
    .select('*')
    .eq('platform', platform)
    .maybeSingle()

  const app = (data as SocialApp) ?? null

  // Instagram publishing runs through Facebook Login and the same Meta app, so
  // a platform owner who filled in Facebook has already done the work. Falling
  // back spares them entering identical credentials twice and getting one of
  // the two subtly wrong.
  if (platform === 'instagram' && (!app?.client_id || !app.client_secret)) {
    const { data: meta } = await supabaseAdmin
      .from('social_apps')
      .select('*')
      .eq('platform', 'facebook')
      .maybeSingle()

    const facebook = (meta as SocialApp) ?? null

    if (facebook?.client_id && facebook.client_secret) {
      // The Instagram row still decides whether it is offered; only the
      // credentials are borrowed.
      return { ...facebook, platform: 'instagram', enabled: app?.enabled ?? false }
    }
  }

  return app
}

// ---------------------------------------------------------------------------
//  State
// ---------------------------------------------------------------------------

function stateSecret(): string {
  // Falls back to the service role key so a missing setting cannot silently
  // downgrade this to an unsigned state.
  return process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'insecure-dev-only'
}

export function signState(payload: { userId: string; platform: string; nonce?: string }): string {
  const body = Buffer.from(
    JSON.stringify({
      u: payload.userId,
      p: payload.platform,
      n: payload.nonce ?? randomBytes(8).toString('hex'),
      t: Date.now(),
    })
  ).toString('base64url')

  const signature = createHmac('sha256', stateSecret()).update(body).digest('base64url')

  return `${body}.${signature}`
}

export function verifyState(
  state: string,
  maxAgeMs = 15 * 60 * 1000
): { userId: string; platform: string } | null {
  const [body, signature] = state.split('.')

  if (!body || !signature) return null

  const expected = createHmac('sha256', stateSecret()).update(body).digest('base64url')
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)

  if (left.length !== right.length || !timingSafeEqual(left, right)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString())

    // An old state is a replay, or a tab left open for a week.
    if (Date.now() - Number(parsed.t) > maxAgeMs) return null

    return { userId: String(parsed.u), platform: String(parsed.p) }
  } catch {
    return null
  }
}

export function callbackUrl(origin: string, platform: string): string {
  return `${origin.replace(/\/+$/, '')}/api/social/callback/${platform}`
}

// ---------------------------------------------------------------------------
//  Where to send them
// ---------------------------------------------------------------------------

const SCOPES: Partial<Record<NetworkId, string>> = {
  // Publishing to a Page needs the Page list and the publish permission; the
  // business scope is what Meta now requires to see Pages at all.
  facebook: 'pages_show_list,pages_manage_posts,pages_read_engagement,business_management',
  instagram:
    'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management',
  twitter: 'tweet.read tweet.write users.read offline.access',
  linkedin: 'w_member_social openid profile',
  reddit: 'identity submit',
}

export function authorizeUrl(
  platform: NetworkId,
  app: SocialApp,
  origin: string,
  state: string
): string | null {
  const redirect = encodeURIComponent(callbackUrl(origin, platform))
  const clientId = encodeURIComponent(app.client_id ?? '')
  const scope = encodeURIComponent(SCOPES[platform] ?? '')

  switch (platform) {
    case 'facebook':
    case 'instagram':
      // Both run through Facebook Login; they differ only in scope and in what
      // the callback then goes looking for.
      return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirect}&state=${state}&scope=${scope}&response_type=code`

    case 'twitter':
      // X requires PKCE. The challenge is the state itself so nothing extra
      // has to be stored between the two requests.
      return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}&state=${state}&code_challenge=${state}&code_challenge_method=plain`

    case 'linkedin':
      return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirect}&state=${state}&scope=${scope}`

    case 'reddit':
      return `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${redirect}&duration=permanent&scope=${scope}`

    default:
      return null
  }
}

// ---------------------------------------------------------------------------
//  Turning the code into a connection
// ---------------------------------------------------------------------------

export interface ExchangeResult {
  accountId: string | null
  accountName: string
  accessToken: string
  refreshToken?: string | null
  expiresAt?: string | null
  settings?: Record<string, unknown>
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>
}

export async function exchangeCode(
  platform: NetworkId,
  app: SocialApp,
  origin: string,
  code: string,
  state: string
): Promise<ExchangeResult> {
  const redirect = callbackUrl(origin, platform)

  if (platform === 'facebook' || platform === 'instagram') {
    const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token')

    url.searchParams.set('client_id', app.client_id ?? '')
    url.searchParams.set('client_secret', app.client_secret ?? '')
    url.searchParams.set('redirect_uri', redirect)
    url.searchParams.set('code', code)

    const token = await json(await fetch(url))

    if (!token.access_token) {
      throw new Error(describeError(token) ?? 'Facebook refused the code')
    }

    // The user token is short-lived and cannot post on a schedule. Pages give
    // out their own tokens, which do not expire while the app is authorised.
    const pages = await json(
      await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${token.access_token}`
      )
    )

    const list = (pages.data as Record<string, unknown>[] | undefined) ?? []

    if (list.length === 0) {
      throw new Error(
        'No Facebook Page found on that account. Posting needs a Page — Meta does not allow posting to a personal profile.'
      )
    }

    const page = list[0]

    if (platform === 'instagram') {
      const linked = page.instagram_business_account as
        | { id: string; username: string }
        | undefined

      if (!linked?.id) {
        throw new Error(
          'That Page has no Instagram Business account linked. Link one in Meta Business Suite, then connect again.'
        )
      }

      return {
        accountId: linked.id,
        accountName: `@${linked.username ?? 'instagram'}`,
        accessToken: String(page.access_token),
        settings: { pageId: page.id, pageName: page.name },
      }
    }

    return {
      accountId: String(page.id),
      accountName: String(page.name ?? 'Facebook Page'),
      accessToken: String(page.access_token),
      settings: { pageId: page.id },
    }
  }

  if (platform === 'twitter') {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // X wants the app credentials in the header for a confidential client.
        Authorization: `Basic ${Buffer.from(`${app.client_id}:${app.client_secret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect,
        code_verifier: state,
      }),
    })

    const token = await json(response)

    if (!token.access_token) throw new Error(describeError(token) ?? 'X refused the code')

    const me = await json(
      await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
    )

    const user = (me.data as { id: string; username: string } | undefined) ?? undefined

    return {
      accountId: user?.id ?? null,
      accountName: user?.username ? `@${user.username}` : 'X account',
      accessToken: String(token.access_token),
      refreshToken: token.refresh_token ? String(token.refresh_token) : null,
      expiresAt: expiryFrom(token.expires_in),
    }
  }

  if (platform === 'linkedin') {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect,
        client_id: app.client_id ?? '',
        client_secret: app.client_secret ?? '',
      }),
    })

    const token = await json(response)

    if (!token.access_token) throw new Error(describeError(token) ?? 'LinkedIn refused the code')

    const me = await json(
      await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
    )

    return {
      // LinkedIn's post author is `urn:li:person:<sub>`.
      accountId: me.sub ? String(me.sub) : null,
      accountName: String(me.name ?? 'LinkedIn'),
      accessToken: String(token.access_token),
      expiresAt: expiryFrom(token.expires_in),
    }
  }

  if (platform === 'reddit') {
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${app.client_id}:${app.client_secret}`).toString('base64')}`,
        // Reddit blocks requests without a distinctive user agent.
        'User-Agent': 'ComicTaleAI/1.0',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect,
      }),
    })

    const token = await json(response)

    if (!token.access_token) throw new Error(describeError(token) ?? 'Reddit refused the code')

    const me = await json(
      await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'User-Agent': 'ComicTaleAI/1.0',
        },
      })
    )

    return {
      accountId: me.name ? String(me.name) : null,
      accountName: me.name ? `u/${me.name}` : 'Reddit',
      accessToken: String(token.access_token),
      refreshToken: token.refresh_token ? String(token.refresh_token) : null,
      expiresAt: expiryFrom(token.expires_in),
    }
  }

  throw new Error(`${platform} does not connect this way`)
}

function expiryFrom(seconds: unknown): string | null {
  const value = Number(seconds)

  if (!Number.isFinite(value) || value <= 0) return null

  return new Date(Date.now() + value * 1000).toISOString()
}

/** Platforms disagree on where the message lives; look in all the usual places. */
function describeError(payload: Record<string, unknown>): string | null {
  const error = payload.error

  if (typeof error === 'string') return `${error}${payload.error_description ? `: ${payload.error_description}` : ''}`

  if (error && typeof error === 'object') {
    const nested = error as Record<string, unknown>

    if (nested.message) return String(nested.message)
  }

  if (payload.error_description) return String(payload.error_description)
  if (payload.message) return String(payload.message)

  return null
}

/**
 * Renew a token that is about to expire.
 *
 * Only X and Reddit hand out refresh tokens; Facebook Page tokens do not
 * expire while the app stays authorised, and LinkedIn makes you reconnect.
 */
export async function refreshConnection(
  platform: string,
  app: SocialApp,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string | null; expiresAt: string | null } | null> {
  const endpoints: Record<string, string> = {
    twitter: 'https://api.twitter.com/2/oauth2/token',
    reddit: 'https://www.reddit.com/api/v1/access_token',
  }

  const endpoint = endpoints[platform]

  if (!endpoint) return null

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${app.client_id}:${app.client_secret}`).toString('base64')}`,
      'User-Agent': 'ComicTaleAI/1.0',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })

  const token = await json(response)

  if (!token.access_token) return null

  return {
    accessToken: String(token.access_token),
    refreshToken: token.refresh_token ? String(token.refresh_token) : refreshToken,
    expiresAt: expiryFrom(token.expires_in),
  }
}
