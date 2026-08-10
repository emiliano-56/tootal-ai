import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { network } from '@/lib/social/networks'
import { publish, loadConnections, type Connection } from '@/lib/social/publish'
import { signState, authorizeUrl, loadApp } from '@/lib/social/oauth'
import { siteUrl } from '@/lib/settings/site-url.server'
import { DRIVE_PLATFORM, driveAuthorizeUrl, loadDrive, backupItem } from '@/lib/drive/client'

/**
 * A customer's connected accounts.
 *
 * Tokens never leave the server. Every response is built from the account
 * name and status, which is everything a screen needs to show and nothing an
 * attacker could use.
 */

/**
 * Strip the credentials out of a connection's settings.
 *
 * `settings` is a free-form bag, and for Telegram it holds the bot token —
 * which is the whole credential. The screen only needs the harmless parts, so
 * the response is built from an allow-list rather than by deleting the secrets
 * we happen to remember: a platform added later would otherwise leak by
 * default.
 */
const PUBLIC_SETTINGS = ['subreddit', 'chatId', 'pageId', 'pageName']

function safeSettings(settings: Record<string, unknown> | null): Record<string, unknown> {
  if (!settings) return {}

  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => PUBLIC_SETTINGS.includes(key))
  )
}

export async function GET() {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const [{ data: connections }, { data: apps }] = await Promise.all([
    supabaseAdmin
      .from('social_connections')
      .select('id, platform, account_id, account_name, status, settings, last_error, last_posted_at, created_at')
      .eq('user_id', session.userId)
      .neq('status', 'revoked')
      .order('created_at'),
    // Which platforms the owner has actually set up; the rest are shown as
    // unavailable rather than offered and then failing.
    supabaseAdmin.from('social_apps').select('platform, enabled, client_id'),
  ])

  // Drive lives in the same table but is not a social network, so it is
  // pulled out rather than listed among them.
  const driveRow = ((connections ?? []) as Record<string, unknown>[]).find(
    (row) => row.platform === DRIVE_PLATFORM
  ) as
    | { id: string; account_name: string; status: string; auto_sync: boolean; last_posted_at: string | null }
    | undefined

  const ready = new Set(
    ((apps ?? []) as { platform: string; enabled: boolean; client_id: string | null }[])
      .filter((app) => app.enabled && app.client_id)
      .map((app) => app.platform)
  )

  return NextResponse.json({
    connections: ((connections ?? []) as Record<string, unknown>[])
      .filter((row) => row.platform !== DRIVE_PLATFORM)
      .map((row) => ({
      ...row,
      settings: safeSettings(row.settings as Record<string, unknown> | null),
    })),
    // Telegram needs no developer app, so it is always available.
    available: [...ready, 'telegram'],
    drive: driveRow
      ? {
          // The id is needed so Disconnect can name the row it means.
          id: driveRow.id,
          accountName: driveRow.account_name,
          status: driveRow.status,
          autoSync: driveRow.auto_sync,
          lastSyncedAt: driveRow.last_posted_at,
        }
      : null,
    driveAvailable: ready.has(DRIVE_PLATFORM),
  })
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)

  if (!body?.action) return NextResponse.json({ error: 'action is required' }, { status: 400 })

  // ---- Google Drive: same consent dance, different catalogue
  if (body.action === 'authorize_drive') {
    const state = signState({ userId: session.userId, platform: DRIVE_PLATFORM })
    const url = await driveAuthorizeUrl(await siteUrl(request.nextUrl.origin), state)

    if (!url) {
      return NextResponse.json(
        { error: 'Google Drive is not set up yet — ask the platform owner to add the app details.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ ok: true, url })
  }

  // ---- back everything up as it is made, rather than one at a time
  if (body.action === 'auto_sync') {
    const { error } = await supabaseAdmin
      .from('social_connections')
      .update({ auto_sync: Boolean(body.enabled) })
      .eq('user_id', session.userId)
      .eq('platform', DRIVE_PLATFORM)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, autoSync: Boolean(body.enabled) })
  }

  // ---- copy one library item up on demand
  if (body.action === 'backup') {
    const drive = await loadDrive(session.userId)

    if (!drive) return NextResponse.json({ error: 'Google Drive is not connected' }, { status: 409 })

    const { data: item } = await supabaseAdmin
      .from('library_items')
      .select('id, title, kind, bucket, path, public_url')
      .eq('id', String(body.itemId ?? ''))
      .eq('user_id', session.userId)
      .maybeSingle()

    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const result = await backupItem(drive, item as Parameters<typeof backupItem>[1])

    return NextResponse.json({ ok: result.ok, error: result.error, link: result.link })
  }

  // ---- where to send the customer to authorise us
  if (body.action === 'authorize') {
    const platform = String(body.platform ?? '')
    const info = network(platform)

    if (!info?.canAutoPost || info.connect !== 'oauth') {
      return NextResponse.json({ error: 'That platform does not connect this way' }, { status: 400 })
    }

    const app = await loadApp(platform)

    if (!app?.enabled || !app.client_id || !app.client_secret) {
      return NextResponse.json(
        { error: `${info.label} is not set up yet — ask the platform owner to add the app details.` },
        { status: 409 }
      )
    }

    const state = signState({ userId: session.userId, platform })
    // Must match the redirect URI registered with the platform exactly, which
    // is why it comes from the setting rather than from this request.
    const url = authorizeUrl(
      platform as Parameters<typeof authorizeUrl>[0],
      app,
      await siteUrl(request.nextUrl.origin),
      state
    )

    if (!url) return NextResponse.json({ error: 'Could not build the link' }, { status: 400 })

    return NextResponse.json({ ok: true, url })
  }

  // ---- Telegram: a bot token and a channel, no OAuth
  if (body.action === 'connect_telegram') {
    const token = String(body.botToken ?? '').trim()
    const chatId = String(body.chatId ?? '').trim()

    if (!token || !chatId) {
      return NextResponse.json({ error: 'A bot token and a channel id are both needed' }, { status: 400 })
    }

    // Verified before it is stored, so a typo is caught here rather than at
    // three in the morning when the first post is due.
    const check = await fetch(`https://api.telegram.org/bot${token}/getMe`)
      .then((response) => response.json())
      .catch(() => null)

    if (!check?.ok) {
      return NextResponse.json({ error: 'Telegram did not recognise that bot token' }, { status: 400 })
    }

    const botName = check.result?.username ? `@${check.result.username}` : 'Telegram bot'

    const { error } = await supabaseAdmin.from('social_connections').upsert(
      {
        user_id: session.userId,
        tenant_id: session.tenantId,
        platform: 'telegram',
        account_id: chatId,
        account_name: `${botName} → ${chatId}`,
        settings: { botToken: token, chatId },
        status: 'active',
        last_error: null,
      },
      { onConflict: 'user_id,platform,account_id' }
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, accountName: botName })
  }

  const owned = async (id: string): Promise<Connection | null> => {
    const { data } = await supabaseAdmin
      .from('social_connections')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.userId)
      .maybeSingle()

    return (data as Connection) ?? null
  }

  // ---- per-platform settings, like which subreddit to post in
  if (body.action === 'settings') {
    const connection = await owned(String(body.id ?? ''))

    if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const settings = { ...connection.settings }

    if (typeof body.subreddit === 'string') {
      settings.subreddit = body.subreddit.trim().replace(/^r\//, '')
    }

    await supabaseAdmin
      .from('social_connections')
      .update({ settings })
      .eq('id', connection.id)

    return NextResponse.json({ ok: true })
  }

  // ---- prove it works, before trusting it with a schedule
  if (body.action === 'test') {
    const connection = await owned(String(body.id ?? ''))

    if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const result = await publish(connection, {
      caption: 'Test post from ComicAgent AI — your account is connected.',
      url: await siteUrl(request.nextUrl.origin),
    })

    return NextResponse.json({ ok: result.ok, error: result.error, url: result.remoteUrl })
  }

  if (body.action === 'disconnect') {
    const connection = await owned(String(body.id ?? ''))

    if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // The token is cleared, not just the status: a revoked row must not keep
    // a live credential in the database.
    await supabaseAdmin
      .from('social_connections')
      .update({ status: 'revoked', access_token: null, refresh_token: null, settings: {} })
      .eq('id', connection.id)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

/** Used by the Autopilot campaign form to list what it can post to. */
export async function PUT() {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const connections = await loadConnections(session.userId)

  return NextResponse.json({
    connections: connections.map((entry) => ({
      id: entry.id,
      platform: entry.platform,
      accountName: entry.account_name,
      status: entry.status,
    })),
  })
}

export const dynamic = 'force-dynamic'
