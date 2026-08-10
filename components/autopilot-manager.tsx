'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Lightbulb,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  Upload,
  Webhook,
  XCircle,
  Zap,
} from 'lucide-react'
import { FREQUENCIES, describeNextRun, runsPerMonth, type Frequency } from '@/lib/autopilot/schedule'
import {
  CONTENT_KINDS,
  parsePlan,
  type ContentKind,
  type IdeaSource,
  type WhenPlanEnds,
} from '@/lib/autopilot/content'
import { network } from '@/lib/social/networks'

/**
 * Autopilot.
 *
 * A campaign is the whole product: it says what to make and how often, and
 * then it is meant to be forgotten about. So the list leads with the two
 * things a customer actually returns to check — is it still running, and what
 * did it make — rather than with the settings they filled in once.
 */

interface Campaign {
  id: string
  name: string
  niche: string
  audience: string
  art_style: string
  tone: string
  frequency: Frequency
  publish_hour: number
  timezone: string
  platforms: string[]
  webhook_url: string | null
  deliver_email: string | null
  status: string
  next_run_at: string | null
  last_run_at: string | null
  total_runs: number
  episodes_per_run: number
}

interface Run {
  id: string
  title: string | null
  status: string
  scheduled_for: string
  finished_at: string | null
  delivered_to: string[]
  error: string | null
  project_id: string | null
}

interface Idea {
  id: string
  title: string
  hook: string
  angle: string | null
  score: number
}

const PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'Blog', 'Pinterest']

const ART_STYLES = ['Pixar 3D', 'Watercolour', 'Flat cartoon', 'Storybook illustration', 'Anime']

export function AutopilotManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ campaign: Campaign; runs: Run[]; ideas: Idea[] } | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/autopilot')
    const payload = await response.json().catch(() => ({}))

    if (response.status === 403) setLocked(true)
    else if (!response.ok) setError(payload.error ?? 'Could not load your campaigns')
    else setCampaigns(payload.campaigns ?? [])

    setLoading(false)
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    const response = await fetch(`/api/autopilot?campaign=${id}`)
    const payload = await response.json().catch(() => ({}))

    if (response.ok) setDetail(payload)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (open) loadDetail(open)
    else setDetail(null)
  }, [open, loadDetail])

  const call = async (payload: Record<string, unknown>, label: string, done: string) => {
    setBusy(label)
    setError('')
    setNotice('')

    const response = await fetch('/api/autopilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) setError(result.error ?? 'Something went wrong')
    else {
      setNotice(done)
      await load()
      if (open) await loadDetail(open)
    }

    setBusy('')
    return { ok: response.ok, result }
  }

  if (locked) return <LockedNotice />

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (detail) {
    return (
      <CampaignDetail
        detail={detail}
        busy={busy}
        error={error}
        notice={notice}
        onBack={() => setOpen(null)}
        onCall={call}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 text-xs font-bold mb-3">
            <Bot className="w-3.5 h-3.5" />
            OTO 3 — AUTOPILOT
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Set it once. It keeps going.
          </h1>

          <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-2xl">
            A campaign finds its own story ideas, writes the episode, keeps the cast consistent and
            hands the finished thing over on your calendar — every day, without you logging in.
          </p>
        </div>

        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-semibold hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </button>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {campaigns.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              busy={busy === campaign.id}
              onOpen={() => setOpen(campaign.id)}
              onToggle={() =>
                call(
                  { action: campaign.status === 'active' ? 'pause' : 'resume', id: campaign.id },
                  campaign.id,
                  campaign.status === 'active' ? 'Paused.' : 'Running again.'
                )
              }
            />
          ))}
        </div>
      )}

      {creating && (
        <CreateDialog
          onClose={() => setCreating(false)}
          onCreate={async (payload) => {
            const { ok, result } = await call(
              { action: 'create', ...payload },
              'create',
              'Campaign created — the first episode is scheduled.'
            )

            if (ok) {
              setCreating(false)
              setOpen(result.campaign?.id ?? null)
            }
          }}
          busy={busy === 'create'}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  The day-by-day plan
// ---------------------------------------------------------------------------

const PLAN_EXAMPLE = `1. Meet Pip | A shy hedgehog moves to a new burrow
2. The lost mitten | Pip finds a mitten in the snow and looks for its owner
3. First day at school | Pip is nervous about the first day
Snow day — everyone builds a fort together`

/**
 * Writing out what each day should be.
 *
 * One text box rather than a row-per-day builder. A customer with a thirty-day
 * plan already has it written down somewhere — in a doc, a spreadsheet, a
 * notes app — and the fastest path from there to here is paste. A builder
 * would make them retype thirty rows to enter data they already had.
 *
 * Parsed as they type so the numbering and any bad lines are visible before
 * they commit, rather than surfacing as a failed run three weeks later.
 */
function PlanEditor({
  text,
  onChange,
  whenEnds,
  onWhenEndsChange,
}: {
  text: string
  onChange: (value: string) => void
  whenEnds: WhenPlanEnds
  onWhenEndsChange: (value: WhenPlanEnds) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => parsePlan(text), [text])

  const importFile = async (file: File) => {
    const content = await file.text()

    // Appended, not replaced: importing a second list should add to the first,
    // and silently discarding what was already typed would be worse than a
    // duplicate the customer can see and delete.
    onChange(text.trim() ? `${text.trim()}\n${content}` : content)
  }

  return (
    <div className="rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
            Your plan — one line per day
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            <code className="text-slate-500">1. Title | prompt</code>, or just paste the prompts and
            they will be numbered in order. Tabs and CSV from a spreadsheet work too.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 h-8 px-3 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5"
        >
          <Upload className="w-3 h-3" />
          Import
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.tsv,.md"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]

            if (file) importFile(file)
            event.target.value = ''
          }}
        />
      </div>

      <textarea
        value={text}
        onChange={(event) => onChange(event.target.value)}
        placeholder={PLAN_EXAMPLE}
        spellCheck={false}
        className="w-full h-40 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 p-3 text-sm text-slate-900 dark:text-white font-mono outline-none resize-y focus:ring-2 focus:ring-cyan-500 placeholder:text-slate-400"
      />

      {parsed.items.length > 0 && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
          {parsed.items.length} day{parsed.items.length === 1 ? '' : 's'} planned — first is “
          {parsed.items[0].title}”
        </p>
      )}

      {/* Shown per line rather than as a count: "3 problems" is not something
          anyone can act on, and the line number is the whole fix. */}
      {parsed.problems.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-2.5 space-y-1">
          {parsed.problems.slice(0, 5).map((problem) => (
            <p key={problem.line} className="text-[11px] text-amber-700 dark:text-amber-400">
              <span className="font-semibold">Line {problem.line}</span> — {problem.reason}:{' '}
              <span className="opacity-70">{problem.text.slice(0, 60)}</span>
            </p>
          ))}
          {parsed.problems.length > 5 && (
            <p className="text-[11px] text-amber-600">
              and {parsed.problems.length - 5} more
            </p>
          )}
        </div>
      )}

      <Field label="When the plan runs out">
        <select
          value={whenEnds}
          onChange={(event) => onWhenEndsChange(event.target.value as WhenPlanEnds)}
          className={inputClass}
        >
          <option value="stop">Stop the campaign</option>
          <option value="repeat">Start again from day 1</option>
          <option value="continue_with_ai">Let the AI carry on inventing</option>
        </select>
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  The list
// ---------------------------------------------------------------------------

function CampaignCard({
  campaign,
  busy,
  onOpen,
  onToggle,
}: {
  campaign: Campaign
  busy: boolean
  onOpen: () => void
  onToggle: () => void
}) {
  const active = campaign.status === 'active'

  return (
    <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="min-w-0 text-left flex-1">
          <h3 className="font-display font-bold text-slate-900 dark:text-white truncate hover:text-indigo-600">
            {campaign.name}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{campaign.niche}</p>
        </button>

        <span
          className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
            active
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}
        >
          {campaign.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Next</p>
          <p className="text-slate-700 dark:text-slate-300">
            {active
              ? describeNextRun(campaign.next_run_at ? new Date(campaign.next_run_at) : null)
              : 'Paused'}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Made</p>
          <p className="text-slate-700 dark:text-slate-300 tabular-nums">
            {campaign.total_runs} episode{campaign.total_runs === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onOpen}
          className="flex-1 px-3 py-2 rounded-xl text-sm font-semibold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Open
        </button>

        <button
          onClick={onToggle}
          disabled={busy}
          aria-label={active ? 'Pause campaign' : 'Resume campaign'}
          className="px-3 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
        >
          {active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  One campaign
// ---------------------------------------------------------------------------

function CampaignDetail({
  detail,
  busy,
  error,
  notice,
  onBack,
  onCall,
}: {
  detail: { campaign: Campaign; runs: Run[]; ideas: Idea[] }
  busy: string
  error: string
  notice: string
  onBack: () => void
  onCall: (payload: Record<string, unknown>, label: string, done: string) => Promise<unknown>
}) {
  const { campaign, runs, ideas } = detail
  const active = campaign.status === 'active'

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 mb-6 px-3 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        All campaigns
      </button>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {campaign.name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {campaign.niche} · {campaign.audience} · {campaign.art_style}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onCall({ action: 'run', id: campaign.id }, 'run', 'Episode produced.')}
              disabled={busy === 'run'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {busy === 'run' ? 'Working…' : 'Run now'}
            </button>

            <button
              onClick={() =>
                onCall(
                  { action: active ? 'pause' : 'resume', id: campaign.id },
                  'toggle',
                  active ? 'Paused.' : 'Running again.'
                )
              }
              disabled={busy === 'toggle'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {active ? 'Pause' : 'Resume'}
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Delete "${campaign.name}"? Its episodes stay in My Comics.`)) {
                  onCall({ action: 'delete', id: campaign.id }, 'delete', 'Campaign deleted.').then(
                    onBack
                  )
                }
              }}
              aria-label="Delete campaign"
              className="px-3 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat
            icon={<Clock className="w-4 h-4" />}
            label="Next episode"
            value={
              active
                ? describeNextRun(campaign.next_run_at ? new Date(campaign.next_run_at) : null)
                : 'Paused'
            }
          />
          <Stat
            icon={<Calendar className="w-4 h-4" />}
            label="Schedule"
            value={`${FREQUENCIES.find((f) => f.value === campaign.frequency)?.label ?? campaign.frequency}, ${String(campaign.publish_hour).padStart(2, '0')}:00`}
          />
          <Stat
            icon={<Rocket className="w-4 h-4" />}
            label="Made so far"
            value={`${campaign.total_runs}`}
          />
          <Stat
            icon={<Zap className="w-4 h-4" />}
            label="Per month"
            value={`~${runsPerMonth(campaign.frequency)}`}
          />
        </div>

        {(campaign.webhook_url || campaign.deliver_email || campaign.platforms.length > 0) && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Delivered to:</span>

            {campaign.webhook_url && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <Webhook className="w-3 h-3" />
                Webhook
              </span>
            )}

            {campaign.deliver_email && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {campaign.deliver_email}
              </span>
            )}

            {campaign.platforms.map((platform) => (
              <span
                key={platform}
                className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
              >
                {platform}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ---- ideas ---- */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Story queue
            </h2>

            <button
              onClick={() => onCall({ action: 'ideas', id: campaign.id }, 'ideas', 'New ideas added.')}
              disabled={busy === 'ideas'}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy === 'ideas' ? 'animate-spin' : ''}`} />
              Find more
            </button>
          </div>

          {ideas.length === 0 ? (
            <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              The queue is empty. Autopilot fills it before the next run — or press
              &ldquo;Find more&rdquo; to see what it comes up with.
            </div>
          ) : (
            <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {ideas.map((idea) => (
                <div key={idea.id} className="p-4 flex items-start gap-3">
                  <span
                    className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center text-xs font-bold tabular-nums ${
                      idea.score >= 75
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : idea.score >= 50
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {idea.score}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {idea.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{idea.hook}</p>
                  </div>

                  <button
                    onClick={() =>
                      onCall(
                        { action: 'dismiss', id: campaign.id, ideaId: idea.id },
                        `dismiss-${idea.id}`,
                        'Idea dropped.'
                      )
                    }
                    aria-label={`Dismiss ${idea.title}`}
                    className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- runs ---- */}
        <section>
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Episodes
          </h2>

          {runs.length === 0 ? (
            <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Nothing yet. The first episode arrives{' '}
              {describeNextRun(campaign.next_run_at ? new Date(campaign.next_run_at) : null)}, or
              press Run now.
            </div>
          ) : (
            <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {runs.map((run) => (
                <div key={run.id} className="p-4 flex items-start gap-3">
                  <RunIcon status={run.status} />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {run.title ?? 'Untitled episode'}
                    </p>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(run.finished_at ?? run.scheduled_for).toLocaleString()}
                      {run.delivered_to.length > 0 && ` · sent via ${run.delivered_to.join(', ')}`}
                    </p>

                    {run.error && <p className="text-xs text-red-500 mt-0.5">{run.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  New campaign
// ---------------------------------------------------------------------------

function CreateDialog({
  onClose,
  onCreate,
  busy,
}: {
  onClose: () => void
  onCreate: (payload: Record<string, unknown>) => void
  busy: boolean
}) {
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [contentKindValue, setContentKind] = useState<ContentKind>('comic')
  const [ideaSourceValue, setIdeaSource] = useState<IdeaSource>('ai')
  const [whenEnds, setWhenEnds] = useState<WhenPlanEnds>('stop')
  const [planText, setPlanText] = useState('')
  const [audience, setAudience] = useState('Children aged 4-8')
  const [artStyle, setArtStyle] = useState(ART_STYLES[0])
  const [tone, setTone] = useState('Warm and playful')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [publishHour, setPublishHour] = useState(9)
  const [platforms, setPlatforms] = useState<string[]>([])
  const [webhookUrl, setWebhookUrl] = useState('')
  const [deliverEmail, setDeliverEmail] = useState('')
  const [connections, setConnections] = useState<
    { id: string; platform: string; accountName: string }[]
  >([])
  const [connectionIds, setConnectionIds] = useState<string[]>([])

  // What this account can post to. Loaded here rather than passed in, so the
  // list is current even if an account was connected in another tab.
  useEffect(() => {
    fetch('/api/social', { method: 'PUT' })
      .then((response) => response.json())
      .then((payload) => setConnections(payload.connections ?? []))
      .catch(() => setConnections([]))
  }, [])

  // The browser knows where the customer is; asking would be a worse question.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  const toggle = (platform: string) =>
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((entry) => entry !== platform)
        : [...current, platform]
    )

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl my-4 sm:my-8 bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xl">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            New campaign
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Describe the series once. Autopilot handles the rest.
          </p>
        </div>

        <div className="p-5 space-y-5">
          {/* What it makes. Asked first because it changes what everything
              below means — and because a campaign that quietly produced the
              wrong kind of thing was the single biggest gap here. */}
          <Field label="What should it post?">
            <div className="grid sm:grid-cols-2 gap-2">
              {CONTENT_KINDS.map((entry) => {
                const active = entry.kind === contentKindValue

                return (
                  <button
                    key={entry.kind}
                    type="button"
                    onClick={() => setContentKind(entry.kind)}
                    className={`p-3 rounded-xl text-left ring-1 transition-colors ${
                      active
                        ? 'ring-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                        : 'ring-slate-200 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${active ? 'text-cyan-900 dark:text-cyan-200' : 'text-slate-900 dark:text-white'}`}
                    >
                      {entry.label}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {entry.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Where each day's idea comes from. */}
          <Field label="Where do the ideas come from?">
            <div className="grid sm:grid-cols-2 gap-2">
              {(
                [
                  {
                    value: 'ai' as const,
                    label: 'Let the AI decide',
                    hint: 'It invents a fresh idea for every run, keeps the cast consistent and never repeats itself. Set it up once and leave it.',
                  },
                  {
                    value: 'planned' as const,
                    label: 'I will plan each day',
                    hint: 'Paste or import your own list. Day 1 runs first, day 2 next, and so on — exactly what you wrote.',
                  },
                ]
              ).map((option) => {
                const active = option.value === ideaSourceValue

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setIdeaSource(option.value)}
                    className={`p-3 rounded-xl text-left ring-1 transition-colors ${
                      active
                        ? 'ring-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                        : 'ring-slate-200 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${active ? 'text-cyan-900 dark:text-cyan-200' : 'text-slate-900 dark:text-white'}`}
                    >
                      {option.label}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {option.hint}
                    </p>
                  </button>
                )
              })}
            </div>
          </Field>

          {ideaSourceValue === 'planned' && (
            <PlanEditor
              text={planText}
              onChange={setPlanText}
              whenEnds={whenEnds}
              onWhenEndsChange={setWhenEnds}
            />
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Campaign name" hint="What you will recognise it by">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Bedtime Animal Tales"
                className={inputClass}
              />
            </Field>

            <Field label="Niche" hint="What every episode is about">
              <input
                value={niche}
                onChange={(event) => setNiche(event.target.value)}
                placeholder="Gentle animal stories for bedtime"
                className={inputClass}
              />
            </Field>

            <Field label="Audience">
              <input
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Tone">
              <input
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Art style" hint="Kept identical across every episode">
              <select
                value={artStyle}
                onChange={(event) => setArtStyle(event.target.value)}
                className={inputClass}
              >
                {ART_STYLES.map((style) => (
                  <option key={style}>{style}</option>
                ))}
              </select>
            </Field>

            <Field label="Publish at" hint={`Your time — ${timezone}`}>
              <select
                value={publishHour}
                onChange={(event) => setPublishHour(Number(event.target.value))}
                className={inputClass}
              >
                {Array.from({ length: 24 }).map((_, hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="How often">
            <div className="grid sm:grid-cols-2 gap-2">
              {FREQUENCIES.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-xl ring-1 cursor-pointer transition-colors ${
                    frequency === option.value
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 ring-indigo-300 dark:ring-indigo-500/30'
                      : 'ring-slate-200 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="frequency"
                    checked={frequency === option.value}
                    onChange={() => setFrequency(option.value)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {option.label}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              About <strong>{runsPerMonth(frequency)}</strong> episodes a month.
            </p>
          </Field>

          <Field
            label="Post automatically to"
            hint={
              connections.length > 0
                ? 'Each finished episode is published to these accounts.'
                : 'No accounts connected yet — connect one on the Connections screen.'
            }
          >
            {connections.length === 0 ? (
              <Link
                href="/connections"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600"
              >
                Connect an account
              </Link>
            ) : (
              <div className="space-y-2">
                {connections.map((connection) => (
                  <label
                    key={connection.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={connectionIds.includes(connection.id)}
                      onChange={() =>
                        setConnectionIds((current) =>
                          current.includes(connection.id)
                            ? current.filter((id) => id !== connection.id)
                            : [...current, connection.id]
                        )
                      }
                      className="w-4 h-4 accent-indigo-600"
                    />

                    <span
                      className="w-7 h-7 rounded-lg grid place-items-center text-white text-[11px] font-bold"
                      style={{ backgroundColor: network(connection.platform)?.colour ?? '#64748b' }}
                    >
                      {(network(connection.platform)?.label ?? connection.platform).charAt(0)}
                    </span>

                    <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">
                      {connection.accountName}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </Field>

          <Field label="Also tag these platforms" hint="Recorded on every episode so your own tools know where it was meant to go">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => toggle(platform)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    platforms.includes(platform)
                      ? 'bg-indigo-600 text-white'
                      : 'ring-1 ring-slate-200 dark:ring-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Webhook URL"
              hint="Every finished episode is POSTed here — point it at Zapier, Make or your own site."
            >
              <input
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder="https://hooks.zapier.com/…"
                className={inputClass}
              />
            </Field>

            <Field label="Email it to" hint="Leave blank if you only want the webhook.">
              <input
                value={deliverEmail}
                onChange={(event) => setDeliverEmail(event.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>

          <button
            onClick={() =>
              onCreate({
                name,
                niche,
                contentKind: contentKindValue,
                ideaSource: ideaSourceValue,
                whenPlanEnds: whenEnds,
                // Sent with the campaign so the plan and the campaign are
                // created together — a planned campaign that exists for a
                // moment with no plan would be picked up by the scheduler and
                // immediately stop itself.
                planText: ideaSourceValue === 'planned' ? planText : '',
                audience,
                artStyle,
                tone,
                frequency,
                publishHour,
                timezone,
                platforms,
                connectionIds,
                webhookUrl,
                deliverEmail,
              })
            }
            disabled={
              busy ||
              !name.trim() ||
              !niche.trim() ||
              // A planned campaign with an empty plan has nothing to run.
              (ideaSourceValue === 'planned' && parsePlan(planText).items.length === 0)
            }
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Start the campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Small pieces
// ---------------------------------------------------------------------------

const inputClass =
  'w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}

function RunIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
  if (status === 'failed') return <XCircle className="w-5 h-5 text-red-500 shrink-0" />
  if (status === 'running')
    return <RefreshCw className="w-5 h-5 text-indigo-500 shrink-0 animate-spin" />

  return <Clock className="w-5 h-5 text-slate-400 shrink-0" />
}

function Banner({ tone, children }: { tone: 'error' | 'ok'; children: React.ReactNode }) {
  const styles =
    tone === 'error'
      ? 'bg-red-50 dark:bg-red-500/10 ring-red-100 dark:ring-red-500/20 text-red-600'
      : 'bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-100 dark:ring-emerald-500/20 text-emerald-700 dark:text-emerald-400'

  return <div className={`mb-4 p-3 rounded-xl ring-1 text-sm ${styles}`}>{children}</div>
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-3xl ring-1 ring-slate-200 dark:ring-slate-800 p-10 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 grid place-items-center mx-auto mb-5">
        <Bot className="w-7 h-7 text-white" />
      </div>

      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
        No campaigns yet
      </h2>

      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        Tell Autopilot what your series is about and how often you want an episode. It finds the
        ideas, writes them, keeps your cast consistent and delivers each one on schedule.
      </p>

      <button
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-semibold hover:opacity-90"
      >
        <Plus className="w-4 h-4" />
        Create your first campaign
      </button>
    </div>
  )
}

function LockedNotice() {
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 grid place-items-center mx-auto mb-5">
        <Lock className="w-7 h-7 text-white" />
      </div>

      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
        Autopilot is part of OTO 3
      </h1>

      <p className="mt-3 text-slate-500 dark:text-slate-400">
        Hands-free comic production: AI finds the story ideas, writes the episodes, keeps your cast
        consistent and publishes on your calendar — every day, without you logging in.
      </p>

      <Link
        href="/credits"
        className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-semibold hover:opacity-90"
      >
        <Bot className="w-4 h-4" />
        See the upgrade
      </Link>
    </div>
  )
}
