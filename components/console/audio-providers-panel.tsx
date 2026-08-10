'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, ExternalLink, Power, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { maskKey } from '@/lib/services/mask'
import { Banner, Field, inputClass, SectionHeading } from '@/components/console/providers-manager'

/**
 * Music search providers.
 *
 * Kept on the AI Providers screen rather than given a page of its own: an
 * owner looking for "where do I paste a key" should find every key in one
 * place, and there are only ever a couple of these.
 *
 * They are a different shape from the model credentials next to them, which is
 * why they are a separate panel rather than another row in that table. There is
 * no failover chain and no token limit — each provider is a catalogue that is
 * either searched or not — and one of them takes no key at all.
 */

interface ProviderRow {
  provider: string
  label: string
  api_key: string | null
  enabled: boolean
  attribution: string
  needs_key: boolean
  setup_url: string | null
  notes: string | null
}

export function AudioProvidersPanel() {
  const [rows, setRows] = useState<ProviderRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('audio_providers')
      .select('provider, label, api_key, enabled, attribution, needs_key, setup_url, notes')
      .order('provider')

    if (queryError) {
      // The table only exists after migration 020, and the extra columns
      // after 021. Saying so beats an error nobody can act on.
      setMissing(true)
      setError(queryError.message)
      setLoading(false)
      return
    }

    const list = (data as ProviderRow[]) ?? []

    setRows(list)
    setDraft(Object.fromEntries(list.map((row) => [row.provider, row.api_key ?? ''])))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const write = async (
    provider: string,
    patch: Record<string, unknown>,
    message: string
  ) => {
    setBusy(true)
    setError('')
    setNotice('')

    const { error: writeError } = await supabase
      .from('audio_providers')
      .update(patch)
      .eq('provider', provider)

    if (writeError) setError(writeError.message)
    else {
      setNotice(message)
      await load()
    }

    setBusy(false)
  }

  const toggleReveal = (provider: string) =>
    setRevealed((current) => {
      const next = new Set(current)
      next.has(provider) ? next.delete(provider) : next.add(provider)
      return next
    })

  if (missing) {
    return (
      <div className="mt-8">
        <SectionHeading
          title="Music search"
          hint="Where the Comic-to-Video music picker searches for copyright-free tracks."
        />
        <Banner tone="error">
          Run migrations 020 and 021 in Supabase to manage music providers here.
        </Banner>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <SectionHeading
        title="Music search"
        hint="Where the Comic-to-Video music picker looks for copyright-free tracks."
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-400">Loading…</p>}

        {rows.map((row) => {
          const dirty = (draft[row.provider] ?? '') !== (row.api_key ?? '')
          // A provider that wants a key and has none cannot be searched, however
          // its enabled flag reads. Said plainly rather than shown as "on".
          const inactive = row.needs_key && !row.api_key

          return (
            <div
              key={row.provider}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 dark:text-white">{row.label}</p>

                    {!row.needs_key && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">
                        No key needed
                      </span>
                    )}

                    {inactive && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase">
                        Needs a key
                      </span>
                    )}
                  </div>

                  {row.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{row.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {row.setup_url && (
                    <a
                      href={row.setup_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                    >
                      Get a key
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      write(
                        row.provider,
                        { enabled: !row.enabled },
                        `${row.label} ${row.enabled ? 'disabled' : 'enabled'}.`
                      )
                    }
                  >
                    <Power
                      className={`w-3.5 h-3.5 mr-1.5 ${row.enabled ? 'text-emerald-600' : 'text-slate-400'}`}
                    />
                    {row.enabled ? 'On' : 'Off'}
                  </Button>
                </div>
              </div>

              {row.needs_key && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[220px]">
                    <Field label="API key">
                      <div className="relative">
                        <input
                          type={revealed.has(row.provider) ? 'text' : 'password'}
                          value={draft[row.provider] ?? ''}
                          onChange={(event) =>
                            setDraft({ ...draft, [row.provider]: event.target.value })
                          }
                          placeholder={row.api_key ? maskKey(row.api_key) : 'Paste the key'}
                          className={`${inputClass} font-mono pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => toggleReveal(row.provider)}
                          aria-label={revealed.has(row.provider) ? 'Hide key' : 'Show key'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                        >
                          {revealed.has(row.provider) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </Field>
                  </div>

                  <Button
                    disabled={busy || !dirty}
                    onClick={() =>
                      write(
                        row.provider,
                        // Blank clears the key rather than storing an empty
                        // string, so "needs a key" shows again afterwards.
                        { api_key: draft[row.provider]?.trim() || null },
                        `${row.label} key saved.`
                      )
                    }
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    Save
                  </Button>
                </div>
              )}

              <p className="mt-2 text-[11px] text-slate-400">{row.attribution}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
