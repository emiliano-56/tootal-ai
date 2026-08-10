'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  KeyRound,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/db'
import type { AiProvider } from '@/lib/services/api-routing'

/**
 * A customer's own AI keys.
 *
 * Writes go through the RLS-scoped browser client. The `api_credentials_write`
 * policy already restricts a customer to rows where `scope = 'user'` and
 * `owner_id = auth.uid()`, so a service-role route would add a place for a
 * mistake without adding a check.
 *
 * Whether this screen appears at all is the platform owner's decision, read
 * from `/api/my-keys` rather than from the settings table directly — those
 * settings are superadmin-only and should stay that way. A customer who is not
 * allowed sees why, not a blank page.
 *
 * The key is never read back after it is saved. There is nothing here that
 * needs to display one, and a screen that does is a screen that ends up in a
 * support ticket screenshot.
 */

const PROVIDERS: { value: AiProvider; label: string; url: string; hint: string }[] = [
  {
    value: 'deepseek',
    label: 'DeepSeek',
    url: 'https://platform.deepseek.com/api_keys',
    hint: 'What the platform uses by default. Cheapest of the four.',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    url: 'https://platform.openai.com/api-keys',
    hint: 'GPT models.',
  },
  {
    value: 'claude',
    label: 'Claude',
    url: 'https://console.anthropic.com/settings/keys',
    hint: 'Anthropic models.',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    url: 'https://openrouter.ai/keys',
    hint: 'One key, many models behind it.',
  },
]

interface KeyRow {
  id: string
  provider: string
  label: string
  enabled: boolean
  last_test_ok: boolean | null
  created_at: string
}

interface Status {
  allowed: boolean
  policy: string
  explanation: string
  keys: KeyRow[]
}

export function MyApiKeys() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [provider, setProvider] = useState<AiProvider>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/my-keys')
      const payload = await response.json()

      if (!response.ok) setError(payload.error ?? 'Could not load your keys')
      else setStatus(payload)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!apiKey.trim()) return

    setBusy(true)
    setError('')
    setNotice('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Your session expired. Sign in again.')
      setBusy(false)
      return
    }

    const chosen = PROVIDERS.find((entry) => entry.value === provider)

    const { error: writeError } = await supabase.from('api_credentials').insert({
      provider,
      scope: 'user',
      owner_id: user.id,
      label: `My ${chosen?.label ?? provider} key`,
      api_key: apiKey.trim(),
      model: model.trim() || null,
      // Below the platform default of 100, so that when the policy is "mixed"
      // — where ownership is ignored and priority alone decides — a customer
      // who went to the trouble of adding a key actually gets it used.
      priority: 50,
    })

    if (writeError) setError(writeError.message)
    else {
      setNotice(`${chosen?.label ?? provider} key added. It will be used on your next generation.`)
      setApiKey('')
      setModel('')
      await load()
    }

    setBusy(false)
  }

  const remove = async (row: KeyRow) => {
    setBusy(true)
    setError('')
    setNotice('')

    const { error: writeError } = await supabase
      .from('api_credentials')
      .delete()
      .eq('id', row.id)

    if (writeError) setError(writeError.message)
    else {
      setNotice(`${row.label} removed. Generation goes back to the platform’s key.`)
      await load()
    }

    setBusy(false)
  }

  const toggle = async (row: KeyRow) => {
    setBusy(true)

    const { error: writeError } = await supabase
      .from('api_credentials')
      .update({ enabled: !row.enabled })
      .eq('id', row.id)

    if (writeError) setError(writeError.message)
    else await load()

    setBusy(false)
  }

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" />
      </div>
    )
  }

  // Not an error and not an upsell — the platform owner has decided, and a
  // customer can do nothing about it. Said once, plainly, and then out of
  // the way.
  if (!status?.allowed) {
    return (
      <div className="max-w-xl">
        <div className="p-5 rounded-2xl bg-slate-50 ring-1 ring-slate-200 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-900 text-sm">Nothing to set up</p>
            <p className="text-sm text-slate-500 mt-1">
              {status?.explanation ??
                'Generation runs on the platform’s own AI keys.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="p-4 rounded-2xl bg-indigo-50/70 ring-1 ring-indigo-200">
        <p className="text-sm text-indigo-900">{status.explanation}</p>
      </div>

      {error && (
        <p className="p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-sm text-red-600">{error}</p>
      )}
      {notice && (
        <p className="p-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      {status.keys.length > 0 && (
        <div className="space-y-2">
          {status.keys.map((row) => (
            <div
              key={row.id}
              className="p-4 rounded-2xl bg-white ring-1 ring-slate-200 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 shrink-0 rounded-xl grid place-items-center bg-indigo-100 text-indigo-700">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{row.label}</p>
                  <p className="text-xs text-slate-500">
                    {row.enabled ? 'In use' : 'Paused'}
                    {row.last_test_ok === false && ' · last call failed'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggle(row)}
                  disabled={busy}
                  className="h-9 px-3 rounded-lg ring-1 ring-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {row.enabled ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => remove(row)}
                  disabled={busy}
                  aria-label={`Remove ${row.label}`}
                  className="h-9 w-9 grid place-items-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-5 rounded-2xl bg-white ring-1 ring-slate-200 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900 text-sm">Add a key</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stored for your account only. Nobody else on this platform can see or use it.
          </p>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Provider</label>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as AiProvider)}
            className="w-full h-11 px-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {PROVIDERS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>

          {(() => {
            const chosen = PROVIDERS.find((entry) => entry.value === provider)

            return chosen ? (
              <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span>{chosen.hint}</span>
                <a
                  href={chosen.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  Get a key
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            ) : null
          })()}
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">API key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-…"
              className="w-full h-11 px-3 pr-11 rounded-xl bg-slate-50 ring-1 ring-slate-200 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
            Model <span className="font-normal text-slate-400">— optional</span>
          </label>
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="Leave blank for the provider’s default"
            className="w-full h-11 px-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={add}
          disabled={busy || !apiKey.trim()}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add key
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Your key is used only for your own generations and is billed by the provider directly to
        you. Remove it any time and everything goes back to the platform’s key.{' '}
        <Link href="/support" className="font-semibold text-indigo-600 hover:underline">
          Need help?
        </Link>
      </p>
    </div>
  )
}
