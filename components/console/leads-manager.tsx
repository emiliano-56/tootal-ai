'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Download, Trash2, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { parseLeadsCsv, partitionExisting, toCsv, isValidEmail } from '@/lib/services/leads'
import {
  PageHeader,
  DataTable,
  ConfirmDialog,
  type Column,
} from '@/components/console/console-ui'
import { Banner, Dialog, Field, inputClass } from '@/components/console/providers-manager'

/**
 * Lead list, import and export.
 *
 * Parsing and de-duplication live in lib/services/leads.ts, which is unit
 * tested — quoted commas and case-insensitive duplicates are the two things
 * that quietly corrupt an import, so they are not re-implemented here.
 *
 * Leads are marketing contacts, a different thing from the platform accounts
 * on the Users screen. Nothing appears here just because a user signed up.
 */

interface LeadRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  source: string | null
  tags: string[]
  created_at: string
  tenant_id: string
}

interface ImportSummary {
  inserted: number
  duplicatesInFile: number
  alreadyPresent: number
  invalid: number
}

/** Which kind of account owns a lead — a superadmin sees every tenant's. */
type OwnerFilter = 'all' | 'platform' | 'reseller' | 'white_label'

const OWNER_FILTERS: { value: OwnerFilter; label: string }[] = [
  { value: 'all', label: 'All accounts' },
  { value: 'platform', label: 'Users (platform)' },
  { value: 'reseller', label: 'Resellers' },
  { value: 'white_label', label: 'White labels' },
]

const DATE_FILTERS = [
  { value: 'all', label: 'Any time', days: 0 },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
]

export function LeadsManager({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<LeadRow[]>([])
  const [tenantTypes, setTenantTypes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [toDelete, setToDelete] = useState<LeadRow | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')
  const [dateFilter, setDateFilter] = useState('all')

  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data, error: queryError }, { data: tenants }] = await Promise.all([
      supabase
        .from('leads')
        .select('id, email, first_name, last_name, phone, source, tags, created_at, tenant_id')
        .order('created_at', { ascending: false }),
      supabase.from('tenants').select('id, type'),
    ])

    if (queryError) setError(queryError.message)

    setTenantTypes(
      Object.fromEntries(
        (tenants ?? []).map((t) => [(t as { id: string }).id, (t as { type: string }).type])
      )
    )
    setRows((data as LeadRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Filters apply before the table's own search, so the count in the subtitle
  // matches what the table is working from.
  const visibleRows = useMemo(() => {
    const days = DATE_FILTERS.find((d) => d.value === dateFilter)?.days ?? 0
    const cutoff = days > 0 ? Date.now() - days * 86_400_000 : 0

    return rows.filter((row) => {
      if (ownerFilter !== 'all' && tenantTypes[row.tenant_id] !== ownerFilter) return false
      if (cutoff && new Date(row.created_at).getTime() < cutoff) return false

      return true
    })
  }, [rows, tenantTypes, ownerFilter, dateFilter])

  const handleImport = async (file: File) => {
    setBusy(true)
    setError('')
    setNotice('')
    setSummary(null)

    try {
      const text = await file.text()
      const parsed = parseLeadsCsv(text, file.name.replace(/\.csv$/i, ''))

      if (parsed.valid.length === 0) {
        setError(
          parsed.invalid[0]?.reason === 'No email column found'
            ? 'That file has no email column.'
            : 'No valid rows found in that file.'
        )
        return
      }

      const { data: existing } = await supabase.from('leads').select('email')

      const { toInsert, alreadyPresent } = partitionExisting(
        parsed.valid,
        (existing ?? []).map((row) => (row as { email: string }).email)
      )

      let inserted = 0

      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500).map((row) => ({
          tenant_id: tenantId,
          email: row.email,
          first_name: row.firstName ?? null,
          last_name: row.lastName ?? null,
          phone: row.phone ?? null,
          source: row.source ?? null,
          tags: row.tags ?? [],
        }))

        const { error: insertError } = await supabase.from('leads').insert(chunk)

        if (insertError) {
          setError(insertError.message)
          break
        }

        inserted += chunk.length
      }

      setSummary({
        inserted,
        duplicatesInFile: parsed.duplicatesInFile.length,
        alreadyPresent: alreadyPresent.length,
        invalid: parsed.invalid.length,
      })

      await load()
    } catch {
      setError('Could not read that file.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const handleExport = () => {
    // Export what is on screen. Exporting the whole table from a filtered view
    // hands over rows the user was not looking at.
    const csv = toCsv(
      visibleRows.map((row) => ({
        email: row.email,
        firstName: row.first_name ?? undefined,
        lastName: row.last_name ?? undefined,
        phone: row.phone ?? undefined,
        tags: row.tags,
        source: row.source ?? undefined,
      }))
    )

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')

    link.href = url
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()

    URL.revokeObjectURL(url)
  }

  const columns: Column<LeadRow>[] = [
    {
      key: 'email',
      header: 'Lead',
      // Sort by name when there is one, falling back to email.
      sortValue: (row) =>
        `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim().toLowerCase() || row.email,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white truncate">{row.email}</p>
          {(row.first_name || row.last_name) && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {[row.first_name, row.last_name].filter(Boolean).join(' ')}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      sortValue: (row) => tenantTypes[row.tenant_id] ?? '',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 capitalize whitespace-nowrap">
          {(tenantTypes[row.tenant_id] ?? 'unknown').replace('_', ' ')}
        </span>
      ),
    },
    { key: 'phone', header: 'Phone', render: (row) => row.phone ?? '—' },
    {
      key: 'tags',
      header: 'Tags',
      render: (row) =>
        row.tags.length === 0 ? (
          '—'
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[11px] font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: 'source',
      header: 'Source',
      sortValue: (row) => (row.source ?? '').toLowerCase(),
      render: (row) => row.source ?? '—',
    },
    {
      key: 'created',
      header: 'Added',
      // Timestamp, not the formatted string — otherwise it sorts alphabetically.
      sortValue: (row) => new Date(row.created_at).getTime(),
      render: (row) => (
        <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <button
          onClick={() => setToDelete(row)}
          aria-label="Delete lead"
          className="p-1.5 rounded-lg text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ]

  const filtered = ownerFilter !== 'all' || dateFilter !== 'all'

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={
          filtered
            ? `${visibleRows.length} of ${rows.length} leads shown.`
            : `${rows.length} lead${rows.length === 1 ? '' : 's'} in your list.`
        }
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleImport(file)
              }}
            />

            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button variant="outline" onClick={handleExport} disabled={visibleRows.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
              <Upload className="w-4 h-4 mr-2" />
              {busy ? 'Importing…' : 'Import CSV'}
            </Button>

            <Button
              onClick={() => setShowAdd(true)}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {summary && (
        <div className="mb-4 p-4 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Import finished</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <span>
              <strong className="text-emerald-600">{summary.inserted}</strong> imported
            </span>
            <span>
              <strong>{summary.alreadyPresent}</strong> already in your list
            </span>
            <span>
              <strong>{summary.duplicatesInFile}</strong> duplicates within the file
            </span>
            <span>
              <strong className={summary.invalid ? 'text-amber-600' : ''}>{summary.invalid}</strong>{' '}
              invalid rows skipped
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={ownerFilter}
          onChange={(event) => setOwnerFilter(event.target.value as OwnerFilter)}
          aria-label="Filter by owning account type"
          className="h-10 px-3 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {OWNER_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          aria-label="Filter by date added"
          className="h-10 px-3 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {DATE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {filtered && (
          <button
            onClick={() => {
              setOwnerFilter('all')
              setDateFilter('all')
            }}
            className="h-10 px-3 rounded-xl text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        rows={visibleRows}
        columns={columns}
        loading={loading}
        searchable
        searchPlaceholder="Search by email, name or tag…"
        searchFields={(row) =>
          `${row.email} ${row.first_name ?? ''} ${row.last_name ?? ''} ${row.tags.join(' ')}`
        }
        emptyMessage={
          rows.length === 0
            ? 'No leads yet. Leads are marketing contacts, separate from the platform accounts on the Users screen — importing a CSV or adding one manually is what fills this in.'
            : 'No leads match these filters.'
        }
        pageSize={15}
      />

      {showAdd && (
        <AddLeadDialog
          busy={busy}
          onClose={() => setShowAdd(false)}
          onSave={async (lead) => {
            setBusy(true)
            setError('')

            const { error: insertError } = await supabase
              .from('leads')
              .insert({ ...lead, tenant_id: tenantId })

            if (insertError) {
              setError(
                insertError.code === '23505'
                  ? 'That email is already in your list.'
                  : insertError.message
              )
            } else {
              setNotice(`${lead.email} added.`)
              setShowAdd(false)
              await load()
            }

            setBusy(false)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this lead?"
        message={`${toDelete?.email} will be removed from your list. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (toDelete) {
            setBusy(true)
            await supabase.from('leads').delete().eq('id', toDelete.id)
            await load()
            setBusy(false)
            setNotice(`${toDelete.email} deleted.`)
          }
          setToDelete(null)
        }}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}

function AddLeadDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (lead: Record<string, unknown>) => void
}) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [tags, setTags] = useState('')

  const emailValid = email === '' || isValidEmail(email)

  return (
    <Dialog title="Add a lead" onClose={onClose}>
      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        {!emailValid && <p className="text-xs text-red-500">That does not look like an email.</p>}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="First name">
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Last name">
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <Field label="Phone">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Tags" hint="Separate with a semicolon">
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={busy || !email || !emailValid}
          onClick={() =>
            onSave({
              email: email.trim().toLowerCase(),
              first_name: firstName || null,
              last_name: lastName || null,
              phone: phone || null,
              source: 'manual',
              tags: tags.split(';').map((t) => t.trim()).filter(Boolean),
            })
          }
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
        >
          {busy ? 'Saving…' : 'Add lead'}
        </Button>
      </div>
    </Dialog>
  )
}
