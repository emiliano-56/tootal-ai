'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Trash2, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { renderTemplate, htmlToText } from '@/lib/services/templates'
import {
  PageHeader,
  DataTable,
  StatusPill,
  ConfirmDialog,
  type Column,
} from '@/components/console/console-ui'
import { Banner, Dialog, Field, inputClass } from '@/components/console/providers-manager'

/**
 * Email broadcasts.
 *
 * Composes, queues and sends. Delivery goes through lib/mail/mailer, which
 * falls back to the backup server, and the counters are written as the run
 * progresses so a crash halfway leaves an accurate record.
 */

interface BroadcastRow {
  id: string
  subject: string
  body_html: string
  audience: { role?: string }
  status: string
  total_count: number
  sent_count: number
  failed_count: number
  created_at: string
}

const AUDIENCES = [
  { value: 'all', label: 'Everyone I administer' },
  { value: 'user', label: 'Users only' },
  { value: 'active', label: 'Active accounts only' },
  { value: 'suspended', label: 'Suspended accounts' },
] as const

export function BroadcastsManager({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<BroadcastRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [toDelete, setToDelete] = useState<BroadcastRow | null>(null)
  const [toSend, setToSend] = useState<BroadcastRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('email_broadcasts')
      .select('id, subject, body_html, audience, status, total_count, sent_count, failed_count, created_at')
      .order('created_at', { ascending: false })

    if (queryError) setError(queryError.message)

    setRows((data as BroadcastRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const columns: Column<BroadcastRow>[] = [
    {
      key: 'subject',
      header: 'Broadcast',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white truncate">{row.subject}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {htmlToText(row.body_html).slice(0, 70)}
          </p>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      render: (row) =>
        AUDIENCES.find((a) => a.value === (row.audience?.role ?? 'all'))?.label ?? 'Everyone',
    },
    {
      key: 'progress',
      header: 'Progress',
      className: 'tabular-nums',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.sent_count} / {row.total_count}
          {row.failed_count > 0 && <span className="text-red-500"> · {row.failed_count} failed</span>}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusPill value={row.status === 'sent' ? 'active' : 'pending'} /> },
    {
      key: 'created',
      header: 'Created',
      render: (row) => (
        <span className="text-xs text-slate-400 tabular-nums">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.status !== 'sent' && (
            <button
              onClick={() => setToSend(row)}
              aria-label="Send now"
              title="Send now"
              className="p-1.5 rounded-lg text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setToDelete(row)}
            aria-label="Delete broadcast"
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
        title="Broadcasts"
        subtitle="Compose an email to the accounts you administer."
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowCompose(true)}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Compose
            </Button>
          </>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-slate-700">
        <Mail className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-6">
          Sending goes through the primary SMTP server, falling back to the backup. Configure
          one under <strong>SMTP</strong> first — a broadcast with no working server fails for
          every recipient.
        </p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        searchable
        searchPlaceholder="Search broadcasts…"
        searchFields={(row) => row.subject}
        emptyMessage="No broadcasts yet."
      />

      {showCompose && (
        <ComposeDialog
          busy={busy}
          onClose={() => setShowCompose(false)}
          onSave={async (payload) => {
            setBusy(true)
            setError('')

            // Count the audience now so the queued row is honest about scope.
            let query = supabase.from('profiles').select('id', { count: 'exact', head: true })

            if (payload.audience === 'user') query = query.eq('role', 'user')
            if (payload.audience === 'active') query = query.eq('status', 'active')
            if (payload.audience === 'suspended') query = query.eq('status', 'suspended')

            const { count } = await query

            const { error: writeError } = await supabase.from('email_broadcasts').insert({
              tenant_id: tenantId,
              subject: payload.subject,
              body_html: payload.bodyHtml,
              audience: { role: payload.audience },
              total_count: count ?? 0,
              status: 'pending',
            })

            if (writeError) setError(writeError.message)
            else {
              setNotice(`Queued for ${count ?? 0} recipient${count === 1 ? '' : 's'}.`)
              setShowCompose(false)
              await load()
            }

            setBusy(false)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toSend)}
        title="Send this broadcast now?"
        message={
          'This will email ' + (toSend?.total_count ?? 0) +
          ' recipient(s). Sending cannot be undone.'
        }
        confirmLabel="Send now"
        busy={busy}
        onConfirm={async () => {
          if (!toSend) return

          setBusy(true)
          setError('')
          setNotice('')

          const response = await fetch('/api/console/mail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_broadcast', id: toSend.id }),
          })

          const payload = await response.json().catch(() => ({}))

          if (response.ok) {
            setNotice('Sent ' + payload.sent + ' of ' + payload.total + ', ' + payload.failed + ' failed.')
          } else {
            setError(payload.error ?? 'Send failed')
          }

          await load()
          setBusy(false)
          setToSend(null)
        }}
        onCancel={() => setToSend(null)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this broadcast?"
        message={`“${toDelete?.subject}” will be removed.`}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (toDelete) {
            setBusy(true)
            await supabase.from('email_broadcasts').delete().eq('id', toDelete.id)
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

function ComposeDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (payload: { subject: string; bodyHtml: string; audience: string }) => void
}) {
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('<p>Hi {{first_name}},</p>\n<p></p>')
  const [audience, setAudience] = useState<string>('all')

  // Same renderer the sender would use, escaping included.
  const preview = useMemo(
    () =>
      renderTemplate(bodyHtml, {
        first_name: 'Alex',
        brand_name: 'ComicAgent AI',
        email: 'alex@example.com',
      }),
    [bodyHtml]
  )

  return (
    <Dialog title="Compose broadcast" onClose={onClose}>
      <Field label="Audience">
        <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass}>
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Body (HTML)" hint="Placeholders: {{first_name}}, {{brand_name}}, {{email}}">
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={7}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </Field>

      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Preview
        </p>
        <div
          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: preview.output }}
        />
        {preview.missing.length > 0 && (
          <p className="mt-1.5 text-xs text-amber-600">
            No sample value for: {preview.missing.join(', ')}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={busy || !subject || !bodyHtml.trim()}
          onClick={() => onSave({ subject, bodyHtml, audience })}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
        >
          {busy ? 'Queueing…' : 'Queue broadcast'}
        </Button>
      </div>
    </Dialog>
  )
}
