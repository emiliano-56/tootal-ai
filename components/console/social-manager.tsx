'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/console/console-ui'
import { Banner, Field, inputClass, SectionHeading } from '@/components/console/providers-manager'
import { network } from '@/lib/social/networks'

/**
 * Developer app credentials, one set per network.
 *
 * These belong to the platform owner — every customer connects their own
 * account through this one app. The redirect URI is shown because the platform
 * demands an exact match, and a single character out is the most common reason
 * an otherwise correct setup fails at the last step.
 */

interface AppRow {
  platform: string
  clientId: string
  hasSecret: boolean
  enabled: boolean
  redirectUri: string
}

/** Where each platform's developer console lives, to save a search. */
/** Platforms that are not social networks and so have no catalogue entry. */
const LABELS: Record<string, string> = { google_drive: 'Google Drive' }
const COLOURS: Record<string, string> = { google_drive: '#1a73e8' }

const CONSOLES: Record<string, string> = {
  facebook: 'https://developers.facebook.com/apps',
  instagram: 'https://developers.facebook.com/apps',
  twitter: 'https://developer.x.com/en/portal/dashboard',
  linkedin: 'https://www.linkedin.com/developers/apps',
  reddit: 'https://www.reddit.com/prefs/apps',
  google_drive: 'https://console.cloud.google.com/apis/credentials',
}

export function SocialManager() {
  const [apps, setApps] = useState<AppRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, { clientId: string; clientSecret: string }>>({})
  const [stats, setStats] = useState({ connections: 0, posts: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/console/social')
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(payload.error ?? 'Could not load the social apps')
      setLoading(false)
      return
    }

    const list = (payload.apps ?? []) as AppRow[]

    setApps(list)
    setStats(payload.stats ?? { connections: 0, posts: 0 })
    setDrafts(
      Object.fromEntries(list.map((app) => [app.platform, { clientId: app.clientId, clientSecret: '' }]))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async (platform: string, extra: Record<string, unknown> = {}) => {
    setBusy(platform)
    setError('')
    setNotice('')

    const draft = drafts[platform] ?? { clientId: '', clientSecret: '' }

    const response = await fetch('/api/console/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        clientId: draft.clientId,
        // Left out when blank, so saving does not clear a stored secret.
        ...(draft.clientSecret ? { clientSecret: draft.clientSecret } : {}),
        ...extra,
      }),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) setError(result.error ?? 'Could not save')
    else {
      setNotice(`${network(platform)?.label ?? platform} saved.`)
      await load()
    }

    setBusy('')
  }

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Social apps" subtitle="Letting customers connect their accounts." />
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Social apps"
        subtitle="One developer app per network. Every customer connects their own account through it."
        actions={
          <Button variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-sm">
        <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
            Connected accounts
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {stats.connections}
          </p>
        </div>

        <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
            Posts published
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {stats.posts}
          </p>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-100 dark:ring-amber-500/20">
        <p className="text-sm text-amber-800 dark:text-amber-400">
          <strong>Telegram is not listed here.</strong> It needs no developer app — each customer
          pastes their own bot token, so it works the day they buy Autopilot. Facebook, Instagram
          and LinkedIn will only post for real users once the app below has passed that platform&rsquo;s
          review, which takes days to weeks.
        </p>
      </div>

      <div className="space-y-4">
        {apps.map((app) => {
          const info = network(app.platform)
          const draft = drafts[app.platform] ?? { clientId: '', clientSecret: '' }

          return (
            <section
              key={app.platform}
              className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-xl grid place-items-center text-white font-bold"
                    style={{ backgroundColor: info?.colour ?? COLOURS[app.platform] ?? '#64748b' }}
                  >
                    {(info?.label ?? LABELS[app.platform] ?? app.platform).charAt(0)}
                  </span>

                  <div>
                    <h3 className="font-display font-bold text-slate-900 dark:text-white">
                      {info?.label ?? LABELS[app.platform] ?? app.platform}
                      {info?.needsReview && (
                        <span className="ml-2 text-[10px] font-bold text-amber-600 uppercase">
                          needs review
                        </span>
                      )}
                    </h3>

                    {CONSOLES[app.platform] && (
                      <a
                        href={CONSOLES[app.platform]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                      >
                        Developer console
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="relative inline-flex">
                    <input
                      type="checkbox"
                      checked={app.enabled}
                      onChange={(event) => save(app.platform, { enabled: event.target.checked })}
                      className="peer sr-only"
                    />
                    <span className="w-11 h-6 rounded-full bg-slate-200 dark:bg-slate-700 peer-checked:bg-emerald-500 transition-colors" />
                    <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                  </span>

                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {app.enabled ? 'Available' : 'Off'}
                  </span>
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Client ID">
                  <input
                    value={draft.clientId}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [app.platform]: { ...draft, clientId: event.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                </Field>

                <Field
                  label={app.hasSecret ? 'Client secret (set)' : 'Client secret'}
                  hint={app.hasSecret ? 'Leave blank to keep the current one.' : undefined}
                >
                  <input
                    type="password"
                    value={draft.clientSecret}
                    placeholder={app.hasSecret ? '••••••••••••' : ''}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [app.platform]: { ...draft, clientSecret: event.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="mt-4">
                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Redirect URI
                </p>

                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-xs text-slate-700 dark:text-slate-300">
                    {app.redirectUri}
                  </code>

                  <Button variant="outline" onClick={() => copy(app.redirectUri, app.platform)}>
                    {copied === app.platform ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <p className="mt-1.5 text-xs text-slate-400">
                  Paste this into the app&rsquo;s settings exactly as shown — the platform compares
                  it character for character.
                </p>
              </div>

              {app.platform === 'google_drive' && (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Scope <code>drive.file</code> — the app can only touch files it created itself,
                  never the customer&rsquo;s existing documents. Google classes it as sensitive, so a
                  live app needs verification; up to 100 testers work without it.
                </p>
              )}

              {info?.note && (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{info.note}</p>
              )}

              <div className="mt-5 flex justify-end">
                <Button onClick={() => save(app.platform)} disabled={busy === app.platform}>
                  <Save className="w-4 h-4 mr-1.5" />
                  {busy === app.platform ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
