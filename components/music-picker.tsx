'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2, Music, Play, Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { licence, type Track } from '@/lib/audio/licences'

/**
 * Finding music the customer can legally publish.
 *
 * "Copyright free" covers several quite different licences, and the differences
 * land on whoever gets the strike — so each result says plainly what it costs
 * to use. A track that cannot go on a monetised video is shown greyed out with
 * the reason, rather than hidden: knowing why is more useful than a shorter
 * list.
 *
 * Where a credit is required the exact line is generated and copied for them.
 * A credit that omits the licence is not a valid one, and nobody types that
 * from memory.
 */

interface Result extends Track {
  usable: boolean
  warning?: string
  reason?: string
  credit: string
}

export function MusicPicker({
  onPick,
  onClose,
}: {
  onPick: (track: Result) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [useCase, setUseCase] = useState<'commercial' | 'personal'>('commercial')
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [partial, setPartial] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const search = async () => {
    if (!query.trim()) return

    setSearching(true)
    setError('')
    setPartial('')

    try {
      const response = await fetch(
        `/api/audio/search?q=${encodeURIComponent(query)}&use=${useCase}`
      )

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) setError(payload.error ?? 'Search failed')
      else {
        setResults(payload.tracks ?? [])
        setPartial(payload.partial ?? '')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Find music"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Find music
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Creative Commons and royalty-free, with the credit line worked out for you.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && search()}
                placeholder="gentle lullaby, upbeat adventure, calm piano…"
                className="flex-1 h-11 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none min-w-0"
              />
            </div>

            <button
              onClick={search}
              disabled={searching || !query.trim()}
              className="px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold disabled:opacity-50"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* This decides which licences are usable, so it is a question
              asked up front rather than a filter buried in the results. */}
          <div className="flex gap-2">
            {(['commercial', 'personal'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setUseCase(option)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 transition-colors ${
                  useCase === option
                    ? 'bg-indigo-600 text-white ring-indigo-600'
                    : 'ring-slate-200 dark:ring-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {option === 'commercial' ? 'Selling or monetising' : 'Personal use'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {error && (
            <p className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-sm text-red-600">{error}</p>
          )}

          {partial && (
            <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
              {partial}
            </p>
          )}

          {searched && results.length === 0 && !error && (
            <div className="py-12 text-center">
              <Music className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nothing found for that.</p>
              <p className="text-xs text-slate-400 mt-1">
                Try a mood rather than a title — &ldquo;calm piano&rdquo; finds more than a song name.
              </p>
            </div>
          )}

          {results.map((track) => {
            const info = licence(track.licence)

            return (
              <div
                key={`${track.provider}-${track.externalId}`}
                className={`rounded-2xl ring-1 p-3.5 ${
                  track.usable
                    ? 'ring-slate-200 dark:ring-slate-800'
                    : 'ring-slate-100 dark:ring-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setPlaying(playing === track.url ? null : track.url)}
                    aria-label={`Preview ${track.title}`}
                    className="shrink-0 w-9 h-9 rounded-full grid place-items-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  >
                    <Play className="w-4 h-4" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {track.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {track.artist || 'Unknown artist'}
                      {track.duration ? ` · ${Math.round(track.duration)}s` : ''}
                      {` · ${track.provider}`}
                    </p>

                    <p
                      className={`mt-1 text-[11px] ${
                        track.usable ? 'text-slate-500 dark:text-slate-400' : 'text-red-500'
                      }`}
                    >
                      <span className="font-semibold">{info?.label ?? track.licence}</span>
                      {' — '}
                      {track.reason ?? track.warning ?? info?.summary}
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-col gap-1.5">
                    <button
                      onClick={() => onPick(track)}
                      disabled={!track.usable}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40"
                    >
                      Use
                    </button>

                    {track.credit && (
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(track.credit)
                          setCopied(track.url)
                          setTimeout(() => setCopied(null), 1500)
                        }}
                        title="Copy the credit line"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"
                      >
                        {copied === track.url ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        Credit
                      </button>
                    )}
                  </div>
                </div>

                {playing === track.url && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio src={track.url} controls autoPlay className="w-full mt-3 h-9" />
                )}

                {track.usable && track.warning && (
                  <p className="mt-2 text-[11px] text-amber-600 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                    {track.warning}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
