import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { loadApp, callbackUrl } from '@/lib/social/oauth'

/**
 * Backing a customer's work up to their own Google Drive.
 *
 * The scope is `drive.file`, which grants access only to files this app
 * created. It is the narrowest scope that can do the job: the customer's
 * existing documents stay invisible to us, and there is nothing here that
 * could read, alter or delete anything we did not put there.
 *
 * Tokens live in `social_connections` alongside the social ones. The plumbing
 * — refresh, RLS, disconnect — is identical, and the connect screens each
 * filter by their own catalogue so Drive never appears among the networks.
 */

export const DRIVE_PLATFORM = 'google_drive'
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export interface DriveConnection {
  id: string
  user_id: string
  account_id: string
  account_name: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  settings: Record<string, unknown>
  auto_sync: boolean
  status: string
}

export async function loadDrive(userId: string): Promise<DriveConnection | null> {
  const { data } = await supabaseAdmin
    .from('social_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', DRIVE_PLATFORM)
    .eq('status', 'active')
    .maybeSingle()

  return (data as DriveConnection) ?? null
}

// ---------------------------------------------------------------------------
//  Getting in
// ---------------------------------------------------------------------------

export async function driveAuthorizeUrl(origin: string, state: string): Promise<string | null> {
  const app = await loadApp(DRIVE_PLATFORM)

  if (!app?.enabled || !app.client_id) return null

  const params = new URLSearchParams({
    client_id: app.client_id,
    redirect_uri: callbackUrl(origin, DRIVE_PLATFORM),
    response_type: 'code',
    scope: DRIVE_SCOPE,
    // Google only issues a refresh token when both are set, and only on the
    // first consent — without them a connection dies in an hour and cannot be
    // renewed without the customer noticing and reconnecting.
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export interface DriveExchange {
  accountId: string
  accountName: string
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
}

export async function exchangeDriveCode(origin: string, code: string): Promise<DriveExchange> {
  const app = await loadApp(DRIVE_PLATFORM)

  if (!app?.client_id || !app.client_secret) throw new Error('Google Drive is not set up')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: app.client_id,
      client_secret: app.client_secret,
      redirect_uri: callbackUrl(origin, DRIVE_PLATFORM),
      grant_type: 'authorization_code',
    }),
  })

  const token = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!token.access_token) {
    throw new Error(
      String(token.error_description ?? token.error ?? 'Google refused the authorisation')
    )
  }

  const profile = (await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
    .then((r) => r.json())
    .catch(() => ({}))) as { id?: string; email?: string }

  return {
    accountId: profile.id ?? 'drive',
    accountName: profile.email ?? 'Google Drive',
    accessToken: String(token.access_token),
    refreshToken: token.refresh_token ? String(token.refresh_token) : null,
    expiresAt: token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
      : null,
  }
}

/**
 * A usable access token, renewed if it is about to expire.
 *
 * Google's access tokens last an hour, so almost every sync needs this.
 */
async function accessToken(connection: DriveConnection): Promise<string | null> {
  const expires = connection.expires_at ? new Date(connection.expires_at).getTime() : 0

  if (connection.access_token && expires - Date.now() > 5 * 60 * 1000) {
    return connection.access_token
  }

  if (!connection.refresh_token) return connection.access_token

  const app = await loadApp(DRIVE_PLATFORM)

  if (!app?.client_id || !app.client_secret) return connection.access_token

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: app.client_id,
      client_secret: app.client_secret,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const token = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!token.access_token) {
    await supabaseAdmin
      .from('social_connections')
      .update({ status: 'expired', last_error: 'Google would not renew the token' })
      .eq('id', connection.id)

    return null
  }

  const expiresAt = token.expires_in
    ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
    : null

  await supabaseAdmin
    .from('social_connections')
    .update({ access_token: String(token.access_token), expires_at: expiresAt, status: 'active' })
    .eq('id', connection.id)

  return String(token.access_token)
}

// ---------------------------------------------------------------------------
//  Uploading
// ---------------------------------------------------------------------------

/**
 * The folder everything goes into, created once and remembered.
 *
 * Without it every upload lands loose in My Drive, which is the fastest way to
 * make a customer regret connecting.
 */
async function folderId(connection: DriveConnection, token: string): Promise<string | null> {
  const stored = connection.settings.folderId

  if (typeof stored === 'string' && stored) return stored

  // It may already exist from a previous connection; searching first avoids a
  // second folder of the same name.
  const search = new URLSearchParams({
    q: `mimeType='${FOLDER_MIME}' and name='ComicAgent AI' and trashed=false`,
    fields: 'files(id)',
  })

  const found = (await fetch(`https://www.googleapis.com/drive/v3/files?${search}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => r.json())
    .catch(() => ({}))) as { files?: { id: string }[] }

  let id = found.files?.[0]?.id

  if (!id) {
    const created = (await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ComicAgent AI', mimeType: FOLDER_MIME }),
    })
      .then((r) => r.json())
      .catch(() => ({}))) as { id?: string }

    id = created.id
  }

  if (!id) return null

  await supabaseAdmin
    .from('social_connections')
    .update({ settings: { ...connection.settings, folderId: id } })
    .eq('id', connection.id)

  return id
}

export interface UploadResult {
  ok: boolean
  fileId?: string
  link?: string
  error?: string
}

/**
 * Send one file up.
 *
 * Multipart rather than resumable: everything this app produces is a few
 * megabytes, and resumable would cost an extra round trip per file for a
 * robustness nothing here needs.
 */
export async function uploadToDrive(
  connection: DriveConnection,
  file: { name: string; contentType: string; bytes: ArrayBuffer | Uint8Array }
): Promise<UploadResult> {
  try {
    const token = await accessToken(connection)

    if (!token) return { ok: false, error: 'Reconnect Google Drive — its access has expired' }

    const parent = await folderId(connection, token)

    const metadata = {
      name: file.name,
      ...(parent ? { parents: [parent] } : {}),
    }

    const form = new FormData()

    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append(
      'file',
      new Blob([file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes)], {
        type: file.contentType,
      })
    )

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      }
    )

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string
      webViewLink?: string
      error?: { message?: string }
    }

    if (!payload.id) {
      const message = payload.error?.message ?? 'Google Drive refused the upload'

      await supabaseAdmin
        .from('social_connections')
        .update({ last_error: message.slice(0, 500) })
        .eq('id', connection.id)

      return { ok: false, error: message }
    }

    await supabaseAdmin
      .from('social_connections')
      .update({ last_posted_at: new Date().toISOString(), last_error: null })
      .eq('id', connection.id)

    return { ok: true, fileId: payload.id, link: payload.webViewLink }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Back up one library item.
 *
 * Downloads from our storage and re-uploads, because Drive fetches nothing on
 * our behalf and a private bucket path means nothing to it.
 */
export async function backupItem(
  connection: DriveConnection,
  item: {
    id: string
    title: string
    kind: string
    bucket: string | null
    path: string | null
    public_url: string | null
  }
): Promise<UploadResult> {
  let bytes: ArrayBuffer | null = null
  let contentType = 'application/octet-stream'

  if (item.bucket && item.path) {
    const { data, error } = await supabaseAdmin.storage.from(item.bucket).download(item.path)

    if (error || !data) return { ok: false, error: error?.message ?? 'Could not read the file' }

    bytes = await data.arrayBuffer()
    contentType = data.type || contentType
  } else if (item.public_url) {
    const response = await fetch(item.public_url, { signal: AbortSignal.timeout(120_000) })

    if (!response.ok) return { ok: false, error: 'Could not read the file' }

    bytes = await response.arrayBuffer()
    contentType = response.headers.get('content-type') ?? contentType
  }

  if (!bytes) return { ok: false, error: 'Nothing to upload' }

  const extension =
    item.path?.split('.').pop() ?? (item.kind === 'video' ? 'mp4' : 'pdf')

  const safeTitle = item.title.replace(/[^\w\s-]/g, '').trim() || item.kind

  const result = await uploadToDrive(connection, {
    name: `${safeTitle}.${extension}`,
    contentType,
    bytes,
  })

  if (result.ok) {
    await supabaseAdmin
      .from('library_items')
      .update({
        drive_file_id: result.fileId,
        drive_link: result.link ?? null,
        drive_synced_at: new Date().toISOString(),
      })
      .eq('id', item.id)
  }

  return result
}
