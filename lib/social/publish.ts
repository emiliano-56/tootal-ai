import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { fitCaption, type NetworkId } from '@/lib/social/networks'
import { loadApp, refreshConnection } from '@/lib/social/oauth'

/**
 * Posting on a customer's behalf.
 *
 * Each platform wants a different shape, so each gets its own function. What
 * they share is the contract: return a result, never throw, and say plainly
 * what went wrong. A campaign running at 3am has nobody to catch an exception.
 *
 * Every attempt is written to `social_posts`, successful or not, so "why did
 * Tuesday not go out" has an answer.
 */

export interface Connection {
  id: string
  user_id: string
  platform: string
  account_id: string | null
  account_name: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  settings: Record<string, unknown>
  status: string
}

export interface PostInput {
  caption: string
  /** The share link. Networks that take a link get this one. */
  url?: string
  /** A publicly reachable image. Instagram will not accept anything else. */
  imageUrl?: string
  hashtags?: string[]
}

export interface PostResult {
  ok: boolean
  remoteId?: string
  remoteUrl?: string
  error?: string
}

/** Renew the token first if it is within five minutes of expiring. */
async function usableToken(connection: Connection): Promise<string | null> {
  if (!connection.access_token) return null

  const expires = connection.expires_at ? new Date(connection.expires_at).getTime() : 0

  if (!expires || expires - Date.now() > 5 * 60 * 1000) return connection.access_token

  if (!connection.refresh_token) return connection.access_token

  const app = await loadApp(connection.platform)

  if (!app) return connection.access_token

  const renewed = await refreshConnection(connection.platform, app, connection.refresh_token)

  if (!renewed) return connection.access_token

  await supabaseAdmin
    .from('social_connections')
    .update({
      access_token: renewed.accessToken,
      refresh_token: renewed.refreshToken,
      expires_at: renewed.expiresAt,
      status: 'active',
    })
    .eq('id', connection.id)

  return renewed.accessToken
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>
}

function errorFrom(payload: Record<string, unknown>, fallback: string): string {
  const error = payload.error

  if (error && typeof error === 'object') {
    const nested = error as Record<string, unknown>
    if (nested.message) return String(nested.message)
  }

  if (typeof error === 'string') return error
  if (payload.message) return String(payload.message)
  if (payload.detail) return String(payload.detail)

  return fallback
}

// ---------------------------------------------------------------------------
//  One platform at a time
// ---------------------------------------------------------------------------

async function postFacebook(connection: Connection, input: PostInput, token: string): Promise<PostResult> {
  const pageId = String(connection.settings.pageId ?? connection.account_id ?? '')

  if (!pageId) return { ok: false, error: 'No Page is attached to this connection' }

  const message = fitCaption('facebook', input.caption)

  // A photo post outperforms a link post, so an image is used when we have one.
  const endpoint = input.imageUrl
    ? `https://graph.facebook.com/v21.0/${pageId}/photos`
    : `https://graph.facebook.com/v21.0/${pageId}/feed`

  const body = input.imageUrl
    ? { url: input.imageUrl, caption: `${message}${input.url ? `\n\n${input.url}` : ''}`, access_token: token }
    : { message, link: input.url, access_token: token }

  const payload = await readJson(
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

  if (!payload.id) return { ok: false, error: errorFrom(payload, 'Facebook refused the post') }

  return {
    ok: true,
    remoteId: String(payload.id),
    remoteUrl: `https://www.facebook.com/${payload.id}`,
  }
}

async function postInstagram(connection: Connection, input: PostInput, token: string): Promise<PostResult> {
  if (!input.imageUrl) {
    return { ok: false, error: 'Instagram posts must have an image — nothing was rendered for this one' }
  }

  const igId = String(connection.account_id ?? '')

  if (!igId) return { ok: false, error: 'No Instagram account is attached to this connection' }

  // Instagram is two steps: create a container, then publish it.
  const container = await readJson(
    await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: input.imageUrl,
        caption: fitCaption('instagram', input.caption),
        access_token: token,
      }),
    })
  )

  if (!container.id) {
    return { ok: false, error: errorFrom(container, 'Instagram would not accept the image') }
  }

  const published = await readJson(
    await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    })
  )

  if (!published.id) {
    return { ok: false, error: errorFrom(published, 'Instagram would not publish the post') }
  }

  return { ok: true, remoteId: String(published.id) }
}

async function postTwitter(_connection: Connection, input: PostInput, token: string): Promise<PostResult> {
  // Uploading media to X needs the v1.1 endpoint and a different auth scheme,
  // so the link carries the picture: X renders a card from the share page.
  const text = fitCaption('twitter', [input.caption, input.url].filter(Boolean).join('\n\n'))

  const payload = await readJson(
    await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    })
  )

  const data = payload.data as { id: string } | undefined

  if (!data?.id) return { ok: false, error: errorFrom(payload, 'X refused the post') }

  return { ok: true, remoteId: data.id, remoteUrl: `https://twitter.com/i/status/${data.id}` }
}

async function postLinkedIn(connection: Connection, input: PostInput, token: string): Promise<PostResult> {
  const author = connection.account_id ? `urn:li:person:${connection.account_id}` : null

  if (!author) return { ok: false, error: 'No LinkedIn profile is attached to this connection' }

  const commentary = fitCaption('linkedin', input.caption)

  const payload = await readJson(
    await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: commentary },
            shareMediaCategory: input.url ? 'ARTICLE' : 'NONE',
            ...(input.url
              ? { media: [{ status: 'READY', originalUrl: input.url }] }
              : {}),
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    })
  )

  if (!payload.id) return { ok: false, error: errorFrom(payload, 'LinkedIn refused the post') }

  return { ok: true, remoteId: String(payload.id) }
}

async function postTelegram(connection: Connection, input: PostInput): Promise<PostResult> {
  const token = String(connection.settings.botToken ?? connection.access_token ?? '')
  const chatId = String(connection.settings.chatId ?? connection.account_id ?? '')

  if (!token || !chatId) {
    return { ok: false, error: 'This connection is missing its bot token or channel id' }
  }

  const caption = fitCaption('telegram', [input.caption, input.url].filter(Boolean).join('\n\n'))

  // A photo when there is one, otherwise plain text.
  const endpoint = input.imageUrl ? 'sendPhoto' : 'sendMessage'
  const body = input.imageUrl
    ? { chat_id: chatId, photo: input.imageUrl, caption }
    : { chat_id: chatId, text: caption, disable_web_page_preview: false }

  const payload = await readJson(
    await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

  if (!payload.ok) {
    return { ok: false, error: String(payload.description ?? 'Telegram refused the message') }
  }

  const result = payload.result as { message_id: number } | undefined

  return { ok: true, remoteId: result ? String(result.message_id) : undefined }
}

async function postReddit(connection: Connection, input: PostInput, token: string): Promise<PostResult> {
  const subreddit = String(connection.settings.subreddit ?? '').replace(/^r\//, '')

  if (!subreddit) {
    return { ok: false, error: 'Choose a subreddit for this connection before posting' }
  }

  const body = new URLSearchParams({
    sr: subreddit,
    title: fitCaption('reddit', input.caption).slice(0, 300),
    api_type: 'json',
    ...(input.url ? { kind: 'link', url: input.url } : { kind: 'self', text: input.caption }),
  })

  const payload = await readJson(
    await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'ComicAgentAI/1.0',
      },
      body,
    })
  )

  // Reddit answers 200 with the failure inside, so the errors array is the
  // only reliable place to look.
  const json = payload.json as { errors?: unknown[]; data?: { url?: string; id?: string } } | undefined
  const errors = json?.errors ?? []

  if (errors.length > 0) {
    return { ok: false, error: `Reddit: ${JSON.stringify(errors[0])}` }
  }

  return { ok: true, remoteId: json?.data?.id, remoteUrl: json?.data?.url }
}

// ---------------------------------------------------------------------------
//  The one entry point
// ---------------------------------------------------------------------------

export async function publish(
  connection: Connection,
  input: PostInput,
  context: { runId?: string; sharedId?: string } = {}
): Promise<PostResult> {
  const record = async (result: PostResult) => {
    await supabaseAdmin.from('social_posts').insert({
      user_id: connection.user_id,
      connection_id: connection.id,
      run_id: context.runId ?? null,
      shared_id: context.sharedId ?? null,
      platform: connection.platform,
      status: result.ok ? 'posted' : 'failed',
      remote_id: result.remoteId ?? null,
      remote_url: result.remoteUrl ?? null,
      caption: input.caption.slice(0, 2000),
      error: result.error?.slice(0, 500) ?? null,
    })

    // A dead token should stop the campaign retrying it every day; anything
    // else is probably transient and the connection stays usable.
    if (!result.ok) {
      const expired = /token|auth|expired|permission|oauth/i.test(result.error ?? '')

      await supabaseAdmin
        .from('social_connections')
        .update({
          last_error: result.error?.slice(0, 500) ?? null,
          ...(expired ? { status: 'expired' } : {}),
        })
        .eq('id', connection.id)
    } else {
      await supabaseAdmin
        .from('social_connections')
        .update({ last_posted_at: new Date().toISOString(), last_error: null, status: 'active' })
        .eq('id', connection.id)
    }

    return result
  }

  if (connection.status === 'revoked') {
    return record({ ok: false, error: 'This connection was disconnected' })
  }

  try {
    const platform = connection.platform as NetworkId

    // Telegram carries its credential in settings, so it needs no token dance.
    if (platform === 'telegram') return record(await postTelegram(connection, input))

    const token = await usableToken(connection)

    if (!token) return record({ ok: false, error: 'Reconnect this account — its token is gone' })

    switch (platform) {
      case 'facebook':
        return record(await postFacebook(connection, input, token))
      case 'instagram':
        return record(await postInstagram(connection, input, token))
      case 'twitter':
        return record(await postTwitter(connection, input, token))
      case 'linkedin':
        return record(await postLinkedIn(connection, input, token))
      case 'reddit':
        return record(await postReddit(connection, input, token))
      default:
        return record({ ok: false, error: `${connection.platform} cannot be posted to automatically` })
    }
  } catch (error) {
    return record({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Publish to several accounts, one after another. */
export async function publishAll(
  connections: Connection[],
  input: PostInput,
  context: { runId?: string; sharedId?: string } = {}
): Promise<{ platform: string; ok: boolean; error?: string }[]> {
  const results: { platform: string; ok: boolean; error?: string }[] = []

  // Sequential on purpose: one failing platform must not take the others with
  // it, and rate limits are per-app rather than per-account.
  for (const connection of connections) {
    const result = await publish(connection, input, context)

    results.push({ platform: connection.platform, ok: result.ok, error: result.error })
  }

  return results
}

export async function loadConnections(userId: string, ids?: string[]): Promise<Connection[]> {
  let query = supabaseAdmin
    .from('social_connections')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'revoked')

  if (ids && ids.length > 0) query = query.in('id', ids)

  const { data } = await query

  return (data ?? []) as Connection[]
}
