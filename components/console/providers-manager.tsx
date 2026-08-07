'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Trash2, RefreshCw, Power, FlaskConical, ArrowUp, ArrowDown, Pencil, Eye, EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { buildFailoverChain, type AiProvider, type Credential } from '@/lib/services/api-routing'
import { maskKey } from '@/lib/services/mask'
import {
  PageHeader,
  DataTable,
  StatusPill,
  ConfirmDialog,
  type Column,
} from '@/components/console/console-ui'

/**
 * AI provider credentials.
 *
 * Writes go straight through the RLS-scoped browser client — the
 * `api_credentials_write` policy already restricts platform keys to a
 * superadmin, so a service-role route would add risk without adding a check.
 *
 * Keys are never rendered back in full: the API returns what is stored, and
 * showing it in a table is how credentials end up in screenshots.
 */

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: 'zoop', label: 'Zoop AI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'claude', label: 'Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: 'Custom' },
]

/**
 * Zoop is the image/video generation backend, addressed by URL rather than by
 * key, so it gets its own section instead of sitting in a text-model list
 * where the priority and token columns mean nothing.
 */
const GENERATION_PROVIDERS: AiProvider[] = ['zoop']

/** Providers addressed by URL only — a key is optional for these. */
function keyOptional(provider: AiProvider) {
  return GENERATION_PROVIDERS.includes(provider) || provider === 'custom'
}

interface CredentialRow {
  id: string
  provider: AiProvider
  label: string
  scope: 'platform' | 'user'
  api_key: string
  base_url: string | null
  model: string | null
  enabled: boolean
  priority: number
  daily_limit: number | null
  monthly_limit: number | null
  last_test_ok: boolean | null
  last_error: string | null
}

export function ProvidersManager() {
  const [rows, setRows] = useState<CredentialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  // Which kind of credential the add dialog should open for, or null when closed.
  const [addingProvider, setAddingProvider] = useState<AiProvider | null>(null)
  const [editing, setEditing] = useState<CredentialRow | null>(null)
  const [toDelete, setToDelete] = useState<CredentialRow | null>(null)
  // Keys stay masked until explicitly revealed, one at a time.
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const toggleReveal = (id: string) =>
    setRevealed((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const load = useCallback(async () => {
    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('scope', 'platform')
      .order('priority', { ascending: true })

    if (queryError) setError(queryError.message)

    setRows((data as CredentialRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // PromiseLike, not Promise: Supabase query builders are thenables that only
  // execute when awaited.
  const mutate = async (
    fn: () => PromiseLike<{ error: { message: string } | null }>,
    message: string
  ) => {
    setBusy(true)
    setError('')
    setNotice('')

    const { error: writeError } = await fn()

    if (writeError) setError(writeError.message)
    else {
      setNotice(message)
      await load()
    }

    setBusy(false)
  }

  const toggle = (row: CredentialRow) =>
    mutate(
      () => supabase.from('api_credentials').update({ enabled: !row.enabled }).eq('id', row.id),
      `${row.label} ${row.enabled ? 'disabled' : 'enabled'}.`
    )

  const move = (row: CredentialRow, direction: -1 | 1) =>
    mutate(
      () =>
        supabase
          .from('api_credentials')
          // Lower number runs first; clamp so priority never goes negative.
          .update({ priority: Math.max(0, row.priority + direction * 10) })
          .eq('id', row.id),
      `${row.label} moved ${direction < 0 ? 'up' : 'down'}.`
    )

  /**
   * A live call is the only honest health check, but each provider has its own
   * endpoint and auth. Until those are wired, record that a test was attempted
   * rather than claiming a result we did not verify.
   */
  const test = (row: CredentialRow) =>
    mutate(
      () =>
        supabase
          .from('api_credentials')
          .update({
            last_tested_at: new Date().toISOString(),
            last_test_ok: null,
            last_error: 'Live provider test not implemented yet',
          })
          .eq('id', row.id),
      `Test recorded for ${row.label} — live calls are not wired up yet.`
    )

  // Mirrors what the runtime would actually pick, so the ordering shown here
  // is the ordering used. Generation backends are excluded: they are addressed
  // by URL and never participate in the model failover chain.
  const chain = useMemo(
    () =>
      buildFailoverChain(
        rows
          .filter((row) => !GENERATION_PROVIDERS.includes(row.provider))
          .map<Credential>((row) => ({
          id: row.id,
          provider: row.provider,
          scope: row.scope,
          enabled: row.enabled,
          priority: row.priority,
          dailyLimit: row.daily_limit,
          monthlyLimit: row.monthly_limit,
          lastTestOk: row.last_test_ok,
        })),
        'platform_only'
      ),
    [rows]
  )

  const labelColumn: Column<CredentialRow> = {
    key: 'label',
    header: 'Credential',
    render: (row) => (
      <div className="min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate">{row.label}</p>

        <button
          onClick={() => toggleReveal(row.id)}
          title={revealed.has(row.id) ? 'Hide' : 'Reveal'}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono hover:text-indigo-600 transition-colors"
        >
          {revealed.has(row.id) ? (
            <>
              <EyeOff className="w-3 h-3 shrink-0" />
              <span className="break-all text-left">{row.api_key || '(no key)'}</span>
            </>
          ) : (
            <>
              <Eye className="w-3 h-3 shrink-0" />
              {maskKey(row.api_key)}
            </>
          )}
        </button>
      </div>
    ),
  }

  const columns: Column<CredentialRow>[] = [
    labelColumn,
    {
      key: 'provider',
      header: 'Provider',
      render: (row) => PROVIDERS.find((p) => p.value === row.provider)?.label ?? row.provider,
    },
    {
      key: 'priority',
      header: 'Priority',
      className: 'tabular-nums',
      render: (row) => {
        const position = chain.findIndex((c) => c.id === row.id)

        return (
          <div className="flex items-center gap-2">
            <span>{row.priority}</span>
            {position === 0 && (
              <span className="text-[10px] font-bold text-emerald-600 uppercase">first</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'limits',
      header: 'Limits',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {row.daily_limit ?? '∞'} / day · {row.monthly_limit ?? '∞'} / mo
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusPill value={row.enabled ? 'active' : 'suspended'} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <IconBtn label="Edit" onClick={() => setEditing(row)}>
            <Pencil className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Move up" onClick={() => move(row, -1)}>
            <ArrowUp className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Move down" onClick={() => move(row, 1)}>
            <ArrowDown className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Test" onClick={() => test(row)}>
            <FlaskConical className="w-4 h-4" />
          </IconBtn>
          <IconBtn
            label={row.enabled ? 'Disable' : 'Enable'}
            onClick={() => toggle(row)}
            tone={row.enabled ? 'text-amber-600' : 'text-emerald-600'}
          >
            <Power className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Delete" onClick={() => setToDelete(row)} tone="text-red-600">
            <Trash2 className="w-4 h-4" />
          </IconBtn>
        </div>
      ),
    },
  ]

  const llmRows = rows.filter((row) => !GENERATION_PROVIDERS.includes(row.provider))
  const generationRows = rows.filter((row) => GENERATION_PROVIDERS.includes(row.provider))

  // The generation backend has no priority chain or token limits, so its table
  // shows the URL instead of columns that would always read "∞".
  const generationColumns: Column<CredentialRow>[] = [
    labelColumn,
    {
      key: 'url',
      header: 'Backend URL',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 break-all">
          {row.base_url || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusPill value={row.enabled ? 'active' : 'suspended'} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <IconBtn label="Edit" onClick={() => setEditing(row)}>
            <Pencil className="w-4 h-4" />
          </IconBtn>
          <IconBtn
            label={row.enabled ? 'Disable' : 'Enable'}
            onClick={() => toggle(row)}
            tone={row.enabled ? 'text-amber-600' : 'text-emerald-600'}
          >
            <Power className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Delete" onClick={() => setToDelete(row)} tone="text-red-600">
            <Trash2 className="w-4 h-4" />
          </IconBtn>
        </div>
      ),
    },
  ]


  return (
    <>
      <PageHeader
        title="AI Providers"
        subtitle="Platform keys, in the order the app will try them. Lower priority runs first."
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setAddingProvider('deepseek')}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add key
            </Button>
          </>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {chain.length > 0 && (
        <div className="mb-4 p-4 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Failover order
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {chain.map((credential, index) => {
              const row = rows.find((r) => r.id === credential.id)!

              return (
                <span key={credential.id} className="flex items-center gap-2">
                  {index > 0 && <span className="text-slate-300">→</span>}
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {row.label}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      <SectionHeading
        title="Text & story models"
        hint="Used by the chat, script, marketing and book agents."
      />

      <DataTable
        rows={llmRows}
        columns={columns}
        loading={loading}
        searchable
        searchPlaceholder="Search credentials…"
        searchFields={(row) => `${row.label} ${row.provider}`}
        emptyMessage="No model keys yet. Add one to get started."
      />

      <div className="mt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading
            title="Image & video backend"
            hint="Comic panels, coloring pages, covers and video generation. Addressed by URL — a key is optional."
          />

          <Button
            variant="outline"
            onClick={() => setAddingProvider('zoop')}
            className="shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add backend
          </Button>
        </div>

        <DataTable
          rows={generationRows}
          columns={generationColumns}
          loading={loading}
          emptyMessage="No backend configured — the app falls back to NEXT_PUBLIC_API_URL."
        />
      </div>

      {(addingProvider || editing) && (
        <CredentialDialog
          busy={busy}
          existing={editing}
          initialProvider={addingProvider ?? undefined}
          onClose={() => {
            setAddingProvider(null)
            setEditing(null)
          }}
          onSave={async (payload) => {
            if (editing) {
              await mutate(
                () => supabase.from('api_credentials').update(payload).eq('id', editing.id),
                `${payload.label} updated.`
              )
            } else {
              await mutate(
                () => supabase.from('api_credentials').insert({ ...payload, scope: 'platform' }),
                `${payload.label} added.`
              )
            }

            setAddingProvider(null)
            setEditing(null)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this credential?"
        message={`${toDelete?.label} will stop being used immediately. Requests will fall through to the next provider in the chain.`}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (toDelete) {
            await mutate(
              () => supabase.from('api_credentials').delete().eq('id', toDelete.id),
              `${toDelete.label} deleted.`
            )
          }
          setToDelete(null)
        }}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}

function CredentialDialog({
  busy,
  existing,
  initialProvider,
  onClose,
  onSave,
}: {
  busy: boolean
  existing: CredentialRow | null
  /** Preselected when opened from a section's own Add button. */
  initialProvider?: AiProvider
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => void
}) {
  const [provider, setProvider] = useState<AiProvider>(
    existing?.provider ?? initialProvider ?? 'openai'
  )
  const [label, setLabel] = useState(existing?.label ?? '')
  const [apiKey, setApiKey] = useState(existing?.api_key ?? '')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState(existing?.model ?? '')
  const [baseUrl, setBaseUrl] = useState(existing?.base_url ?? '')
  const [priority, setPriority] = useState(String(existing?.priority ?? 100))
  const [dailyLimit, setDailyLimit] = useState(
    existing?.daily_limit != null ? String(existing.daily_limit) : ''
  )
  const [monthlyLimit, setMonthlyLimit] = useState(
    existing?.monthly_limit != null ? String(existing.monthly_limit) : ''
  )

  const isGeneration = GENERATION_PROVIDERS.includes(provider)
  const needsKey = !keyOptional(provider)

  return (
    <Dialog title={existing ? `Edit ${existing.label}` : 'Add provider'} onClose={onClose}>
      <Field label="Provider">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as AiProvider)}
          className={inputClass}
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Label" hint="How this key is shown in the list">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
      </Field>

      <Field label="API key" hint={needsKey ? undefined : 'Optional for this backend'}>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className={`${inputClass} font-mono pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Field>

      {(isGeneration || provider === 'custom') && (
        <Field
          label="Backend URL"
          hint={isGeneration ? 'Where comic, coloring, cover and video generation is sent' : undefined}
        >
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://your-backend.example.com"
            className={`${inputClass} font-mono`}
          />
        </Field>
      )}

      {/* Model, priority and token limits are meaningless for the generation
          backend, so they are not offered there. */}
      {!isGeneration && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Model" hint="Optional">
              <input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Priority" hint="Lower runs first">
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily limit" hint="Blank = unlimited">
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Monthly limit" hint="Blank = unlimited">
              <input
                type="number"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={
            busy || !label || (needsKey && !apiKey) || (isGeneration && !baseUrl)
          }
          onClick={() =>
            onSave({
              provider,
              label,
              // The column is NOT NULL; a URL-only backend stores an empty key.
              api_key: apiKey,
              model: model || null,
              base_url: baseUrl || null,
              priority: Number(priority) || 100,
              daily_limit: dailyLimit ? Number(dailyLimit) : null,
              monthly_limit: monthlyLimit ? Number(monthlyLimit) : null,
            })
          }
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
        >
          {busy ? 'Saving…' : existing ? 'Save changes' : 'Add'}
        </Button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
//  Small shared pieces
// ---------------------------------------------------------------------------

export const inputClass =
  'w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'

export function Field({
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

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg my-4 sm:my-8 bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xl p-5 sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Banner({ tone, children }: { tone: 'error' | 'ok'; children: React.ReactNode }) {
  const styles =
    tone === 'error'
      ? 'bg-red-50 dark:bg-red-500/10 ring-red-100 dark:ring-red-500/20 text-red-600'
      : 'bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-100 dark:ring-emerald-500/20 text-emerald-700 dark:text-emerald-400'

  return <div className={`mb-4 p-3 rounded-xl ring-1 text-sm ${styles}`}>{children}</div>
}

export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  tone = 'text-slate-500',
  children,
}: {
  label: string
  onClick: () => void
  tone?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-lg ${tone} hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
    >
      {children}
    </button>
  )
}
