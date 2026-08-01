'use client'

import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import {
  listAgentRuns,
  deleteAgentRun,
  AGENT_LABELS,
  type AgentRun,
} from '@/lib/agents/history'
import { AgentHeader, Card, ErrorNote, downloadText } from '@/components/agent-ui'

const ICONS: Record<string, any> = {
  business_agent: Rocket,
  story_to_comic: Wand2,
  comic_to_video: Film,
  cover_designer: ImagePlus,
  landing_page: Globe,
  marketing_content: Megaphone,
  prompt_enhancer: Sparkles,
}

const TONES: Record<string, string> = {
  business_agent: 'from-fuchsia-500 to-purple-600',
  story_to_comic: 'from-blue-500 to-indigo-600',
  comic_to_video: 'from-pink-500 to-rose-600',
  cover_designer: 'from-violet-500 to-purple-600',
  landing_page: 'from-emerald-500 to-teal-600',
  marketing_content: 'from-orange-500 to-rose-600',
  prompt_enhancer: 'from-amber-400 to-orange-500',
}

export function AgentHistory() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setRuns(await listAgentRuns())
    } catch (err: any) {
      console.error('[history] load failed:', err)
      const missing =
        err?.code === 'PGRST205' ||
        /could not find the table|does not exist/i.test(err?.message ?? '')
      setError(
        missing
          ? 'Database setup pending — run supabase/migrations/001_agent_foundation.sql, then refresh.'
          : 'Could not load your history.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const agents = useMemo(
    () => ['all', ...Array.from(new Set(runs.map((r) => r.agent)))],
    [runs]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return runs.filter((r) => {
      const byAgent = filter === 'all' || r.agent === filter
      if (!q) return byAgent
      const haystack = `${r.current_step ?? ''} ${JSON.stringify(r.input)}`.toLowerCase()
      return byAgent && haystack.includes(q)
    })
  }, [runs, query, filter])

  const remove = async (id: string) => {
    if (!confirm('Delete this history entry?')) return
    setDeleting(id)
    try {
      await deleteAgentRun(id)
      setRuns((prev) => prev.filter((r) => r.id !== id))
    } catch (err: any) {
      setError(err?.message ?? 'Could not delete.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<HistoryIcon className="w-5 h-5 text-white" />}
        gradient="from-slate-600 to-slate-800"
        title="History"
        subtitle="Every agent run you have made — reopen, re-download or clear"
        action={
          !loading && runs.length > 0 ? (
            <span className="text-sm text-slate-500">{runs.length} runs</span>
          ) : undefined
        }
      />

      {error && <ErrorNote message={error} />}

      {!error && (
        <Card>
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-400 focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your history…"
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none min-w-0"
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

          {agents.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {agents.map((a) => (
                <button
                  key={a}
                  onClick={() => setFilter(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ring-1 ${
                    filter === a
                      ? 'bg-slate-900 text-white ring-slate-900'
                      : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-400'
                  }`}
                >
                  {a === 'all' ? 'All' : (AGENT_LABELS[a] ?? a)}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {loading ? (
        <Card className="py-16 flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-400">Loading history…</p>
        </Card>
      ) : !error && filtered.length === 0 ? (
        <Card className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <HistoryIcon className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-display font-semibold text-slate-900">
            {runs.length === 0 ? 'No history yet' : 'Nothing matches that search'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {runs.length === 0
              ? 'Run any AI agent and it will show up here automatically.'
              : 'Try a different search or filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((run) => {
            const Icon = ICONS[run.agent] ?? Sparkles
            const tone = TONES[run.agent] ?? 'from-slate-500 to-slate-700'
            const open = openId === run.id
            const failed = run.status === 'failed'

            return (
              <div
                key={run.id}
                className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] overflow-hidden"
              >
                <div className="flex items-center gap-3 p-4">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center shadow-md shrink-0`}
                  >
                    <Icon className="w-[18px] h-[18px] text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-semibold text-slate-900 text-sm truncate">
                        {run.current_step || AGENT_LABELS[run.agent] || run.agent}
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
                      {AGENT_LABELS[run.agent] ?? run.agent} ·{' '}
                      {new Date(run.created_at).toLocaleString()}
                      {run.credits_used > 0 && ` · ${run.credits_used} credits`}
                    </p>
                  </div>

                  <button
                    onClick={() => setOpenId(open ? null : run.id)}
                    className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors shrink-0"
                  >
                    {open ? 'Hide' : 'View'}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {run.output && (
                    <button
                      onClick={() =>
                        downloadText(
                          `${(run.current_step || run.agent).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`,
                          JSON.stringify(run.output, null, 2),
                          'application/json'
                        )
                      }
                      title="Download this result"
                      className="h-8 w-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 inline-flex items-center justify-center transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => remove(run.id)}
                    disabled={deleting === run.id}
                    className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                  >
                    {deleting === run.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {open && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
                    {run.error && <ErrorNote message={run.error} />}

                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Input
                      </p>
                      <pre className="text-[11px] bg-white rounded-lg ring-1 ring-slate-200 p-3 overflow-auto max-h-40 text-slate-700">
                        {JSON.stringify(run.input, null, 2)}
                      </pre>
                    </div>

                    {run.output && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                          Result
                        </p>
                        <pre className="text-[11px] bg-white rounded-lg ring-1 ring-slate-200 p-3 overflow-auto max-h-80 text-slate-700">
                          {JSON.stringify(run.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
