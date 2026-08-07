'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, RefreshCw, Power, FlaskConical, Send, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { ADAPTER_LIST, getAdapter } from '@/lib/autoresponders/adapters'
import type { ListSummary } from '@/lib/autoresponders/types'
import {
  PageHeader,
  DataTable,
  StatusPill,
  ConfirmDialog,
  type Column,
} from '@/components/console/console-ui'
import { Banner, Dialog, Field, inputClass, SectionHeading } from '@/components/console/providers-manager'
import { maskKey } from '@/lib/services/mask'

/**
 * Autoresponder connections.
 *
 * Rows are managed directly through RLS; anything that talks to a provider
 * goes via /api/console/autoresponders, because the keys must not reach the
 * browser and the provider APIs reject browser origins anyway.
 */

interface ConnectionRow {
  id: string
  provider: string
  label: string
  api_key: string
  api_secret: string | null
  list_id: string | null
  enabled: boolean
  last_test_ok: boolean | null
  last_error: string | null
  last_tested_at: string | null
}

export function AutorespondersManager({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<ConnectionRow[]>([])
  const [leadCount, setLeadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [toDelete, setToDelete] = useState<ConnectionRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data, error: queryError }, { count }] = await Promise.all([
      supabase
        .from('autoresponder_connections')
        .select('id, provider, label, api_key, api_secret, list_id, enabled, last_test_ok, last_error, last_tested_at')
        .order('provider'),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
    ])

    if (queryError) setError(queryError.message)

    setRows((data as ConnectionRow[]) ?? [])
    setLeadCount(count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const callApi = async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/console/autoresponders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    return { ok: response.ok, body: await response.json().catch(() => ({})) }
  }

  const test = async (row: ConnectionRow) => {
    setBusy(true)
    setError('')
    setNotice('')

    const { ok, body } = await callApi({ action: 'verify', id: row.id })

    if (ok) setNotice(`${row.label}: credentials accepted.`)
    else setError(`${row.label}: ${body.error ?? 'verification failed'}`)

    await load()
    setBusy(false)
  }

  const toggle = async (row: ConnectionRow) => {
    setBusy(true)
    await supabase
      .from('autoresponder_connections')
      .update({ enabled: !row.enabled })
      .eq('id', row.id)
    await load()
    setBusy(false)
  }

  /** Send every lead to every enabled connection, in batches the API accepts. */
  const pushAll = async () => {
    setBusy(true)
    setError('')
    setNotice('')

    const { data: leads } = await supabase.from('leads').select('id')
    const ids = (leads ?? []).map((l) => (l as { id: string }).id)

    if (ids.length === 0) {
      setError('No leads to push.')
      setBusy(false)
      return
    }

    let sent = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < ids.length; i += 200) {
      const { ok, body } = await callApi({ action: 'push', leadIds: ids.slice(i, i + 200) })

      if (!ok) {
        setError(body.error ?? 'Push failed')
        break
      }

      sent += body.sent ?? 0
      skipped += body.skipped ?? 0
      failed += body.failed ?? 0
    }

    setNotice(
      `Pushed ${sent} · ${skipped} already subscribed · ${failed} failed, across ${rows.filter((r) => r.enabled).length} connection(s).`
    )
    setBusy(false)
  }

  const columns: Column<ConnectionRow>[] = [
    {
      key: 'label',
      header: 'Connection',
      sortValue: (row) => row.label.toLowerCase(),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white truncate">{row.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {maskKey(row.api_key)}
          </p>
        </div>
      ),
    },
    {
      key: 'provider',
      header: 'Provider',
      sortValue: (row) => row.provider,
      render: (row) => getAdapter(row.provider)?.label ?? row.provider,
    },
    {
      key: 'list',
      header: 'List',
      render: (row) => (
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {row.list_id || '—'}
        </span>
      ),
    },
    {
      key: 'health',
      header: 'Last test',
      render: (row) =>
        row.last_tested_at === null ? (
          <span className="text-xs text-slate-400">Never tested</span>
        ) : row.last_test_ok ? (
          <span className="text-xs text-emerald-600 font-medium">Passed</span>
        ) : (
          <span className="text-xs text-red-500 font-medium" title={row.last_error ?? ''}>
            Failed
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
          <IconBtn label="Test credentials" onClick={() => test(row)}>
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

  const enabled = rows.filter((row) => row.enabled).length

  return (
    <>
      <PageHeader
        title="Autoresponders"
        subtitle={`${rows.length} connection${rows.length === 1 ? '' : 's'}, ${enabled} enabled. A lead is pushed to every enabled one.`}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              onClick={pushAll}
              disabled={busy || enabled === 0 || leadCount === 0}
              title={
                enabled === 0
                  ? 'Enable a connection first'
                  : leadCount === 0
                    ? 'No leads to push'
                    : undefined
              }
            >
              <Send className="w-4 h-4 mr-2" />
              {busy ? 'Pushing…' : `Push ${leadCount} lead${leadCount === 1 ? '' : 's'}`}
            </Button>

            <Button
              onClick={() => setShowAdd(true)}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        searchable
        searchPlaceholder="Search connections…"
        searchFields={(row) => `${row.label} ${row.provider}`}
        emptyMessage="No autoresponders connected yet."
      />

      <div className="mt-8">
        <SectionHeading
          title="Available providers"
          hint="Nine integrations. A lead can go to several at once."
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {ADAPTER_LIST.map((adapter) => {
            const connected = rows.some((row) => row.provider === adapter.provider)

            return (
              <div
                key={adapter.provider}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium ring-1 ${
                  connected
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-200 dark:ring-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {adapter.label}
                {connected && <span className="block text-[10px] opacity-70">connected</span>}
              </div>
            )
          })}
        </div>
      </div>

      {showAdd && (
        <ConnectDialog
          busy={busy}
          onClose={() => setShowAdd(false)}
          onSave={async (payload) => {
            setBusy(true)
            setError('')

            const { error: writeError } = await supabase
              .from('autoresponder_connections')
              .insert({ ...payload, tenant_id: tenantId })

            if (writeError) setError(writeError.message)
            else {
              setNotice(`${payload.label} connected.`)
              setShowAdd(false)
              await load()
            }

            setBusy(false)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Remove this connection?"
        message={`${toDelete?.label} will stop receiving new leads. Contacts already sent stay with the provider.`}
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (toDelete) {
            setBusy(true)
            await supabase.from('autoresponder_connections').delete().eq('id', toDelete.id)
            await load()
            setBusy(false)
          }
          setToDelete(null)
        }}
        onCancel={() => setToDelete(null)}
      />
    </>
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

function ConnectDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => void
}) {
  const [provider, setProvider] = useState(ADAPTER_LIST[0].provider)
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [listId, setListId] = useState('')
  const [lists, setLists] = useState<ListSummary[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [feedback, setFeedback] = useState('')

  const adapter = getAdapter(provider)!

  /** Pull the provider's lists so the user picks a name, not a raw id. */
  const fetchLists = async () => {
    setChecking(true)
    setFeedback('')
    setLists(null)

    const response = await fetch('/api/console/autoresponders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lists', provider, apiKey, apiSecret, listId }),
    })

    const body = await response.json().catch(() => ({}))

    if (response.ok && body.lists) {
      setLists(body.lists)
      setFeedback(`${body.lists.length} list(s) found.`)
    } else {
      setFeedback(body.error ?? 'Could not reach the provider.')
    }

    setChecking(false)
  }

  return (
    <Dialog title="Connect an autoresponder" onClose={onClose}>
      <Field label="Provider">
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as typeof provider)
            setLists(null)
            setFeedback('')
          }}
          className={inputClass}
        >
          {ADAPTER_LIST.map((a) => (
            <option key={a.provider} value={a.provider}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Label" hint="How this connection is shown in the list">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
      </Field>

      <Field label={adapter.fields.apiKey.label} hint={adapter.fields.apiKey.hint}>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className={`${inputClass} font-mono`}
        />
      </Field>

      {adapter.fields.apiSecret && (
        <Field label={adapter.fields.apiSecret.label} hint={adapter.fields.apiSecret.hint}>
          <input
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </Field>
      )}

      <Field
        label={adapter.fields.listId.label}
        hint={adapter.fields.listId.required ? adapter.fields.listId.hint : 'Optional'}
      >
        {lists && lists.length > 0 ? (
          <select value={listId} onChange={(e) => setListId(e.target.value)} className={inputClass}>
            <option value="">Select…</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className={`${inputClass} font-mono`}
          />
        )}
      </Field>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={fetchLists} disabled={checking || !apiKey}>
          <ListChecks className={`w-4 h-4 mr-2 ${checking ? 'animate-pulse' : ''}`} />
          {checking ? 'Checking…' : 'Fetch lists'}
        </Button>
        {feedback && <span className="text-xs text-slate-500 dark:text-slate-400">{feedback}</span>}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={
            busy || !label || !apiKey || (adapter.fields.listId.required && !listId)
          }
          onClick={() =>
            onSave({
              provider,
              label,
              api_key: apiKey,
              api_secret: apiSecret || null,
              list_id: listId || null,
            })
          }
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
        >
          {busy ? 'Saving…' : 'Connect'}
        </Button>
      </div>
    </Dialog>
  )
}
