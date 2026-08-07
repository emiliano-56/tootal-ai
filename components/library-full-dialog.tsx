'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AlertTriangle, Check, CloudUpload, Download, Loader2, Trash2, X } from 'lucide-react'
import { LIBRARY_KINDS, type LibraryKind } from '@/lib/library/quota'
import type { FullLibrary } from '@/lib/library/save'

/**
 * "Your library is full — what should go?"
 *
 * The rule this screen exists to keep: nothing the customer made is ever lost
 * without them saying so. Every option here ends with the file somewhere —
 * downloaded to their disk, copied to their Drive, or knowingly replaced.
 *
 * The oldest item is named, not just counted. "The oldest will be deleted" is
 * a promise nobody can check; "Pip Cannot Sleep, saved 3 March" is one they
 * can act on.
 *
 * Rendered through a portal for the same reason the share dialog is: a
 * generator page may sit inside a transformed container, which would trap a
 * position:fixed overlay and clip its close button.
 */

export interface LibraryFullChoice {
  /** Replace the oldest item; back it up to Drive first when asked. */
  action: 'replace' | 'download' | 'cancel'
  backupFirst?: boolean
}

export function LibraryFullDialog({
  kind,
  title,
  details,
  onChoose,
}: {
  kind: LibraryKind
  /** What the customer just made and is trying to keep. */
  title: string
  details: FullLibrary
  onChoose: (choice: LibraryFullChoice) => void
}) {
  const [busy, setBusy] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onChoose({ action: 'cancel' })
    }

    const previous = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onChoose])

  if (!mounted) return null

  const label = LIBRARY_KINDS.find((entry) => entry.kind === kind)
  const plural = label?.plural.toLowerCase() ?? kind
  const { quota, oldest, driveConnected } = details

  const choose = (choice: LibraryFullChoice, tag: string) => {
    setBusy(tag)
    onChoose(choice)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => onChoose({ action: 'cancel' })}
      role="dialog"
      aria-modal="true"
      aria-label="Library full"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded-xl grid place-items-center bg-amber-50 dark:bg-amber-500/10">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
            </span>

            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Your library is full
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {quota.used} of {quota.limit} {plural} kept
              </p>
            </div>
          </div>

          <button
            onClick={() => onChoose({ action: 'cancel' })}
            aria-label="Close"
            className="shrink-0 w-9 h-9 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            To keep <strong className="text-slate-900 dark:text-white">{title}</strong> you need a
            free slot. Nothing is removed until you choose.
          </p>

          {/* What would go, named rather than described */}
          {oldest && (
            <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-4 bg-slate-50 dark:bg-slate-800/40">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Oldest in your library
              </p>

              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {oldest.title}
              </p>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saved {new Date(oldest.createdAt).toLocaleDateString()}
                {oldest.backedUp && (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-semibold">
                    <Check className="w-3 h-3" />
                    already in your Drive
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {/* Safest first: nothing is lost at all. */}
            {driveConnected && oldest && !oldest.backedUp && (
              <Option
                icon={<CloudUpload className="w-4 h-4" />}
                tone="primary"
                busy={busy === 'backup'}
                title="Back up the oldest to Google Drive, then replace it"
                hint={`"${oldest.title}" is copied to your Drive first. Nothing is lost.`}
                onClick={() => choose({ action: 'replace', backupFirst: true }, 'backup')}
              />
            )}

            <Option
              icon={<Download className="w-4 h-4" />}
              busy={busy === 'download'}
              title="Download this one instead"
              hint="Saves it to your device and leaves your library untouched."
              onClick={() => choose({ action: 'download' }, 'download')}
            />

            {oldest && (
              <Option
                icon={<Trash2 className="w-4 h-4" />}
                tone={oldest.backedUp ? 'primary' : 'danger'}
                busy={busy === 'replace'}
                title={`Delete "${oldest.title}" and keep this one`}
                hint={
                  oldest.backedUp
                    ? 'It is already in your Drive, so this only removes the local copy.'
                    : 'This cannot be undone.'
                }
                onClick={() => choose({ action: 'replace' }, 'replace')}
              />
            )}
          </div>

          {!driveConnected && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
              <Link href="/connections" className="font-semibold text-indigo-600 hover:underline">
                Connect Google Drive
              </Link>{' '}
              to back work up automatically, and this stops being a choice you have to make.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function Option({
  icon,
  title,
  hint,
  onClick,
  busy,
  tone = 'plain',
}: {
  icon: React.ReactNode
  title: string
  hint: string
  onClick: () => void
  busy?: boolean
  tone?: 'plain' | 'primary' | 'danger'
}) {
  const styles =
    tone === 'primary'
      ? 'ring-indigo-200 dark:ring-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/15'
      : tone === 'danger'
        ? 'ring-red-100 dark:ring-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10'
        : 'ring-slate-200 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'

  const iconTone =
    tone === 'primary' ? 'text-indigo-600' : tone === 'danger' ? 'text-red-500' : 'text-slate-500'

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`w-full flex items-start gap-3 text-left p-3.5 rounded-2xl ring-1 transition-colors disabled:opacity-60 ${styles}`}
    >
      <span className={`shrink-0 mt-0.5 ${iconTone}`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</span>
      </span>
    </button>
  )
}
