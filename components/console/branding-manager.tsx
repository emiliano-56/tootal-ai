'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Save, RefreshCw, Info, Upload, X, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { PageHeader } from '@/components/console/console-ui'
import { Banner, Field, inputClass, SectionHeading } from '@/components/console/providers-manager'

/**
 * Upload widget for a logo or favicon.
 *
 * Uploads go through /api/console/branding, which checks the file's real
 * signature and writes the tenant row — the browser never touches storage
 * directly, so a tenant cannot write into another's folder.
 */
function ImageUpload({
  kind,
  label,
  hint,
  value,
  tenantId,
  previewClass,
  onChange,
  onError,
}: {
  kind: 'logo' | 'favicon'
  label: string
  hint: string
  value: string | null
  tenantId: string
  previewClass: string
  onChange: (url: string | null) => void
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    setUploading(true)
    onError('')

    try {
      const form = new FormData()
      form.append('kind', kind)
      form.append('tenantId', tenantId)
      form.append('file', file)

      const response = await fetch('/api/console/branding', { method: 'POST', body: form })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) onError(payload.error ?? 'Upload failed')
      else onChange(payload.url)
    } catch {
      onError('Upload failed — check your connection.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async () => {
    setUploading(true)
    onError('')

    const response = await fetch(
      `/api/console/branding?kind=${kind}&tenantId=${encodeURIComponent(tenantId)}`,
      { method: 'DELETE' }
    )

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      onError(payload.error ?? 'Could not remove it')
    } else {
      onChange(null)
    }

    setUploading(false)
  }

  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/x-icon,.ico"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) upload(file)
        }}
      />

      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
        {value ? (
          <img
            src={value}
            alt=""
            className={`${previewClass} object-contain bg-white ring-1 ring-slate-200 shrink-0`}
          />
        ) : (
          <div
            className={`${previewClass} bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0`}
          >
            <ImageIcon className="w-4 h-4 text-slate-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="h-8 text-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            </Button>

            {value && (
              <Button
                variant="outline"
                onClick={remove}
                disabled={uploading}
                className="h-8 text-xs text-red-600"
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Remove
              </Button>
            )}
          </div>

          <p className="mt-1.5 text-[11px] text-slate-400 leading-4">{hint}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * White-label branding.
 *
 * Backed by the tenant row. A database check constraint restricts branding to
 * white-label tenants, so a reseller saving here is rejected by Postgres — the
 * product rule that resellers sell under ComicAgent AI branding is enforced
 * below the UI, not just by hiding the menu item.
 */

interface BrandRow {
  id: string
  type: string
  name: string
  brand_name: string | null
  logo_url: string | null
  favicon_url: string | null
  primary_color: string | null
  accent_color: string | null
  support_email: string | null
  footer_text: string | null
  custom_css: string | null
  custom_js: string | null
}

// logo_url and favicon_url are written by the upload endpoint, not this form.
const EDITABLE = [
  'brand_name',
  'primary_color',
  'accent_color',
  'support_email',
  'footer_text',
  'custom_css',
  'custom_js',
] as const

export function BrandingManager({ tenantId }: { tenantId: string }) {
  const [row, setRow] = useState<BrandRow | null>(null)
  const [draft, setDraft] = useState<Partial<BrandRow>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle()

    if (queryError) setError(queryError.message)

    setRow((data as BrandRow) ?? null)
    setDraft((data as BrandRow) ?? {})
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    load()
  }, [load])

  const dirty = row
    ? EDITABLE.some((field) => (draft[field] ?? '') !== (row[field] ?? ''))
    : false

  const save = async () => {
    setBusy(true)
    setError('')
    setNotice('')

    const payload = Object.fromEntries(
      EDITABLE.map((field) => [field, (draft[field] as string) || null])
    )

    const { error: writeError } = await supabase
      .from('tenants')
      .update(payload)
      .eq('id', tenantId)

    if (writeError) {
      setError(
        writeError.message.includes('tenants_branding_not_reseller')
          ? 'Resellers cannot rebrand — they sell under ComicAgent AI branding.'
          : writeError.message
      )
    } else {
      setNotice('Branding saved.')
      await load()
    }

    setBusy(false)
  }

  const set = (field: keyof BrandRow, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }))

  const isWhiteLabel = row?.type === 'white_label'

  return (
    <>
      <PageHeader
        title="Brand"
        subtitle="How your platform looks to your customers."
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

      {!loading && !isWhiteLabel && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-slate-700">
          <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-6">
            This account is a <strong>{row?.type ?? 'platform'}</strong> tenant. Branding fields
            are stored only for white-label accounts — the database rejects them otherwise.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-5 space-y-4">
            <SectionHeading title="Identity" />

            <Field label="Product name" hint="Replaces “ComicAgent AI” across the members area">
              <input
                value={draft.brand_name ?? ''}
                onChange={(e) => set('brand_name', e.target.value)}
                className={inputClass}
                placeholder={row?.name ?? 'Your product name'}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <ImageUpload
                kind="logo"
                label="Logo"
                hint="PNG or WebP, up to 2 MB. Shown in the sidebar and on sign-in."
                value={draft.logo_url ?? null}
                tenantId={tenantId}
                previewClass="w-16 h-16 rounded-xl"
                onChange={(url) => {
                  set('logo_url', url ?? '')
                  load()
                }}
                onError={setError}
              />

              <ImageUpload
                kind="favicon"
                label="Favicon"
                hint="PNG or ICO, up to 512 KB. Shown in the browser tab."
                value={draft.favicon_url ?? null}
                tenantId={tenantId}
                previewClass="w-8 h-8 rounded"
                onChange={(url) => {
                  set('favicon_url', url ?? '')
                  load()
                }}
                onError={setError}
              />
            </div>

            <Field label="Support email" hint="Shown to your customers instead of ours">
              <input
                type="email"
                value={draft.support_email ?? ''}
                onChange={(e) => set('support_email', e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Footer text">
              <input
                value={draft.footer_text ?? ''}
                onChange={(e) => set('footer_text', e.target.value)}
                className={inputClass}
                placeholder="© Your Company"
              />
            </Field>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-5 space-y-4">
            <SectionHeading title="Colours" />

            <div className="grid sm:grid-cols-2 gap-3">
              {(['primary_color', 'accent_color'] as const).map((field) => (
                <Field key={field} label={field === 'primary_color' ? 'Primary' : 'Accent'}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draft[field] || '#4f46e5'}
                      onChange={(e) => set(field, e.target.value)}
                      className="w-11 h-11 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 cursor-pointer bg-transparent"
                    />
                    <input
                      value={draft[field] ?? ''}
                      onChange={(e) => set(field, e.target.value)}
                      className={`${inputClass} font-mono text-xs`}
                      placeholder="#4f46e5"
                    />
                  </div>
                </Field>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-5 space-y-4">
            <SectionHeading
              title="Custom code"
              hint="Injected into your members area. Only add code you trust — it runs for every one of your users."
            />

            <Field label="Custom CSS">
              <textarea
                value={draft.custom_css ?? ''}
                onChange={(e) => set('custom_css', e.target.value)}
                rows={5}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
            </Field>

            <Field label="Custom JavaScript">
              <textarea
                value={draft.custom_js ?? ''}
                onChange={(e) => set('custom_js', e.target.value)}
                rows={5}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
            </Field>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-20 h-fit">
          <SectionHeading title="Preview" />

          <div className="rounded-2xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
            <div
              className="h-16 flex items-center gap-3 px-4"
              style={{
                background: `linear-gradient(90deg, ${draft.primary_color || '#4f46e5'}, ${draft.accent_color || '#7c3aed'})`,
              }}
            >
              {draft.logo_url ? (
                <img
                  src={draft.logo_url}
                  alt=""
                  className="w-9 h-9 rounded-lg object-cover bg-white/20"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-white/25" />
              )}
              <span className="font-display font-bold text-white truncate">
                {draft.brand_name || row?.name || 'Your brand'}
              </span>
            </div>

            <div className="p-4 space-y-3">
              <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
              <button
                className="mt-2 w-full h-9 rounded-lg text-white text-sm font-semibold"
                style={{ backgroundColor: draft.primary_color || '#4f46e5' }}
              >
                Primary action
              </button>
            </div>

            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              {draft.footer_text || '© Your Company'}
              {draft.support_email && <> · {draft.support_email}</>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
