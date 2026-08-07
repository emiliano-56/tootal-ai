'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Download, Link2, Loader2, Share2, X } from 'lucide-react'
import {
  SHAREABLE,
  shareUrl,
  captionFor,
  fallbackUrl,
  network,
  type NetworkId,
} from '@/lib/social/networks'

/**
 * Sharing something you made.
 *
 * The link has to exist before it can be shared, so the first click creates
 * one — a permanent public address for a file that otherwise lives behind a
 * signed URL that expires in an hour.
 *
 * The dialog is rendered into document.body rather than in place. A card in
 * this app animates with `translate-y`, and a transformed ancestor becomes the
 * containing block for `position: fixed` — so an in-place modal ends up
 * trapped inside the card and clipped by its `overflow-hidden`, losing its own
 * close button. A portal is the only reliable way out.
 */

export interface ShareSource {
  kind: 'comic' | 'video' | 'cover' | 'coloring' | 'episode'
  title: string
  caption?: string
  hashtags?: string[]
  /** A private file in storage, signed fresh whenever the link is opened. */
  bucket?: string
  path?: string
  /** Something already public, like a rendered video. */
  publicUrl?: string
  previewUrl?: string
  projectId?: string
}

export function ShareBar({ source, compact }: { source: ShareSource; compact?: boolean }) {
  const [open, setOpen] = useState(false)

  const disabled = !source.path && !source.publicUrl

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? 'Save it first, then you can share it' : 'Share'}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40'
            : 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:opacity-90 disabled:opacity-40'
        }
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {open && <ShareDialog source={source} onClose={() => setOpen(false)} />}
    </>
  )
}

// ---------------------------------------------------------------------------
//  The dialog
// ---------------------------------------------------------------------------

function ShareDialog({ source, onClose }: { source: ShareSource; onClose: () => void }) {
  const [link, setLink] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<'link' | 'caption' | null>(null)
  const [note, setNote] = useState('')
  const [mounted, setMounted] = useState(false)

  // document.body does not exist during the server render.
  useEffect(() => setMounted(true), [])

  // Escape closes, and the page behind must not scroll while this is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const previous = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  /** Mint the link once, then reuse it for every button in this dialog. */
  const ensureLink = useCallback(async (): Promise<string> => {
    if (link) return link

    setCreating(true)
    setError('')

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(payload.error ?? 'Could not create a link')
        return ''
      }

      setLink(payload.url)
      return payload.url as string
    } catch {
      setError('Network error — please try again')
      return ''
    } finally {
      setCreating(false)
    }
  }, [link, source])

  // Created as the dialog opens, so the link and its preview are ready before
  // anything is clicked.
  useEffect(() => {
    ensureLink()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const target = (url: string) => ({
    url,
    title: source.title,
    text: source.caption,
    hashtags: source.hashtags,
  })

  const openNetwork = async (id: NetworkId) => {
    const url = await ensureLink()

    if (!url) return

    const intent = shareUrl(id, target(url))

    if (intent) {
      window.open(intent, 'comictale-share', 'width=680,height=700,noopener,noreferrer')
      return
    }

    // No share link exists for this platform. Put everything on the clipboard
    // and open the site, so the customer only has to paste.
    await navigator.clipboard.writeText(captionFor(target(url)))
    setNote(`Caption copied — ${network(id)?.label} has no share link, so paste it there.`)

    const fallback = fallbackUrl(id)

    if (fallback) window.open(fallback, '_blank', 'noopener,noreferrer')
  }

  /** The OS share sheet. The only route to Instagram from a phone. */
  const nativeShare = async () => {
    const url = await ensureLink()

    if (!url) return

    try {
      await navigator.share({ title: source.title, text: source.caption ?? source.title, url })
    } catch {
      // Dismissing the sheet rejects. Not an error worth showing.
    }
  }

  const copy = async (what: 'link' | 'caption') => {
    const url = await ensureLink()

    if (!url) return

    await navigator.clipboard.writeText(what === 'link' ? url : captionFor(target(url)))
    setCopied(what)
    setTimeout(() => setCopied(null), 1600)
  }

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  if (!mounted) return null

  return createPortal(
    <div
      // Bottom sheet on a phone, centred card from `sm` up.
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${source.title}`}
    >
      <div
        // Clicks inside must not reach the backdrop's close handler.
        onClick={(event) => event.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        {/* Header — sticky, so the close button is reachable however far down
            the customer has scrolled. */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Share
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{source.title}</p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <p className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 ring-1 ring-red-100 dark:ring-red-500/20 text-sm text-red-600">
              {error}
            </p>
          )}

          {note && (
            <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-100 dark:ring-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
              {note}
            </p>
          )}

          {/* What is being shared */}
          {source.previewUrl && (
            <div className="rounded-2xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 bg-slate-50 dark:bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={source.previewUrl}
                alt=""
                className="w-full h-32 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* The link itself, so it is obvious what the buttons will send */}
          <div className="flex items-center gap-2 p-1 pl-3 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <span className="flex-1 min-w-0 truncate text-xs text-slate-600 dark:text-slate-300 font-mono">
              {creating && !link ? 'Creating your link…' : link || '—'}
            </span>

            <button
              onClick={() => copy('link')}
              disabled={creating}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {copied === 'link' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>

          {canNativeShare && (
            <button
              onClick={nativeShare}
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:opacity-90 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              Share to any app
            </button>
          )}

          {/* Networks */}
          <div>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Post to
            </p>

            <div className="grid grid-cols-4 gap-2">
              {SHAREABLE.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => openNetwork(entry.id)}
                  disabled={creating}
                  title={entry.note ?? `Share on ${entry.label}`}
                  className="group flex flex-col items-center gap-2 py-3 px-1 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 hover:ring-slate-300 dark:hover:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  <span
                    className="w-10 h-10 rounded-full grid place-items-center text-white shadow-sm group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: entry.colour }}
                  >
                    <BrandMark id={entry.id} />
                  </span>

                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 leading-none">
                    {entry.label.replace(' (Twitter)', '')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Secondary actions */}
          <div className="pt-1 space-y-2">
            <button
              onClick={() => copy('caption')}
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {copied === 'caption' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied === 'caption' ? 'Caption copied' : 'Copy caption and hashtags'}
            </button>

            {source.publicUrl && (
              <a
                href={source.publicUrl}
                download
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="w-4 h-4" />
                Download to post by hand
              </a>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed text-center">
            Instagram and Quora have no share link — those buttons copy your caption and open the
            site. On a phone, &ldquo;Share to any app&rdquo; reaches Instagram directly.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ---------------------------------------------------------------------------
//  Brand marks
// ---------------------------------------------------------------------------
//  Drawn inline rather than pulled from an icon set: lucide has no brand
//  glyphs, and a letter in a circle reads as a placeholder.

function BrandMark({ id }: { id: NetworkId }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'currentColor' } as const

  switch (id) {
    case 'facebook':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.6V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.2H7.4V13h2.3v8h3.8Z" />
        </svg>
      )

    case 'twitter':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M17.3 3h3.3l-7.2 8.3L21.8 21h-6l-4.7-6.1L5.7 21H2.4l7.6-8.7L2.6 3h6.1l4.4 5.8L17.3 3Zm-1.1 16h1.8L7.1 4.8H5.2L16.2 19Z" />
        </svg>
      )

    case 'linkedin':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.35c0-1.28-.02-2.92-1.78-2.92-1.78 0-2.05 1.39-2.05 2.83V21h-4V9Z" />
        </svg>
      )

    case 'telegram':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M21.5 4.3 18.6 19c-.2 1-.8 1.2-1.6.75l-4.4-3.24-2.1 2.03c-.24.24-.44.44-.9.44l.32-4.5 8.2-7.4c.36-.32-.08-.5-.55-.18L7.4 13.3l-4.35-1.36c-.94-.3-.96-.94.2-1.4l16.9-6.5c.78-.28 1.47.19 1.35 2.26Z" />
        </svg>
      )

    case 'whatsapp':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.1c-.24.66-1.4 1.28-1.93 1.32-.53.05-1.02.24-2.9-.6-2.27-1-3.7-3.4-3.8-3.56-.12-.16-.9-1.24-.9-2.36 0-1.12.6-1.67.8-1.9.2-.24.44-.3.6-.3h.42c.14 0 .32-.04.5.38l.7 1.7c.06.14.1.3 0 .46l-.28.42-.4.44c-.12.12-.26.26-.1.52.15.26.68 1.13 1.46 1.83.99.9 1.5 1.06 1.76 1.18.26.12.4.1.56-.06l.8-.93c.2-.26.38-.18.62-.09l1.63.77c.24.12.4.18.46.28.06.1.06.6-.18 1.26Z" />
        </svg>
      )

    case 'reddit':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M22 11.8a2.1 2.1 0 0 0-3.56-1.5 10.3 10.3 0 0 0-5.1-1.6l1.05-3.3 2.8.64a1.6 1.6 0 1 0 .2-1.02l-3.4-.78a.5.5 0 0 0-.58.34L12.1 8.7a10.4 10.4 0 0 0-5.4 1.6 2.1 2.1 0 1 0-2.3 3.4 3.9 3.9 0 0 0-.05.6c0 3.1 3.6 5.6 8.05 5.6s8.05-2.5 8.05-5.6a3.8 3.8 0 0 0-.05-.58A2.1 2.1 0 0 0 22 11.8ZM8.3 13.2a1.3 1.3 0 1 1 1.3 1.3 1.3 1.3 0 0 1-1.3-1.3Zm7.3 3.7a5.1 5.1 0 0 1-3.2.94 5.1 5.1 0 0 1-3.2-.94.44.44 0 0 1 .6-.64 4.3 4.3 0 0 0 2.6.7 4.3 4.3 0 0 0 2.6-.7.44.44 0 1 1 .6.64Zm-.2-2.4a1.3 1.3 0 1 1 1.3-1.3 1.3 1.3 0 0 1-1.3 1.3Z" />
        </svg>
      )

    case 'instagram':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.23 1 .5 1.4.94.44.44.71.83.94 1.4.17.44.36 1.03.42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2a3.9 3.9 0 0 1-.94 1.4c-.44.44-.83.71-1.4.94-.44.17-1.03.36-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42a3.9 3.9 0 0 1-1.4-.94 3.9 3.9 0 0 1-.94-1.4c-.17-.44-.36-1.03-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.23-.6.5-1 .94-1.4.44-.44.83-.71 1.4-.94.44-.17 1.03-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.14 0-3.5.01-4.72.07-.94.04-1.4.19-1.72.32-.4.15-.65.33-.94.62-.29.29-.47.54-.62.94-.13.32-.28.78-.32 1.72C3.62 8.9 3.6 9.26 3.6 12s.01 3.1.07 4.32c.04.94.19 1.4.32 1.72.15.4.33.65.62.94.29.29.54.47.94.62.32.13.78.28 1.72.32 1.22.06 1.58.07 4.72.07s3.5-.01 4.72-.07c.94-.04 1.4-.19 1.72-.32.4-.15.65-.33.94-.62.29-.29.47-.54.62-.94.13-.32.28-.78.32-1.72.06-1.22.07-1.58.07-4.32s-.01-3.1-.07-4.32c-.04-.94-.19-1.4-.32-1.72a2.5 2.5 0 0 0-.62-.94 2.5 2.5 0 0 0-.94-.62c-.32-.13-.78-.28-1.72-.32C15.5 4.01 15.14 4 12 4Zm0 3.03a4.97 4.97 0 1 1 0 9.94 4.97 4.97 0 0 1 0-9.94Zm0 1.8a3.17 3.17 0 1 0 0 6.34 3.17 3.17 0 0 0 0-6.34Zm5.2-2.06a1.16 1.16 0 1 1 0 2.32 1.16 1.16 0 0 1 0-2.32Z" />
        </svg>
      )

    case 'quora':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12.6 17.3c-.9-1.8-2-3.7-4.3-3.7-.45 0-.9.07-1.3.26l-.75-1.5c.55-.47 1.6-.9 2.9-.9 2.05 0 3.4 1 4.4 2.5.55-1.15.8-2.7.8-4.6 0-4.8-1.5-7.2-5-7.2-3.45 0-4.95 2.4-4.95 7.2 0 4.75 1.5 7.15 4.95 7.15.6 0 1.15-.05 1.6-.2Zm1.05 1.9a10.7 10.7 0 0 1-2.65.35C5.7 19.55 2 15.7 2 9.65 2 3.55 5.7-.3 11 -.3c5.4 0 9.05 3.8 9.05 9.95 0 3.4-1.2 6.2-3.15 8 .65 1 1.35 1.65 2.3 1.65 1.05 0 1.5-.8 1.55-1.5h1.75c.05.9-.4 4.15-4.2 4.15-2.3 0-3.5-1.3-4.65-2.75Z" />
        </svg>
      )

    default:
      return null
  }
}
