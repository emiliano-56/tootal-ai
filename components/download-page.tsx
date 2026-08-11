'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, FileWarning, CheckCircle2, Clock } from 'lucide-react'

/**
 * What the buyer sees.
 *
 * They have no account and did not choose to be here — they clicked a link in
 * an email. So the page says one thing, has one button, and states the terms
 * plainly before they press it. A buyer who discovers the limit *after*
 * downloading has been surprised by something that was always true.
 */

interface Info {
  title: string
  message: string
  filename: string
  sizeBytes: number | null
  usable: boolean
  reason?: string
  remaining: number | null
  expiresAt: string | null
}

function readableSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }

  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function DownloadPage({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/d/${token}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          setError(payload?.error ?? 'This link is not valid.')
          return
        }

        setInfo(payload)
      })
      .catch(() => setError('Could not reach the server. Please try again.'))
      .finally(() => setLoading(false))
  }, [token])

  const download = async () => {
    setBusy(true)
    setError('')

    try {
      const response = await fetch(`/api/d/${token}`, { method: 'POST' })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.url) {
        setError(payload?.error ?? 'That did not work.')
        return
      }

      // Navigating rather than opening a tab: a pop-up blocker will stop the
      // second one, and this fires from a click so it is allowed.
      window.location.href = payload.url
      setDone(true)

      // The count has already moved, so what is left on screen is now wrong.
      setInfo((current) =>
        current && current.remaining !== null
          ? { ...current, remaining: Math.max(0, current.remaining - 1) }
          : current
      )
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-6">
          {loading && (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" />
            </div>
          )}

          {!loading && (error || !info?.usable) && (
            <div className="py-6 text-center">
              <FileWarning className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-900">This download is not available</p>
              <p className="text-sm text-slate-500 mt-1.5">
                {error || info?.reason || 'Ask the seller for a new link.'}
              </p>
            </div>
          )}

          {!loading && !error && info?.usable && (
            <>
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center mx-auto mb-3">
                  <Download className="w-6 h-6 text-white" />
                </div>

                <h1 className="font-display text-lg font-bold text-slate-900">
                  {info.title || 'Your download is ready'}
                </h1>

                {info.message && (
                  <p className="text-sm text-slate-500 mt-1.5 whitespace-pre-line">
                    {info.message}
                  </p>
                )}
              </div>

              <button
                onClick={download}
                disabled={busy}
                className="mt-5 w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : done ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {done ? 'Download again' : `Download ${info.filename}`}
              </button>

              <p className="mt-2 text-center text-xs text-slate-400">
                {readableSize(info.sizeBytes)}
              </p>

              {/* Said before the button is pressed. Discovering the limit
                  afterwards is being surprised by something always true. */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                {info.remaining !== null && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Download className="w-3 h-3 shrink-0" />
                    {info.remaining} download{info.remaining === 1 ? '' : 's'} left on this link
                  </p>
                )}

                {info.expiresAt && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 shrink-0" />
                    Available until {new Date(info.expiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Having trouble? Reply to the email this link came in.
        </p>
      </div>
    </main>
  )
}
