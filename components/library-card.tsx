'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, Cloud, FolderOpen, Loader2 } from 'lucide-react'
import { LIBRARY_KINDS, type Quota } from '@/lib/library/quota'

/**
 * How full the library is, on the dashboard.
 *
 * The keep-limit is the one rule a customer can hit without having done
 * anything wrong, and the first they knew about it used to be a dialog
 * interrupting a save. Showing it here turns it into something they can see
 * coming — which is the whole difference between a rule and an ambush.
 *
 * Only the kinds they actually have are drawn. A row of empty bars for
 * features they have never used is noise, and it makes the one that matters
 * harder to spot.
 */

export function LibraryCard() {
  const [quotas, setQuotas] = useState<Record<string, Quota>>({})
  const [driveConnected, setDriveConnected] = useState(false)
  const [autoSync, setAutoSync] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch('/api/library')
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return

        setQuotas(payload.quotas ?? {})
        setDriveConnected(Boolean(payload.driveConnected))
        setAutoSync(Boolean(payload.autoSync))
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Anything used, plus anything nearly full even at zero — a limit of zero
  // is worth showing rather than hiding.
  const shown = LIBRARY_KINDS.filter((entry) => {
    const quota = quotas[entry.kind]

    return quota && (quota.used > 0 || quota.full)
  })

  const anyFull = shown.some((entry) => quotas[entry.kind]?.full)

  if (loading) {
    return (
      <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading your library…
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-indigo-500 to-violet-600">
            <FolderOpen className="w-4 h-4 text-white" />
          </span>

          <div>
            <h3 className="font-display font-bold text-slate-900 dark:text-white text-sm">
              Your library
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {driveConnected ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Cloud className="w-3 h-3" />
                  {autoSync ? 'Backing up to Drive automatically' : 'Google Drive connected'}
                </span>
              ) : (
                'Not backed up'
              )}
            </p>
          </div>
        </div>

        <Link
          href="/history"
          className="text-xs font-semibold text-indigo-600 hover:underline shrink-0"
        >
          See everything
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nothing saved yet. Make a comic and it turns up here.
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((entry) => {
            const quota = quotas[entry.kind]
            const percent = quota.unlimited
              ? 0
              : Math.min(100, Math.round((quota.used / Math.max(1, quota.limit ?? 1)) * 100))

            return (
              <div key={entry.kind}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-xs text-slate-600 dark:text-slate-300">{entry.plural}</span>

                  <span
                    className={`text-[11px] tabular-nums ${
                      quota.full ? 'text-amber-600 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {quota.unlimited ? `${quota.used} · unlimited` : `${quota.used} / ${quota.limit}`}
                  </span>
                </div>

                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quota.full ? 'bg-amber-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: quota.unlimited ? '10%' : `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Said before the next save is interrupted, not after. */}
      {anyFull && (
        <p className="mt-4 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            One of these is full. The next thing you make will ask what to remove —{' '}
            {driveConnected ? (
              'and your Drive backup means nothing is lost.'
            ) : (
              <Link href="/connections" className="font-semibold underline">
                connect Google Drive
              </Link>
            )}
            {!driveConnected && ' so nothing is lost.'}
          </span>
        </p>
      )}

      {!anyFull && driveConnected && autoSync && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-emerald-600">
          <Check className="w-3.5 h-3.5" />
          Everything new is copied to your Drive as it is made.
        </p>
      )}
    </div>
  )
}
