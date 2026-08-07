'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, RefreshCw, Star, Power, FlaskConical, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import {
  PageHeader,
  DataTable,
  StatusPill,
  ConfirmDialog,
  type Column,
} from '@/components/console/console-ui'
import { Banner, Dialog, Field, inputClass } from '@/components/console/providers-manager'

/**
 * SMTP accounts.
 *
 * The database enforces one primary per tenant with a partial unique index, so
 * promoting a new primary demotes the old one first rather than relying on the
 * insert to sort itself out.
 */

interface SmtpRow {
  last_test_ok?: boolean | null
  last_error?: string | null
  id: string
  label: string
  host: string
  port: number
  username: string
  from_email: string
  from_name: string | null
  secure: boolean
  is_primary: boolean
  is_backup: boolean
  enabled: boolean
}

export function SmtpManager({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<SmtpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [toDelete, setToDelete] = useState<SmtpRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('smtp_accounts')
      .select('id, label, host, port, username, from_email, from_name, secure, is_primary, is_backup, enabled, last_test_ok, last_error')
      .order('is_primary', { ascending: false })

    if (queryError) setError(queryError.message)

    setRows((data as SmtpRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const makePrimary = async (row: SmtpRow) => {
    setBusy(true)
    setError('')

    // Demote first — the unique index rejects two primaries in one tenant.
    await supabase.from('smtp_accounts').update({ is_primary: false }).eq('tenant_id', tenantId)

    const { error: writeError } = await supabase
      .from('smtp_accounts')
      .update({ is_primary: true })
      .eq('id', row.id)

    if (writeError) setError(writeError.message)
    else setNotice(`${row.label} is now the primary server.`)

    await load()
    setBusy(false)
  }

  /** Connect and authenticate against the real server. */
  const verify = async (row: SmtpRow) => {
    setBusy(true)
    setError('')
    setNotice('')

    const response = await fetch('/api/console/mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', id: row.id }),
    })

    const payload = await response.json().catch(() => ({}))

    if (response.ok) setNotice(row.label + ': connection and login succeeded.')
    else setError(row.label + ': ' + (payload.error ?? 'verification failed'))

    await load()
    setBusy(false)
  }

  /** Deliver a real message — the only proof that actually counts. */
  const sendTest = async (row: SmtpRow) => {
    const to = window.prompt('Send a test message to which address?', row.from_email)

    if (!to) return

    setBusy(true)
    setError('')
    setNotice('')

    const response = await fetch('/api/console/mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', to }),
    })

    const payload = await response.json().catch(() => ({}))

    if (response.ok) setNotice('Test sent to ' + to + '.')
    else setError(payload.error ?? 'Send failed')

    await load()
    setBusy(false)
  }

  const toggle = async (row: SmtpRow) => {
    setBusy(true)
    await supabase.from('smtp_accounts').update({ enabled: !row.enabled }).eq('id', row.id)
    await load()
    setBusy(false)
  }

  const columns: Column<SmtpRow>[] = [
    {
      key: 'label',
      header: 'Server',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white truncate flex items-center gap-2">
            {row.label}
            {row.is_primary && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold uppercase">
                primary
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
            {row.host}:{row.port}
          </p>
        </div>
      ),
    },
    { key: 'from', header: 'From', render: (row) => row.from_email },
    {
      key: 'secure',
      header: 'TLS',
      render: (row) => (row.secure ? 'Yes' : 'No'),
    },
    {
      key: 'health',
      header: 'Last test',
      render: (row) =>
        row.last_test_ok === null || row.last_test_ok === undefined ? (
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
          <button
            onClick={() => verify(row)}
            aria-label="Verify connection"
            title="Verify connection"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FlaskConical className="w-4 h-4" />
          </button>
          <button
            onClick={() => sendTest(row)}
            aria-label="Send test email"
            title="Send test email"
            className="p-1.5 rounded-lg text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Send className="w-4 h-4" />
          </button>
          {!row.is_primary && (
            <button
              onClick={() => makePrimary(row)}
              aria-label="Make primary"
              title="Make primary"
              className="p-1.5 rounded-lg text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Star className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => toggle(row)}
            aria-label={row.enabled ? 'Disable' : 'Enable'}
            className={`p-1.5 rounded-lg ${row.enabled ? 'text-amber-600' : 'text-emerald-600'} hover:bg-slate-100 dark:hover:bg-slate-800`}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={() => setToDelete(row)}
            aria-label="Delete"
            className="p-1.5 rounded-lg text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="SMTP"
        subtitle="Mail servers used for transactional email and broadcasts."
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowAdd(true)}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add server
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
        searchPlaceholder="Search servers…"
        searchFields={(row) => `${row.label} ${row.host} ${row.from_email}`}
        emptyMessage="No mail servers configured yet."
      />

      {showAdd && (
        <AddSmtpDialog
          busy={busy}
          onClose={() => setShowAdd(false)}
          onSave={async (payload) => {
            setBusy(true)
            setError('')

            if (payload.is_primary) {
              await supabase.from('smtp_accounts').update({ is_primary: false }).eq('tenant_id', tenantId)
            }

            const { error: writeError } = await supabase
              .from('smtp_accounts')
              .insert({ ...payload, tenant_id: tenantId })

            if (writeError) setError(writeError.message)
            else {
              setNotice(`${payload.label} added.`)
              setShowAdd(false)
              await load()
            }

            setBusy(false)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this mail server?"
        message={`${toDelete?.label} will be removed. Any email configured to use it will fall back to another server.`}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (toDelete) {
            setBusy(true)
            await supabase.from('smtp_accounts').delete().eq('id', toDelete.id)
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

function AddSmtpDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (payload: Record<string, unknown> & { label: string; is_primary: boolean }) => void
}) {
  const [label, setLabel] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')
  const [secure, setSecure] = useState(true)
  const [isPrimary, setIsPrimary] = useState(false)

  return (
    <Dialog title="Add mail server" onClose={onClose}>
      <Field label="Label">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Field label="Host">
          <input value={host} onChange={(e) => setHost(e.target.value)} className={inputClass} placeholder="smtp.example.com" />
        </Field>
        <Field label="Port">
          <input type="number" value={port} onChange={(e) => setPort(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="From email">
          <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="From name">
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center gap-5 pt-1">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
          <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
          Use TLS
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
          Make primary
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={busy || !label || !host || !username || !password || !fromEmail}
          onClick={() =>
            onSave({
              label,
              host,
              port: Number(port) || 587,
              username,
              password,
              from_email: fromEmail,
              from_name: fromName || null,
              secure,
              is_primary: isPrimary,
            })
          }
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
        >
          {busy ? 'Saving…' : 'Add server'}
        </Button>
      </div>
    </Dialog>
  )
}
