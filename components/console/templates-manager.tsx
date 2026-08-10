'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save, RefreshCw, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { renderTemplate, extractPlaceholders, htmlToText } from '@/lib/services/templates'
import { PageHeader } from '@/components/console/console-ui'
import { Banner, Field, inputClass } from '@/components/console/providers-manager'

/**
 * Email template editor with live preview.
 *
 * The preview uses the same renderTemplate() the sender will use, including
 * its HTML escaping — so what is previewed is what recipients get, and an
 * injection attempt through a placeholder is visible here rather than in
 * somebody's inbox.
 */

interface TemplateRow {
  id: string
  key: string
  name: string
  subject: string
  body_html: string
  placeholders: string[]
  enabled: boolean
}

// Stand-in values for the preview, deliberately including a hostile one.
const SAMPLE: Record<string, string> = {
  first_name: 'Alex',
  last_name: 'Kim',
  brand_name: 'ComicAgent AI',
  login_url: 'https://app.example.com/login',
  reset_url: 'https://app.example.com/reset?token=abc123',
  support_email: 'support@example.com',
  email: 'alex@example.com',
}

export function TemplatesManager() {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('email_templates')
      .select('id, key, name, subject, body_html, placeholders, enabled')
      .order('key')

    if (queryError) setError(queryError.message)

    const list = (data as TemplateRow[]) ?? []

    setRows(list)
    setLoading(false)

    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].id)
      setSubject(list[0].subject)
      setBodyHtml(list[0].body_html)
    }
  }, [selectedId])

  useEffect(() => {
    load()
  }, [load])

  const selected = rows.find((row) => row.id === selectedId) ?? null

  const select = (row: TemplateRow) => {
    setSelectedId(row.id)
    setSubject(row.subject)
    setBodyHtml(row.body_html)
    setNotice('')
    setError('')
  }

  const dirty = Boolean(
    selected && (selected.subject !== subject || selected.body_html !== bodyHtml)
  )

  const preview = useMemo(
    () => ({
      subject: renderTemplate(subject, SAMPLE, { escape: false }),
      body: renderTemplate(bodyHtml, SAMPLE),
    }),
    [subject, bodyHtml]
  )

  const used = useMemo(
    () => extractPlaceholders(`${subject} ${bodyHtml}`),
    [subject, bodyHtml]
  )

  const save = async () => {
    if (!selected) return

    setBusy(true)
    setError('')
    setNotice('')

    const { error: writeError } = await supabase
      .from('email_templates')
      .update({
        subject,
        body_html: bodyHtml,
        body_text: htmlToText(bodyHtml),
        placeholders: used,
      })
      .eq('id', selected.id)

    if (writeError) setError(writeError.message)
    else {
      setNotice(`${selected.name} saved.`)
      await load()
    }

    setBusy(false)
  }

  return (
    <>
      <PageHeader
        title="Email Templates"
        subtitle="Edit the transactional emails. The preview renders exactly as the sender will."
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </Button>
            <Button
              onClick={save}
              disabled={busy || !dirty}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          </>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        {/* Template list */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-2 h-fit">
          {loading && <p className="p-3 text-sm text-slate-400">Loading…</p>}

          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => select(row)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                row.id === selectedId
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {row.name}
              <span
                className={`block text-[11px] font-mono ${
                  row.id === selectedId ? 'text-indigo-100' : 'text-slate-400'
                }`}
              >
                {row.key}
              </span>
            </button>
          ))}

          {!loading && rows.length === 0 && (
            <p className="p-3 text-sm text-slate-400">No templates found.</p>
          )}
        </div>

        {/* Editor + preview */}
        {selected ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-5 space-y-4">
              <Field label="Subject">
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Body (HTML)">
                <textarea
                  value={bodyHtml}
                  onChange={(event) => setBodyHtml(event.target.value)}
                  rows={10}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                />
              </Field>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Placeholders in use
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {used.length === 0 && <span className="text-xs text-slate-400">None</span>}

                  {used.map((placeholder) => (
                    <button
                      key={placeholder}
                      onClick={() => setBodyHtml((current) => `${current}{{${placeholder}}}`)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                        SAMPLE[placeholder]
                          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      }`}
                      title={
                        SAMPLE[placeholder]
                          ? `Sample: ${SAMPLE[placeholder]}`
                          : 'No sample value — will render empty'
                      }
                    >
                      {placeholder}
                    </button>
                  ))}
                </div>

                {preview.body.missing.length > 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    No sample value for: {preview.body.missing.join(', ')} — these render empty.
                  </p>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-400" />
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Preview
                </h2>
              </div>

              <div className="p-5">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Subject
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {preview.subject.output}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
                    // Rendered through renderTemplate, which escapes every
                    // substituted value; only the author's own markup survives.
                    dangerouslySetInnerHTML={{ __html: preview.body.output }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-10 text-center text-sm text-slate-500">
              Select a template to edit.
            </div>
          )
        )}
      </div>
    </>
  )
}
