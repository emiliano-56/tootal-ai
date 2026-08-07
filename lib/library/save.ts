'use client'

import type { LibraryKind } from '@/lib/library/quota'

/**
 * Recording something the customer just made.
 *
 * The generators used to upload a file and, for two of the four, write a row.
 * Videos and covers wrote nothing, so they existed only as objects in a bucket
 * and could not be listed, counted or backed up.
 *
 * Everything now comes through here, and the server decides whether there is
 * room. A full library comes back as `full` with the details the dialog needs
 * rather than as an error — the customer has a choice to make, not a problem.
 */

export interface SaveRequest {
  kind: LibraryKind
  title: string
  bucket?: string
  path?: string
  publicUrl?: string
  coverUrl?: string
  sizeBytes?: number
  meta?: Record<string, unknown>
}

export interface FullLibrary {
  quota: { limit: number | null; used: number; remaining: number | null; full: boolean }
  oldest: { id: string; title: string; createdAt: string; backedUp: boolean } | null
  driveConnected: boolean
}

export type SaveOutcome =
  | { status: 'saved'; backedUp: boolean }
  | { status: 'duplicate' }
  | { status: 'full'; details: FullLibrary }
  | { status: 'error'; message: string }

/** Ask the server to record it. */
export async function saveToLibrary(
  request: SaveRequest,
  options: { replaceId?: string; backupFirst?: boolean } = {}
): Promise<SaveOutcome> {
  try {
    const response = await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, ...options }),
    })

    const payload = await response.json().catch(() => ({}))

    if (response.status === 409 && payload.full) {
      return { status: 'full', details: payload as FullLibrary }
    }

    if (!response.ok) {
      return { status: 'error', message: payload.error ?? 'Could not save it to your library' }
    }

    if (payload.duplicate) return { status: 'duplicate' }

    return { status: 'saved', backedUp: Boolean(payload.backedUp) }
  } catch {
    return { status: 'error', message: 'Network error — please try again' }
  }
}

/**
 * Download a file the browser cannot link to directly.
 *
 * Used by the "keep this one instead" branch: the customer is choosing not to
 * store it, so it has to reach their disk before the tab is closed.
 */
export async function downloadUrl(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url)

    if (!response.ok) return false

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    URL.revokeObjectURL(objectUrl)

    return true
  } catch {
    return false
  }
}
