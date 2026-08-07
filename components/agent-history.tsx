'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  History as HistoryIcon,
  Loader2,
  Trash2,
  Search,
  Download,
  ChevronDown,
  Rocket,
  Wand2,
  Film,
  ImagePlus,
  Globe,
  Megaphone,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Palette,
  Video,
  CloudUpload,
  Cloud,
  ExternalLink,
} from 'lucide-react'
import { listAgentRuns, deleteAgentRun, AGENT_LABELS, type AgentRun } from '@/lib/agents/history'
import { presentRun, presentInput, presentedToText } from '@/lib/agents/present'
import { ResultView } from '@/components/result-view'
import { AgentHeader, Card, ErrorNote, downloadText } from '@/components/agent-ui'
import { LIBRARY_KINDS, describeQuota, type LibraryKind, type Quota } from '@/lib/library/quota'

/**
 * Everything the customer has made.
 *
 * Two things were wrong with what this used to be:
 *
 *   - It listed agent runs only. Comics, colouring books and videos — the
 *     things people actually make here — were somewhere else entirely, so
 *     "History" answered a question nobody asked.
 *
 *   - It printed JSON.stringify(output) into a <pre>. Opening your own story
 *     showed you `{"pages":[{"panels":[{"image_prompt"…`, which is a debugging
 *     view, not a reading one.
 *
 * Now it is one timeline of saved files and agent runs, each rendered as the
 * thing it is. The keep-limit is shown here too, because this is the screen
 * where "why was that removed" gets asked.
 */

const ICONS: Record<string, typeof Rocket> = {
  business_agent: Rocket,
  story_to_comic: Wand2,
  comic_to_video: Film,
  cover_designer: ImagePlus,
  landing_page: Globe,
  marketing_content: Megaphone,
  prompt_enhancer: Sparkles,
  comic: BookOpen,
  coloring: Palette,
  video: Video,
  cover: ImagePlus,
  episode: Wand2,
}

const TONES: Record<string, string> = {
  business_agent: 'from-fuchsia-500 to-purple-600',
  story_to_comic: 'from-blue-500 to-indigo-600',
  comic_to_video: 'from-pink-500 to-rose-600',
  cover_designer: 'from-violet-500 to-purple-600',
  landing_page: 'from-emerald-500 to-teal-600',
  marketing_content: 'from-orange-500 to-rose-600',
  prompt_enhancer: 'from-amber-400 to-orange-500',
  comic: 'from-indigo-500 to-violet-600',
  coloring: 'from-teal-500 to-emerald-600',
  video: 'from-pink-500 to-rose-600',
  cover: 'from-violet-500 to-fuchsia-600',
  episode: 'from-cyan-500 to-blue-600',
}

interface LibraryItem {
  id: string
  kind: string
  title: string
  bucket: string | null
  path: string | null
  public_url: string | null
  cover_url: string | null
  drive_link: string | null
  drive_synced_at: string | null
  created_at: string
}

/** One list, whatever produced the entry. */
type Entry =
  | { source: 'file'; id: string; at: string; item: LibraryItem }
  | { source: 'run'; id: string; at: string; run: AgentRun }

export function AgentHistory() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [items, setItems] = useState<LibraryItem[]>([])
  const [quotas, setQuotas] = useState<Record<string, Quota>>({})
  const [driveConnected, setDriveConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    // The two halves fail independently: a missing agent_jobs table should not
    // hide the customer's comics, and vice versa.
    const [runResult, libraryResult] = await Promise.allSettled([
      listAgentRuns(),
      fetch('/api/library').then((response) => response.json()),
    ])

    if (runResult.status === 'fulfilled') setRuns(runResult.value)
    else console.error('[history] agent runs failed:', runResult.reason)

    if (libraryResult.status === 'fulfilled' && !libraryResult.value?.error) {
      setItems(libraryResult.value.items ?? [])
      setQuotas(libraryResult.value.quotas ?? {})
      setDriveConnected(Boolean(libraryResult.value.driveConnected))
    } else {
      console.error('[history] library failed:', libraryResult)
    }

    if (runResult.status === 'rejected' && libraryResult.status === 'rejected') {
      setError('Could not load your history. Please refresh.')
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const entries: Entry[] = useMemo(() => {
    const all: Entry[] = [
      ...items.map((item) => ({
        source: 'file' as const,
        id: `file-${item.id}`,
        at: item.created_at,
        item,
      })),
      ...runs.map((run) => ({ source: 'run' as const, id: `run-${run.id}`, at: run.created_at, run })),
    ]

    return all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [items, runs])

  const kinds = useMemo(() => {
    const present = new Set(entries.map((entry) => (entry.source === 'file' ? entry.item.kind : entry.run.agent)))

    return ['all', ...present]
  }, [entries])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return entries.filter((entry) => {
      const key = entry.source === 'file' ? entry.item.kind : entry.run.agent

      if (filter !== 'all' && key !== filter) return false
      if (!needle) return true

      const haystack =
        entry.source === 'file'
          ? entry.item.title
          : `${entry.run.current_step ?? ''} ${JSON.stringify(entry.run.input)}`

      return haystack.toLowerCase().includes(needle)
    })
  }, [entries, query, filter])

  const removeRun = async (id: string) => {
    if (!confirm('Delete this history entry?')) return

    setBusy(id)

    try {
      await deleteAgentRun(id)
      setRuns((current) => current.filter((run) => run.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
    } finally {
      setBusy(null)
    }
  }

  const removeItem = async (item: LibraryItem) => {
    if (!confirm(`Delete "${item.title}"? The file is removed too.`)) return

    setBusy(item.id)

    const response = await fetch(`/api/library?id=${item.id}`, { method: 'DELETE' })

    if (response.ok) {
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      setNotice('Removed. That frees a slot in your library.')
      await load()
    } else {
      setError('Could not delete that item.')
    }

    setBusy(null)
  }

  const backup = async (item: LibraryItem) => {
    setBusy(item.id)
    setNotice('')

    const response = await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'backup', itemId: item.id }),
    })

    const result = await response.json().catch(() => ({}))

    if (result.ok) {
      setNotice(`"${item.title}" is now in your Google Drive.`)
      await load()
    } else {
      setError(result.error ?? 'Could not back that up.')
    }

    setBusy(null)
  }

  const kindLabel = (key: string) =>
    LIBRARY_KINDS.find((entry) => entry.kind === key)?.label ?? AGENT_LABELS[key] ?? key

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<HistoryIcon className="w-5 h-5 text-white" />}
        gradient="from-slate-600 to-slate-800"
        title="History"
        subtitle="Everything you have made — reopen it, download it or back it up"
        action={
          !loading && entries.length > 0 ? (
            <span className="text-sm text-slate-500">{entries.length} items</span>
          ) : undefined
        }
      />

      {error && <ErrorNote message={error} />}

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-100 dark:ring-emerald-500/20 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </div>
      )}

      {/* How full the library is, per kind — this is the screen where "why
          was that removed" gets asked. */}
      {Object.keys(quotas).length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              How much you are keeping
            </p>

            {!driveConnected && (
              <Link href="/connections" className="text-xs font-semibold text-indigo-600 hover:underline">
                Back up to Google Drive
              </Link>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LIBRARY_KINDS.filter((entry) => quotas[entry.kind]).map((entry) => {
              const quota = quotas[entry.kind]
              const percent = quota.unlimited
                ? 0
                : Math.min(100, Math.round((quota.used / Math.max(1, quota.limit ?? 1)) * 100))

              return (
                <div key={entry.kind}>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">
                    {describeQuota(quota, entry.kind as LibraryKind)}
                  </p>

                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        quota.full ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: quota.unlimited ? '8%' : `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-indigo-400 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search everything you have made…"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none min-w-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
            >
              Clear
            </button>
          )}
        </div>

        {kinds.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {kinds.map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ring-1 ${
                  filter === key
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 ring-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700 hover:ring-slate-400'
                }`}
              >
                {key === 'all' ? 'All' : kindLabel(key)}
              </button>
            ))}
          </div>
        )}
      </Card>

      {loading ? (
        <Card className="py-16 flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-400">Loading your history…</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <HistoryIcon className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-display font-semibold text-slate-900 dark:text-white">
            {entries.length === 0 ? 'Nothing here yet' : 'Nothing matches that search'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {entries.length === 0
              ? 'Make a comic, a colouring book or a video and it shows up here.'
              : 'Try a different search or filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) =>
            entry.source === 'file' ? (
              <FileCard
                key={entry.id}
                item={entry.item}
                open={openId === entry.id}
                busy={busy === entry.item.id}
                driveConnected={driveConnected}
                onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
                onDelete={() => removeItem(entry.item)}
                onBackup={() => backup(entry.item)}
              />
            ) : (
              <RunCard
                key={entry.id}
                run={entry.run}
                open={openId === entry.id}
                busy={busy === entry.run.id}
                onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
                onDelete={() => removeRun(entry.run.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  A saved file
// ---------------------------------------------------------------------------

function FileCard({
  item,
  open,
  busy,
  driveConnected,
  onToggle,
  onDelete,
  onBackup,
}: {
  item: LibraryItem
  open: boolean
  busy: boolean
  driveConnected: boolean
  onToggle: () => void
  onDelete: () => void
  onBackup: () => void
}) {
  const [url, setUrl] = useState<string | null>(item.public_url)
  const Icon = ICONS[item.kind] ?? Sparkles
  const tone = TONES[item.kind] ?? 'from-slate-500 to-slate-700'

  // A private file needs a fresh signed URL, and only when someone opens it.
  useEffect(() => {
    if (!open || url || !item.bucket || !item.path) return

    let cancelled = false

    import('@/lib/db').then(async ({ supabase }) => {
      const { data } = await supabase.storage
        .from(item.bucket as string)
        .createSignedUrl(item.path as string, 3600)

      if (!cancelled && data?.signedUrl) setUrl(data.signedUrl)
    })

    return () => {
      cancelled = true
    }
  }, [open, url, item.bucket, item.path])

  const isVideo = item.kind === 'video'
  const isPdf = Boolean(item.path?.endsWith('.pdf'))

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        {item.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.cover_url}
            alt=""
            className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center shadow-md shrink-0`}
          >
            <Icon className="w-[18px] h-[18px] text-white" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-slate-900 dark:text-white text-sm truncate">
            {item.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            {LIBRARY_KINDS.find((entry) => entry.kind === item.kind)?.label ?? item.kind} ·{' '}
            {new Date(item.created_at).toLocaleString()}
            {item.drive_synced_at && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                <Cloud className="w-3 h-3" />
                in Drive
              </span>
            )}
          </p>
        </div>

        <button
          onClick={onToggle}
          className="h-8 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
        >
          {open ? 'Hide' : 'Open'}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {driveConnected && !item.drive_synced_at && (
          <button
            onClick={onBackup}
            disabled={busy}
            title="Back this up to Google Drive"
            className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete ${item.title}`}
          className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
          {!url ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            </div>
          ) : isVideo ? (
            <video src={url} controls playsInline className="w-full rounded-xl bg-black" />
          ) : isPdf ? (
            <object data={url} type="application/pdf" className="w-full h-[70vh] rounded-xl">
              <p className="text-sm text-slate-500 p-6 text-center">
                Your browser cannot show this here — use Download.
              </p>
            </object>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={item.title} className="w-full rounded-xl" />
          )}

          {url && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={url}
                download={item.title}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>

              {item.drive_link && (
                <a
                  href={item.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in Drive
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  An agent run
// ---------------------------------------------------------------------------

function RunCard({
  run,
  open,
  busy,
  onToggle,
  onDelete,
}: {
  run: AgentRun
  open: boolean
  busy: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const Icon = ICONS[run.agent] ?? Sparkles
  const tone = TONES[run.agent] ?? 'from-slate-500 to-slate-700'
  const failed = run.status === 'failed'

  const presented = presentRun(
    run.agent,
    run.output,
    run.current_step || AGENT_LABELS[run.agent] || run.agent
  )

  const inputs = presentInput(run.input)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center shadow-md shrink-0`}
        >
          <Icon className="w-[18px] h-[18px] text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display font-semibold text-slate-900 dark:text-white text-sm truncate">
              {presented.title}
            </p>
            {failed ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                <AlertTriangle className="w-2.5 h-2.5" />
                Failed
              </span>
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
          </div>

          <p className="text-xs text-slate-500 mt-0.5">
            {AGENT_LABELS[run.agent] ?? run.agent} · {new Date(run.created_at).toLocaleString()}
          </p>
        </div>

        <button
          onClick={onToggle}
          className="h-8 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
        >
          {open ? 'Hide' : 'Open'}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {run.output && (
          <button
            onClick={() =>
              downloadText(
                `${presented.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`,
                presentedToText(presented),
                'text/plain'
              )
            }
            title="Download as readable text"
            className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onDelete}
          disabled={busy}
          aria-label="Delete this run"
          className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-5">
          {run.error && <ErrorNote message={run.error} />}

          {presented.subtitle && (
            <p className="text-sm text-slate-600 dark:text-slate-400 italic">{presented.subtitle}</p>
          )}

          <ResultView presented={presented} />

          {inputs.length > 0 && (
            <details className="rounded-xl ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900">
                What you asked for
              </summary>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {inputs.map((pair) => (
                  <div key={pair.name} className="px-3 py-2 flex gap-3 text-xs">
                    <span className="w-32 shrink-0 font-semibold text-slate-500">{pair.name}</span>
                    <span className="text-slate-700 dark:text-slate-300 break-words">{pair.value}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
