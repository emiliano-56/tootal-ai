'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Layers,
  Plus,
  Play,
  Pause,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  Palette,
  Star,
} from 'lucide-react'
import { AgentHeader, Card, Field, inputClass } from '@/components/agent-ui'
import { parseIdeas, describeEstimate, progressOf, type BulkItem } from '@/lib/bulk/queue'
import { FORMATS } from '@/lib/comic/formats'

/**
 * Generating a list of ideas unattended, and the style presets that go with it.
 *
 * These share a screen because they are used together: a bulk run is where a
 * house style matters most — twenty books generated with whatever was in the
 * boxes at the time is twenty books that do not look like a series.
 *
 * The work happens on a schedule, not here. The page queues a job and then
 * shows it moving; closing the tab does not stop it, which is the point.
 */

interface Job {
  id: string
  name: string
  kind: string
  status: string
  total: number
  done: number
  failed: number
  error: string | null
  created_at: string
}

interface Preset {
  id: string
  name: string
  art_style: string
  audience: string
  tone: string
  is_default: boolean
  times_used: number
}

export function BulkStudio() {
  const [tab, setTab] = useState<'jobs' | 'presets'>('jobs')

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<Layers className="w-5 h-5 text-white" />}
        gradient="from-sky-500 to-blue-600"
        title="Batch & Styles"
        subtitle="Generate a whole list unattended, and keep one house style across all of it"
      />

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { key: 'jobs', label: 'Batch runs', icon: Layers },
            { key: 'presets', label: 'Style presets', icon: Palette },
          ] as const
        ).map((entry) => {
          const Icon = entry.icon
          const active = entry.key === tab

          return (
            <button
              key={entry.key}
              onClick={() => setTab(entry.key)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                active
                  ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                  : 'ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {entry.label}
            </button>
          )
        })}
      </div>

      {tab === 'jobs' ? <JobsTab /> : <PresetsTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Batch runs
// ---------------------------------------------------------------------------

function JobsTab() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const [name, setName] = useState('')
  const [kind, setKind] = useState('comic')
  const [ideasText, setIdeasText] = useState('')
  const [presetId, setPresetId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [jobsRes, presetsRes] = await Promise.all([
        fetch('/api/bulk', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/presets', { cache: 'no-store' }).then((r) => r.json()),
      ])

      setJobs(jobsRes.jobs ?? [])
      setPresets(presetsRes.presets ?? [])
    } catch {
      setError('Could not load your batches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    // A running job moves without anyone touching the page, so the page has
    // to move too or it looks stuck.
    const timer = setInterval(load, 15_000)

    return () => clearInterval(timer)
  }, [load])

  const parsed = useMemo(() => parseIdeas(ideasText), [ideasText])

  const create = async () => {
    setBusy(true)
    setError('')

    const preset = presets.find((entry) => entry.id === presetId)

    const response = await fetch('/api/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        name,
        kind,
        ideas: ideasText,
        presetId: presetId || null,
        settings: preset
          ? { artStyle: preset.art_style, audience: preset.audience, tone: preset.tone }
          : {},
      }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) setError(payload?.error ?? 'Could not queue that batch')
    else {
      setCreating(false)
      setIdeasText('')
      setName('')
      await load()
    }

    setBusy(false)
  }

  const act = async (id: string, action: string) => {
    await fetch('/api/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    })
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${jobs.length} batch${jobs.length === 1 ? '' : 'es'}`}
        </p>

        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New batch
        </button>
      </div>

      {error && (
        <p className="p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-sm text-red-600">{error}</p>
      )}

      {!loading && jobs.length === 0 && (
        <div className="rounded-2xl ring-1 ring-slate-200 bg-white py-12 text-center">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-900">No batches yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Paste a list of ideas and they will be worked through one at a time. You can close the
            tab — it keeps going.
          </p>
        </div>
      )}

      {jobs.map((job) => {
        const settled = job.done + job.failed
        const percent = job.total === 0 ? 0 : Math.round((settled / job.total) * 100)
        const running = job.status === 'running' || job.status === 'queued'

        return (
          <div key={job.id} className="rounded-2xl ring-1 ring-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{job.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {job.kind} · {job.done} of {job.total} done
                  {job.failed > 0 && ` · ${job.failed} failed`}
                  {running && ` · ${describeEstimate(job.total - settled)} left`}
                </p>
                {job.error && <p className="text-[11px] text-amber-700 mt-1">{job.error}</p>}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    job.status === 'done'
                      ? 'bg-emerald-100 text-emerald-700'
                      : job.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : job.status === 'paused' || job.status === 'cancelled'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {job.status}
                </span>

                {running && (
                  <button
                    onClick={() => act(job.id, 'pause')}
                    title="Pause"
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                )}

                {job.status === 'paused' && (
                  <button
                    onClick={() => act(job.id, 'resume')}
                    title="Resume"
                    className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete "${job.name}"?`)) return

                    await fetch(`/api/bulk?id=${job.id}`, { method: 'DELETE' })
                    await load()
                  }}
                  title="Delete"
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      })}

      {creating && (
        <div className="fixed inset-0 z-[2000] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg my-4 bg-white rounded-2xl ring-1 ring-slate-200 shadow-2xl">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">New batch</h2>
                <p className="text-xs text-slate-500">
                  One idea per line. Numbering is stripped, so a pasted list works as-is.
                </p>
              </div>
              <button
                onClick={() => setCreating(false)}
                className="w-8 h-8 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Bedtime series, books 1-20"
                  className={inputClass}
                />
              </Field>

              <Field label="What to make">
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  className={inputClass}
                >
                  {FORMATS.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.label}
                    </option>
                  ))}
                  <option value="coloring">Colouring book</option>
                </select>
              </Field>

              {presets.length > 0 && (
                <Field
                  label="Style preset"
                  hint="Keeps every book in the batch looking like the same series."
                >
                  <select
                    value={presetId}
                    onChange={(event) => setPresetId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">No preset</option>
                    {presets.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                        {entry.is_default ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Ideas">
                <textarea
                  value={ideasText}
                  onChange={(event) => setIdeasText(event.target.value)}
                  placeholder={'A snail goes north\nA frog loses a boot\nThe moon takes a night off'}
                  className={`${inputClass} h-40 resize-y py-2.5 font-mono text-[13px]`}
                />
              </Field>

              {parsed.ideas.length > 0 && (
                <p className="text-[11px] text-emerald-700 font-semibold">
                  {parsed.ideas.length} idea{parsed.ideas.length === 1 ? '' : 's'} ·{' '}
                  {describeEstimate(parsed.ideas.length)} to finish
                </p>
              )}

              {parsed.problems.length > 0 && (
                <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-2.5 space-y-1">
                  {parsed.problems.slice(0, 5).map((problem) => (
                    <p key={problem.line} className="text-[11px] text-amber-800">
                      <span className="font-semibold">Line {problem.line}</span> — {problem.reason}
                    </p>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-slate-400 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                Each one spends a generation from your monthly allowance. The batch pauses itself if
                you run out.
              </p>
            </div>

            <div className="p-5 pt-0 flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="h-10 px-4 rounded-xl ring-1 ring-slate-200 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={busy || parsed.ideas.length === 0}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? 'Queueing…' : `Queue ${parsed.ideas.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Style presets
// ---------------------------------------------------------------------------

function PresetsTab() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Preset | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const payload = await fetch('/api/presets', { cache: 'no-store' }).then((r) => r.json())

      setPresets(payload.presets ?? [])
    } catch {
      setError('Could not load your presets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)

      setError(body?.error ?? 'Could not save that')
      return
    }

    setCreating(false)
    setEditing(null)
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${presets.length} preset${presets.length === 1 ? '' : 's'}`}
        </p>

        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New preset
        </button>
      </div>

      {error && (
        <p className="p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-sm text-red-600">{error}</p>
      )}

      {!loading && presets.length === 0 && (
        <div className="rounded-2xl ring-1 ring-slate-200 bg-white py-12 text-center">
          <Palette className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-900">No presets yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Save the art style, audience and tone you keep retyping. The default is filled in for
            you on every new comic.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {presets.map((preset) => (
          <div key={preset.id} className="rounded-2xl ring-1 ring-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {preset.name}
                  {preset.is_default && (
                    <span className="ml-2 text-[10px] font-bold uppercase text-amber-600">
                      Default
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{preset.art_style}</p>
                {preset.times_used > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">used {preset.times_used}×</p>
                )}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                {!preset.is_default && (
                  <button
                    onClick={() => save({ action: 'default', id: preset.id })}
                    title="Make default"
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setEditing(preset)}
                  title="Edit"
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete "${preset.name}"?`)) return

                    await fetch(`/api/presets?id=${preset.id}`, { method: 'DELETE' })
                    await load()
                  }}
                  title="Delete"
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <PresetDialog
          existing={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={(payload) =>
            save(editing ? { action: 'update', id: editing.id, ...payload } : { action: 'create', ...payload })
          }
        />
      )}
    </div>
  )
}

function PresetDialog({
  existing,
  onClose,
  onSave,
}: {
  existing: Preset | null
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [artStyle, setArtStyle] = useState(existing?.art_style ?? '')
  const [audience, setAudience] = useState(existing?.audience ?? '')
  const [tone, setTone] = useState(existing?.tone ?? '')

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl ring-1 ring-slate-200 shadow-2xl p-5 space-y-4">
        <h2 className="font-display text-base font-bold text-slate-900">
          {existing ? `Edit ${existing.name}` : 'New style preset'}
        </h2>

        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Art style" hint="Goes into every image prompt, word for word.">
          <textarea
            value={artStyle}
            onChange={(e) => setArtStyle(e.target.value)}
            placeholder="Modern comic book, bold ink, vibrant colour"
            className={`${inputClass} h-20 resize-none py-2.5`}
          />
        </Field>

        <Field label="Audience">
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Children aged 4-8"
            className={inputClass}
          />
        </Field>

        <Field label="Tone">
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Warm and playful"
            className={inputClass}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl ring-1 ring-slate-200 text-sm font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ name, artStyle, audience, tone })}
            disabled={!name.trim()}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
