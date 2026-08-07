'use client'

import { useCallback, useState } from 'react'
import { LibraryFullDialog, type LibraryFullChoice } from '@/components/library-full-dialog'
import { saveToLibrary, downloadUrl, type SaveRequest, type FullLibrary } from '@/lib/library/save'
import type { LibraryKind } from '@/lib/library/quota'

/**
 * One save flow, shared by every generator.
 *
 * Each page used to upload a file and, for two of the four, write its own row
 * — so the rules about what is kept lived in four places and agreed in none.
 * A page now calls `save()` and renders `dialog`; everything about limits,
 * backups and what the customer chose happens here.
 */

export interface LibrarySaveState {
  /** Record a finished artefact. Resolves once the customer has decided. */
  save: (request: SaveRequest, downloadFallbackUrl?: string) => Promise<boolean>
  /** Render this somewhere in the page. Null unless a choice is needed. */
  dialog: React.ReactNode
  saving: boolean
  message: string
}

export function useLibrarySave(): LibrarySaveState {
  const [pending, setPending] = useState<{
    request: SaveRequest
    details: FullLibrary
    downloadUrl?: string
    resolve: (kept: boolean) => void
  } | null>(null)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const save = useCallback(
    async (request: SaveRequest, fallbackUrl?: string): Promise<boolean> => {
      setSaving(true)
      setMessage('')

      const outcome = await saveToLibrary(request)

      if (outcome.status === 'saved') {
        setSaving(false)
        setMessage(
          outcome.backedUp ? 'Saved to your library and your Drive.' : 'Saved to your library.'
        )
        return true
      }

      if (outcome.status === 'duplicate') {
        setSaving(false)
        setMessage('Already in your library.')
        return true
      }

      if (outcome.status === 'error') {
        setSaving(false)
        setMessage(outcome.message)
        return false
      }

      // Full. Hand it to the customer and wait for an answer.
      return new Promise<boolean>((resolve) => {
        setSaving(false)
        setPending({
          request,
          details: outcome.details,
          downloadUrl: fallbackUrl,
          resolve,
        })
      })
    },
    []
  )

  const decide = useCallback(
    async (choice: LibraryFullChoice) => {
      if (!pending) return

      const { request, details, downloadUrl: fallback, resolve } = pending

      if (choice.action === 'cancel') {
        setPending(null)
        setMessage('Not saved — your library is unchanged.')
        resolve(false)
        return
      }

      if (choice.action === 'download') {
        setPending(null)

        const url = fallback ?? request.publicUrl

        if (!url) {
          setMessage('There is nothing to download yet — try saving again once it has rendered.')
          resolve(false)
          return
        }

        const extension = request.path?.split('.').pop() ?? (request.kind === 'video' ? 'mp4' : 'pdf')
        const ok = await downloadUrl(url, `${request.title}.${extension}`)

        setMessage(
          ok
            ? 'Downloaded. It was not added to your library.'
            : 'Could not download it — try the download button on the item itself.'
        )
        resolve(false)
        return
      }

      // Replace the oldest, optionally backing it up first.
      setPending(null)
      setSaving(true)

      const outcome = await saveToLibrary(request, {
        replaceId: details.oldest?.id,
        backupFirst: choice.backupFirst,
      })

      setSaving(false)

      if (outcome.status === 'saved') {
        setMessage(
          choice.backupFirst
            ? `Backed up "${details.oldest?.title}" to your Drive and saved this one.`
            : 'Saved. The oldest item was removed.'
        )
        resolve(true)
        return
      }

      // A failed backup leaves everything where it was, on purpose.
      setMessage(outcome.status === 'error' ? outcome.message : 'Could not save it.')
      resolve(false)
    },
    [pending]
  )

  return {
    save,
    saving,
    message,
    dialog: pending ? (
      <LibraryFullDialog
        kind={pending.request.kind as LibraryKind}
        title={pending.request.title}
        details={pending.details}
        onChoose={decide}
      />
    ) : null,
  }
}
