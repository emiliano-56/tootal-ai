import 'server-only'

import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Permanent public addresses for private work.
 *
 * A comic lives in a private bucket and is served by a signed URL that dies
 * after an hour — fine for a download button, useless on Facebook, which
 * fetches the page days later to build its preview.
 *
 * A share link is a stable token. The page behind it signs a fresh URL every
 * time it is viewed, so the file stays private and the link never breaks.
 */

export interface SharedItem {
  id: string
  token: string
  user_id: string
  kind: string
  title: string
  caption: string
  hashtags: string[]
  bucket: string | null
  path: string | null
  public_url: string | null
  body: string | null
  preview_url: string | null
  views: number
  revoked: boolean
  created_at: string
}

/**
 * A token that is short enough to paste and long enough not to be guessed.
 *
 * base64url of 12 bytes: 16 characters, 96 bits. Someone enumerating these
 * would be at it for the lifetime of the universe, which is the point — the
 * token is the only thing protecting the link.
 */
export function newToken(): string {
  return randomBytes(12).toString('base64url')
}

export interface CreateShareInput {
  userId: string
  tenantId?: string | null
  kind: string
  title: string
  caption?: string
  hashtags?: string[]
  bucket?: string | null
  path?: string | null
  publicUrl?: string | null
  /** Text to render when there is no file — an Autopilot episode, say. */
  body?: string | null
  previewUrl?: string | null
  projectId?: string | null
}

/**
 * Create a link, or return the one this item already has.
 *
 * Sharing the same comic twice must not mint a second address: the first is
 * already out in the world, and two links to one thing split its view count.
 */
export async function createShare(input: CreateShareInput): Promise<SharedItem | null> {
  if (!input.path && !input.publicUrl && !input.body) return null

  if (input.path || input.publicUrl) {
    const query = supabaseAdmin
      .from('shared_items')
      .select('*')
      .eq('user_id', input.userId)
      .eq('revoked', false)
      .limit(1)

    const { data: existing } = input.path
      ? await query.eq('path', input.path).maybeSingle()
      : await query.eq('public_url', input.publicUrl!).maybeSingle()

    if (existing) return existing as SharedItem
  }

  const { data, error } = await supabaseAdmin
    .from('shared_items')
    .insert({
      token: newToken(),
      user_id: input.userId,
      tenant_id: input.tenantId ?? null,
      kind: input.kind,
      title: input.title.slice(0, 200),
      caption: (input.caption ?? '').slice(0, 2000),
      hashtags: (input.hashtags ?? []).slice(0, 10),
      bucket: input.bucket ?? null,
      path: input.path ?? null,
      public_url: input.publicUrl ?? null,
      body: input.body ?? null,
      preview_url: input.previewUrl ?? null,
      project_id: input.projectId ?? null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[share] could not create link:', error.message)
    return null
  }

  return data as SharedItem
}

export interface ResolvedShare {
  item: SharedItem
  /** Ready to render right now; signed afresh if the file is private. */
  url: string | null
  previewUrl: string | null
}

/**
 * Everything the public page needs.
 *
 * Reads through the service role because the viewer is not signed in — RLS
 * would return nothing. The token is the authorisation.
 */
export async function resolveShare(token: string): Promise<ResolvedShare | null> {
  const { data } = await supabaseAdmin
    .from('shared_items')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!data) return null

  const item = data as SharedItem

  if (item.revoked) return null

  let url = item.public_url

  if (!url && item.bucket && item.path) {
    // A week, so a preview a network cached yesterday still resolves, but not
    // so long that a revoked share stays reachable for months.
    const { data: signed } = await supabaseAdmin.storage
      .from(item.bucket)
      .createSignedUrl(item.path, 60 * 60 * 24 * 7)

    url = signed?.signedUrl ?? null
  }

  let previewUrl = item.preview_url

  if (previewUrl && item.bucket && !previewUrl.startsWith('http')) {
    const { data: signed } = await supabaseAdmin.storage
      .from(item.bucket)
      .createSignedUrl(previewUrl, 60 * 60 * 24 * 7)

    previewUrl = signed?.signedUrl ?? null
  }

  return { item, url, previewUrl }
}

/** Count a view. Never allowed to fail the page it is counting. */
export async function countView(id: string, current: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('shared_items')
    .update({ views: current + 1 })
    .eq('id', id)

  if (error) console.error('[share] view count failed:', error.message)
}

/** The absolute address of a share, for the buttons and the OG tags. */
export function shareLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/s/${token}`
}
