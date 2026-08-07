'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { PageHeader } from '@/components/console/console-ui'
import { Banner, Field, inputClass, SectionHeading } from '@/components/console/providers-manager'

/**
 * Platform settings.
 *
 * Rows are key/value, so a new setting appears here as soon as it is inserted
 * — no code change per toggle. Writes go through the RLS-scoped client; the
 * `platform_settings_write` policy already limits them to a superadmin.
 */

interface SettingRow {
  key: string
  value: unknown
  label: string
  description: string | null
  category: string
  input_type: string
  options: string[] | null
}

const CATEGORY_LABEL: Record<string, string> = {
  general: 'General',
  access: 'Access & availability',
  ai: 'AI providers',
}

export function SettingsManager() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('platform_settings')
      .select('key, value, label, description, category, input_type, options')
      .order('category')
      .order('key')

    if (queryError) {
      // The table only exists after migration 006.
      setMissing(true)
      setError(queryError.message)
      setLoading(false)
      return
    }

    const list = (data as SettingRow[]) ?? []

    setRows(list)
    setDraft(Object.fromEntries(list.map((row) => [row.key, row.value])))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const changed = rows.filter(
    (row) => JSON.stringify(draft[row.key]) !== JSON.stringify(row.value)
  )

  const save = async () => {
    setBusy(true)
    setError('')
    setNotice('')

    for (const row of changed) {
      const { error: writeError } = await supabase
        .from('platform_settings')
        .update({ value: draft[row.key] })
        .eq('key', row.key)

      if (writeError) {
        setError(`${row.label}: ${writeError.message}`)
        setBusy(false)
        return
      }
    }

    setNotice(`${changed.length} setting${changed.length === 1 ? '' : 's'} saved.`)
    await load()
    setBusy(false)
  }

  if (missing) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-300">
                Settings table not created yet
              </p>
              <p className="mt-1 text-amber-800/80 dark:text-amber-400/80 leading-6">
                Run <code className="font-mono text-xs">006_platform_settings.sql</code> in the
                Supabase SQL editor, then reload this page.
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  const categories = [...new Set(rows.map((row) => row.category))]

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Platform-wide defaults and feature toggles."
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </Button>
            <Button
              onClick={save}
              disabled={busy || changed.length === 0}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {busy
                ? 'Saving…'
                : changed.length > 0
                  ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}`
                  : 'Saved'}
            </Button>
          </>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      )}

      <div className="space-y-8">
        {categories.map((category) => (
          <div key={category}>
            <SectionHeading title={CATEGORY_LABEL[category] ?? category} />

            <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {rows
                .filter((row) => row.category === category)
                .map((row) => {
                  const isDirty = JSON.stringify(draft[row.key]) !== JSON.stringify(row.value)

                  return (
                    <div
                      key={row.key}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          {row.label}
                          {isDirty && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved" />
                          )}
                        </p>
                        {row.description && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-5">
                            {row.description}
                          </p>
                        )}
                      </div>

                      <div className="w-full sm:w-56 shrink-0">
                        <SettingInput
                          row={row}
                          value={draft[row.key]}
                          onChange={(next) => setDraft((d) => ({ ...d, [row.key]: next }))}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * Toggle switch.
 *
 * The knob is positioned from `left-1` and moved by exactly the travel
 * distance (track 48 − padding 8 − knob 20 = 20px). Leaving `left` unset makes
 * the knob start from wherever the button happens to centre its content, which
 * is what made the off state look half-on and the on state overflow the track.
 */
export function Toggle({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean
  label: string
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SettingInput({
  row,
  value,
  onChange,
}: {
  row: SettingRow
  value: unknown
  onChange: (next: unknown) => void
}) {
  if (row.input_type === 'boolean') {
    return (
      <Toggle
        checked={value === true}
        label={row.label}
        onChange={(next) => onChange(next)}
      />
    )
  }

  if (row.input_type === 'number') {
    return (
      <input
        type="number"
        value={typeof value === 'number' ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
    )
  }

  if (row.input_type === 'select' && row.options) {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {row.options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  )
}

export { Field }
