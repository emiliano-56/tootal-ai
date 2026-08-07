'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, RefreshCw, Copy, Check, ShieldCheck, Globe, Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { can, type Role } from '@/lib/auth/rbac'
import {
  PageHeader,
  DataTable,
  StatusPill,
  ConfirmDialog,
  type Column,
} from '@/components/console/console-ui'
import { Banner, Dialog, Field, inputClass } from '@/components/console/providers-manager'
import { isApexDomain } from '@/lib/domains/records'

/**
 * Custom domain mapping.
 *
 * Records the domain and shows the CNAME + TXT records a customer must add.
 * Certificate issuance still happens at the hosting layer, which is not chosen
 * yet, so status stays honest: added → verified → approved.
 */

interface VerifyResult {
  verified: boolean
  cname: { matches: boolean; values: string[]; error?: string }
  txt: { matches: boolean; values: string[]; error?: string }
  expectedTarget: string
  txtName: string
}

interface DomainRow {
  tenant_id: string | null
  id: string
  domain: string
  purpose: string
  verification_token: string
  verified: boolean
  approved: boolean
  ssl_status: string
  status: string
  created_at: string
}

export function DomainsManager({
  tenantId,
  actorRole,
  userId,
}: {
  tenantId: string
  actorRole: Role
  userId: string
}) {
  const [rows, setRows] = useState<DomainRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [toDelete, setToDelete] = useState<DomainRow | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [checks, setChecks] = useState<Record<string, VerifyResult>>({})
  const [tenants, setTenants] = useState<{ id: string; name: string; type: string }[]>([])

  const canApprove = can(actorRole, 'domains.approve')

  /**
   * Where customers point their CNAME.
   *
   * Read from the browser rather than hardcoded, so the instructions are
   * correct in development, staging and production without a config entry.
   */
  const cnameTarget =
    typeof window === 'undefined' ? 'your-platform-domain.com' : window.location.host

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data, error: queryError }, { data: tenantRows }] = await Promise.all([
      supabase
        .from('custom_domains')
        .select('id, domain, purpose, verification_token, verified, approved, ssl_status, status, created_at, tenant_id')
        .eq('purpose', 'portal')
        .order('created_at', { ascending: false }),
      supabase.from('tenants').select('id, name, type').neq('type', 'platform').order('name'),
    ])

    if (queryError) setError(queryError.message)

    setRows((data as DomainRow[]) ?? [])
    setTenants((tenantRows as { id: string; name: string; type: string }[]) ?? [])
    setLoading(false)
  }, [])

  /**
   * Ask the server to look up the live DNS records.
   *
   * The result is not trusted from the browser — the route does the lookup and
   * writes the verified flag itself.
   */
  const runCheck = async (row: DomainRow) => {
    setBusy(true)
    setError('')
    setNotice('')

    const response = await fetch('/api/console/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', id: row.id }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(payload.error ?? 'Check failed')
    } else {
      setChecks((current) => ({ ...current, [row.id]: payload }))
      setNotice(
        payload.verified
          ? row.domain + ' verified. It can be approved now.'
          : row.domain + ': DNS records are not in place yet.'
      )
      await load()
    }

    setBusy(false)
  }

  useEffect(() => {
    load()
  }, [load])

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setError('Could not copy — select the value manually.')
    }
  }

  const approve = async (row: DomainRow) => {
    setBusy(true)

    const { error: writeError } = await supabase
      .from('custom_domains')
      .update({ approved: !row.approved })
      .eq('id', row.id)

    if (writeError) setError(writeError.message)
    else setNotice(`${row.domain} ${row.approved ? 'un-approved' : 'approved'}.`)

    await load()
    setBusy(false)
  }

  const columns: Column<DomainRow>[] = [
    {
      key: 'domain',
      header: 'Domain',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white font-mono text-xs break-all">
            {row.domain}
          </p>
          <p className="text-[11px] text-slate-400">
            added {new Date(row.created_at).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      key: 'verification',
      header: 'DNS records',
      render: (row) => {
        const check = checks[row.id]

        if (check) {
          return (
            <div className="text-xs space-y-0.5">
              <p className={check.cname.matches ? 'text-emerald-600' : 'text-red-500'}>
                CNAME {check.cname.matches ? 'ok' : (check.cname.error ?? 'mismatch')}
              </p>
              <p className={check.txt.matches ? 'text-emerald-600' : 'text-red-500'}>
                TXT {check.txt.matches ? 'ok' : (check.txt.error ?? 'mismatch')}
              </p>
            </div>
          )
        }

        return row.verified ? (
          <span className="text-xs text-emerald-600 font-medium">Verified</span>
        ) : (
          <button
            onClick={() => copy(row.verification_token, row.id)}
            className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors"
            title="Copy token"
          >
            {copied === row.id ? (
              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
            ) : (
              <Copy className="w-3 h-3 shrink-0" />
            )}
            <span className="break-all">{row.verification_token.slice(0, 16)}…</span>
          </button>
        )
      },
    },
    {
      key: 'owner',
      header: 'Tenant',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {tenants.find((t) => t.id === row.tenant_id)?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'ssl',
      header: 'SSL',
      render: (row) => <StatusPill value={row.ssl_status === 'active' ? 'active' : 'pending'} />,
    },
    {
      key: 'approved',
      header: 'Approval',
      render: (row) =>
        row.approved ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Approved
          </span>
        ) : (
          <span className="text-xs text-amber-600 font-medium">Awaiting approval</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => runCheck(row)}
            title="Check DNS now"
            aria-label="Check DNS now"
            className="p-1.5 rounded-lg text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Search className="w-4 h-4" />
          </button>
          {canApprove && (
            <button
              onClick={() => approve(row)}
              title={row.approved ? 'Withdraw approval' : 'Approve'}
              aria-label={row.approved ? 'Withdraw approval' : 'Approve'}
              className={`p-1.5 rounded-lg ${row.approved ? 'text-amber-600' : 'text-emerald-600'} hover:bg-slate-100 dark:hover:bg-slate-800`}
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setToDelete(row)}
            aria-label="Remove domain"
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
        title="Domains"
        subtitle="Point your own domain at your branded portal."
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
              Add domain
            </Button>
          </>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {/* CNAME setup instructions */}
      <div className="mb-4 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800">
        <div className="flex items-start gap-3 mb-4">
          <Globe className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
              How to point your domain
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Add these two records at your DNS provider, then come back and verify.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 uppercase tracking-wider">
                {['Type', 'Name', 'Value', 'Why'].map((header) => (
                  <th key={header} className="text-left font-semibold px-3 py-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2.5 font-semibold">CNAME</td>
                <td className="px-3 py-2.5">your subdomain</td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => copy(cnameTarget, 'cname')}
                    className="flex items-center gap-1.5 text-indigo-600 hover:underline break-all"
                  >
                    {copied === 'cname' ? (
                      <Check className="w-3 h-3 shrink-0" />
                    ) : (
                      <Copy className="w-3 h-3 shrink-0" />
                    )}
                    {cnameTarget}
                  </button>
                </td>
                <td className="px-3 py-2.5 font-sans text-slate-500 dark:text-slate-400">
                  Routes traffic to your portal
                </td>
              </tr>
              <tr className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2.5 font-semibold">TXT</td>
                <td className="px-3 py-2.5">_comictale.your-subdomain</td>
                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 font-sans">
                  the token from the table below
                </td>
                <td className="px-3 py-2.5 font-sans text-slate-500 dark:text-slate-400">
                  Proves you own the domain
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-5">
          A CNAME cannot sit on a root domain (<span className="font-mono">example.com</span>) —
          use a subdomain such as <span className="font-mono">portal.example.com</span>, or an
          ALIAS/ANAME record if your provider offers one.
        </p>
      </div>

      <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-400 leading-6">
          <p className="font-semibold text-amber-900 dark:text-amber-300">
            Certificates are still issued manually
          </p>
          <p className="mt-0.5">
            The DNS records above are what your customer needs. Automatic certificate
            issuance depends on the hosting provider, which is not chosen yet — until then
            a superadmin approves each domain once its certificate is in place.
          </p>
        </div>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        searchable
        searchPlaceholder="Search domains…"
        searchFields={(row) => row.domain}
        emptyMessage="No domains mapped yet."
      />

      {showAdd && (
        <AddDomainDialog
          busy={busy}
          tenants={canApprove ? tenants : []}
          defaultTenantId={tenantId}
          onClose={() => setShowAdd(false)}
          onSave={async (domain, chosenTenantId) => {
            setBusy(true)
            setError('')

            const { error: writeError } = await supabase.from('custom_domains').insert({
              domain,
              purpose: 'portal',
              tenant_id: chosenTenantId || tenantId,
              user_id: userId,
            })

            if (writeError) {
              setError(
                writeError.code === '23505'
                  ? 'That domain is already registered.'
                  : writeError.message
              )
            } else {
              setNotice(`${domain} added. Add the TXT record shown, then request verification.`)
              setShowAdd(false)
              await load()
            }

            setBusy(false)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Remove this domain?"
        message={`${toDelete?.domain} will stop resolving to your portal once DNS propagates.`}
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (toDelete) {
            setBusy(true)
            await supabase.from('custom_domains').delete().eq('id', toDelete.id)
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

function AddDomainDialog({
  busy,
  tenants,
  defaultTenantId,
  onClose,
  onSave,
}: {
  busy: boolean
  /** Non-empty only for a superadmin, who may add on a tenant's behalf. */
  tenants: { id: string; name: string; type: string }[]
  defaultTenantId: string
  onClose: () => void
  onSave: (domain: string, tenantId: string) => void
}) {
  const [domain, setDomain] = useState('')
  const [chosenTenant, setChosenTenant] = useState(defaultTenantId)

  // Hostname only: a pasted URL or trailing slash would be stored verbatim and
  // never match the incoming Host header.
  const cleaned = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')

  const valid = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleaned)

  return (
    <Dialog title="Add a domain" onClose={onClose}>
      {tenants.length > 0 && (
        <Field label="Belongs to" hint="Which white-label account this domain serves">
          <select
            value={chosenTenant}
            onChange={(e) => setChosenTenant(e.target.value)}
            className={inputClass}
          >
            <option value={defaultTenantId}>Platform (this account)</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Domain or subdomain" hint="For example portal.yourdomain.com">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="portal.yourdomain.com"
          className={`${inputClass} font-mono`}
        />
      </Field>

      {domain && !valid && (
        <p className="text-xs text-red-500">
          That does not look like a hostname. Enter it without https:// or a path.
        </p>
      )}

      {valid && isApexDomain(cleaned) && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20 text-xs text-amber-800 dark:text-amber-400 leading-5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>
            <strong>{cleaned}</strong> is a root domain. A CNAME cannot be added there — use a
            subdomain like <span className="font-mono">portal.{cleaned}</span>, or an ALIAS/ANAME
            record if your DNS provider supports one.
          </span>
        </div>
      )}

      {domain && valid && cleaned !== domain.trim().toLowerCase() && (
        <p className="text-xs text-slate-500">
          Will be saved as <span className="font-mono">{cleaned}</span>
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={busy || !valid}
          onClick={() => onSave(cleaned, chosenTenant)}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
        >
          {busy ? 'Adding…' : 'Add domain'}
        </Button>
      </div>
    </Dialog>
  )
}
