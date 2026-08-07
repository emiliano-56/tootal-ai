'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, RefreshCw, Copy, Check, Link2, ShieldCheck, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/console/console-ui'
import { Banner, Field, inputClass, SectionHeading } from '@/components/console/providers-manager'

/**
 * Instant Payment Notification setup.
 *
 * The nine products sold on launchpadjv.com each get an id here, and a post
 * carrying that id creates the account and grants the tier. Mapping is the
 * whole job: everything else on this screen exists so an operator can see
 * whether it is working without opening the database.
 */

interface PlanRow {
  id: string
  code: string
  name: string
  tier: string | null
  seats: number | null
  is_bundle: boolean
  ipn_product_id: string | null
}

interface EventRow {
  id: string
  vendor: string
  external_id: string | null
  event_type: string | null
  product_id: string | null
  email: string | null
  plan_code: string | null
  status: string
  message: string | null
  created_at: string
}

interface Settings {
  vendor: string
  enabled: boolean
  hasSecret: boolean
  field_email: string
  field_name: string
  field_product: string
  field_transaction: string
  field_event: string
  sale_events: string[]
  refund_events: string[]
  welcome_template: string
}

export function IpnManager() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [productIds, setProductIds] = useState<Record<string, string>>({})
  const [secret, setSecret] = useState('')
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    const response = await fetch('/api/console/ipn')
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(result.error ?? 'Could not load the IPN setup')
      setLoading(false)
      return
    }

    // The address the vendor will actually reach, which is the configured
    // Site URL when there is one — not whichever host this browser used.
    setOrigin(result.webhookBase || window.location.origin)
    setSettings(result.settings)
    setPlans(result.plans ?? [])
    setEvents(result.events ?? [])
    setProductIds(
      Object.fromEntries(
        ((result.plans as PlanRow[]) ?? []).map((plan) => [plan.id, plan.ipn_product_id ?? ''])
      )
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const call = async (payload: Record<string, unknown>, done: string) => {
    setBusy(true)
    setError('')
    setNotice('')

    const response = await fetch('/api/console/ipn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) setError(result.error ?? 'Something went wrong')
    else {
      setNotice(done)
      await load()
    }

    setBusy(false)
    return { ok: response.ok, result }
  }

  const saveSettings = () =>
    call(
      {
        action: 'settings',
        vendor: settings?.vendor,
        enabled: settings?.enabled,
        field_email: settings?.field_email,
        field_name: settings?.field_name,
        field_product: settings?.field_product,
        field_transaction: settings?.field_transaction,
        field_event: settings?.field_event,
        sale_events: settings?.sale_events,
        refund_events: settings?.refund_events,
        welcome_template: settings?.welcome_template,
        // Left out entirely when untouched, so saving never clears it.
        ...(secret ? { secret } : {}),
      },
      'IPN settings saved.'
    ).then(() => setSecret(''))

  const webhookUrl = `${origin}/api/ipn/${settings?.vendor ?? 'launchpadjv'}`

  const copyUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const patch = (values: Partial<Settings>) =>
    setSettings((current) => (current ? { ...current, ...values } : current))

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="IPN" subtitle="Turning a purchase into an account." />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!settings) {
    return (
      <div>
        <PageHeader title="IPN" subtitle="Turning a purchase into an account." />
        <Banner tone="error">
          {error || 'Run migration 012 to create the IPN tables, then reload this page.'}
        </Banner>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="IPN"
        subtitle="Turning a purchase on launchpadjv.com into an account, a version and a welcome email."
        actions={
          <Button variant="outline" onClick={load} disabled={busy}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {/* ---- endpoint ---- */}
      <section className="mb-8 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-5">
        <SectionHeading
          title="Endpoint"
          hint="Paste this into the notification URL field for every product on the vendor's side."
        />

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <code className="flex-1 min-w-0 truncate px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-xs text-slate-700 dark:text-slate-300">
            {webhookUrl}
          </code>

          <Button variant="outline" onClick={copyUrl}>
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Vendor" hint="Also the last part of the URL above.">
            <input
              value={settings.vendor}
              onChange={(event) => patch({ vendor: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field
            label={settings.hasSecret ? 'Shared secret (set)' : 'Shared secret'}
            hint={
              settings.hasSecret
                ? 'Leave blank to keep the current one.'
                : 'Strongly recommended — without it anyone who finds the URL can create accounts.'
            }
          >
            <input
              type="password"
              value={secret}
              placeholder={settings.hasSecret ? '••••••••••••' : 'Choose a long random string'}
              onChange={(event) => setSecret(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-3 cursor-pointer">
          <span className="relative inline-flex">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => patch({ enabled: event.target.checked })}
              className="peer sr-only"
            />
            <span className="w-11 h-6 rounded-full bg-slate-200 dark:bg-slate-700 peer-checked:bg-emerald-500 transition-colors" />
            <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
          </span>

          <span className="text-sm text-slate-700 dark:text-slate-300">
            Accept notifications
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              While this is off the endpoint answers 503 and no accounts are created.
            </span>
          </span>
        </label>

        {!settings.hasSecret && settings.enabled && (
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-600">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-px" />
            The endpoint is live with no secret set. Anyone who guesses the URL can create paid
            accounts.
          </p>
        )}
      </section>

      {/* ---- product mapping ---- */}
      <section className="mb-8">
        <SectionHeading
          title="Products"
          hint="The id the vendor sends for each product. A purchase grants this version and every version beneath it."
        />

        <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {plans.map((plan) => (
            <div key={plan.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  {plan.name}
                  {plan.is_bundle && (
                    <span className="text-[9px] font-bold text-violet-600 uppercase">bundle</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {plan.code}
                  {plan.seats ? ` · ${plan.seats} seats` : ''}
                </p>
              </div>

              <input
                value={productIds[plan.id] ?? ''}
                onChange={(event) =>
                  setProductIds((current) => ({ ...current, [plan.id]: event.target.value }))
                }
                placeholder="Vendor product id"
                className={`${inputClass} sm:w-56`}
              />

              <Button
                variant="outline"
                disabled={busy || (productIds[plan.id] ?? '') === (plan.ipn_product_id ?? '')}
                onClick={() =>
                  call(
                    { action: 'map', planId: plan.id, productId: productIds[plan.id] ?? '' },
                    `${plan.name} mapped.`
                  )
                }
              >
                <Link2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ---- payload field names ---- */}
      <section className="mb-8 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-5">
        <SectionHeading
          title="Payload fields"
          hint="Where to look in what the vendor posts. Names are matched loosely, so customer_email also finds CustomerEmail."
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Buyer email">
            <input
              value={settings.field_email}
              onChange={(event) => patch({ field_email: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Buyer name">
            <input
              value={settings.field_name}
              onChange={(event) => patch({ field_name: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Product id">
            <input
              value={settings.field_product}
              onChange={(event) => patch({ field_product: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Transaction id" hint="Used to ignore a retry of a sale already handled.">
            <input
              value={settings.field_transaction}
              onChange={(event) => patch({ field_transaction: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Event type" hint="Leave blank if the vendor only posts sales.">
            <input
              value={settings.field_event}
              onChange={(event) => patch({ field_event: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Welcome email template" hint="Key of a template under Email Templates.">
            <input
              value={settings.welcome_template}
              onChange={(event) => patch({ welcome_template: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Sale events" hint="Comma separated.">
            <input
              value={settings.sale_events.join(', ')}
              onChange={(event) =>
                patch({ sale_events: event.target.value.split(',').map((v) => v.trim()) })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Refund events" hint="These remove the version again.">
            <input
              value={settings.refund_events.join(', ')}
              onChange={(event) =>
                patch({ refund_events: event.target.value.split(',').map((v) => v.trim()) })
              }
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={saveSettings} disabled={busy}>
            <Save className="w-4 h-4 mr-1.5" />
            Save settings
          </Button>
        </div>
      </section>

      {/* ---- what actually arrived ---- */}
      <section>
        <SectionHeading
          title="Recent notifications"
          hint="The last 50 posts, newest first. Replay re-runs a stored payload."
        />

        {events.length === 0 ? (
          <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Nothing yet. Once a product id is mapped and the endpoint is on, sales appear here.
          </div>
        ) : (
          <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {events.map((event) => (
              <div key={event.id} className="p-4 flex flex-wrap items-start gap-3">
                <StatusPill status={event.status} />

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900 dark:text-white truncate">
                    {event.email ?? 'no address'}
                    {event.plan_code && (
                      <span className="ml-2 text-xs text-indigo-600">{event.plan_code}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{event.message}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                    {new Date(event.created_at).toLocaleString()}
                    {event.product_id && ` · product ${event.product_id}`}
                    {event.event_type && ` · ${event.event_type}`}
                  </p>
                </div>

                {event.status !== 'processed' && (
                  <button
                    onClick={() => call({ action: 'replay', eventId: event.id }, 'Replayed.')}
                    disabled={busy}
                    title="Run this payload again"
                    aria-label="Replay this notification"
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    processed: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    ignored: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    failed: 'bg-red-50 dark:bg-red-500/10 text-red-600',
    received: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  }

  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
        styles[status] ?? styles.received
      }`}
    >
      {status}
    </span>
  )
}
