'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Download,
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Link2,
  Copy,
  Trash2,
  Send,
  Ban,
  CalendarClock,
  Plus,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/db'
import { AgentHeader, Card, Field, inputClass } from '@/components/agent-ui'
import { TRIM_SIZES } from '@/lib/activities/paper'
import { PAPER_STOCKS, describeCover, boundPageCount, type PaperStock } from '@/lib/print/kdp'
import { renderCover } from '@/lib/print/cover-render'
import { DELIVERY_PRESETS, describeTerms } from '@/lib/delivery/links'
import { composeCaption, captionProblems, roundToSlot } from '@/lib/social/calendar'

/**
 * Everything between a finished book and a listed one.
 *
 * Three jobs that share nothing technically but are the same job to the
 * customer: make a file a printer will accept, get the file to a buyer, and
 * tell people it exists.
 */

type Tab = 'cover' | 'deliver' | 'calendar'

export function PublishStudio() {
  const [tab, setTab] = useState<Tab>('cover')

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<BookOpen className="w-5 h-5 text-white" />}
        gradient="from-amber-500 to-orange-600"
        title="Publish"
        subtitle="Print-ready covers, delivery links for buyers, and a posting schedule"
      />

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { key: 'cover', label: 'Print cover', icon: BookOpen },
            { key: 'deliver', label: 'Delivery links', icon: Link2 },
            { key: 'calendar', label: 'Post schedule', icon: CalendarClock },
          ] as const
        ).map((entry) => {
          const Icon = entry.icon
          const active = entry.key === tab

          return (
            <button
              key={entry.key}
              onClick={() => setTab(entry.key)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                active
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
                  : 'ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {entry.label}
            </button>
          )
        })}
      </div>

      {tab === 'cover' && <CoverTab />}
      {tab === 'deliver' && <DeliverTab />}
      {tab === 'calendar' && <CalendarTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Print cover
// ---------------------------------------------------------------------------

function CoverTab() {
  const [trimKey, setTrimKey] = useState('6x9')
  const [pageCount, setPageCount] = useState(120)
  const [stock, setStock] = useState<PaperStock>('white')

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [author, setAuthor] = useState('')
  const [blurb, setBlurb] = useState('')
  const [artwork, setArtwork] = useState('')
  const [background, setBackground] = useState('#1e293b')

  const [showGuides, setShowGuides] = useState(true)
  const [preview, setPreview] = useState('')
  const [printFile, setPrintFile] = useState('')
  const [info, setInfo] = useState<Awaited<ReturnType<typeof renderCover>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const artRef = useRef<HTMLInputElement>(null)
  const trim = TRIM_SIZES.find((entry) => entry.key === trimKey) ?? TRIM_SIZES[0]

  const draw = useCallback(async () => {
    setBusy(true)
    setError('')

    try {
      const spec = {
        trimWidth: trim.width,
        trimHeight: trim.height,
        pageCount,
        stock,
        art: {
          front: artwork || undefined,
          title: title || 'Your title',
          subtitle,
          author,
          blurb,
          background,
        },
      }

      // Both, together: the proof is what the customer judges, the print file
      // is what they upload, and they must come from the same layout or the
      // guides would be reassuring about a different file.
      const [proof, clean] = await Promise.all([
        renderCover({ ...spec, showGuides }),
        renderCover({ ...spec, showGuides: false }),
      ])

      setPreview(proof.dataUrl)
      setPrintFile(clean.dataUrl)
      setInfo(proof)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draw the cover')
    } finally {
      setBusy(false)
    }
  }, [trim, pageCount, stock, artwork, title, subtitle, author, blurb, background, showGuides])

  useEffect(() => {
    draw()
  }, [draw])

  const upload = (file: File) => {
    const reader = new FileReader()

    reader.onloadend = () => setArtwork(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="grid lg:grid-cols-[21rem_1fr] gap-5 items-start">
      <Card>
        <div className="space-y-4">
          <Field label="Book size">
            <select
              value={trimKey}
              onChange={(event) => setTrimKey(event.target.value)}
              className={inputClass}
            >
              {TRIM_SIZES.map((size) => (
                <option key={size.key} value={size.key}>
                  {size.label} — {size.note}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Pages"
            hint={`Printed as ${boundPageCount(pageCount)} — printers bind in even numbers.`}
          >
            <input
              type="number"
              min={24}
              max={828}
              value={pageCount}
              onChange={(event) => setPageCount(Number(event.target.value) || 24)}
              className={inputClass}
            />
          </Field>

          <Field label="Paper" hint="Changes the spine width — cream is thicker than white.">
            <select
              value={stock}
              onChange={(event) => setStock(event.target.value as PaperStock)}
              className={inputClass}
            >
              {PAPER_STOCKS.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Title *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Subtitle">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Author">
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Back cover blurb" hint="Stops automatically above the barcode area.">
            <textarea
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              className={`${inputClass} h-24 resize-none py-2.5`}
            />
          </Field>

          <Field label="Background">
            <input
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="w-full h-10 rounded-xl ring-1 ring-slate-200 cursor-pointer"
            />
          </Field>

          <button
            onClick={() => artRef.current?.click()}
            className="w-full h-10 rounded-xl ring-1 ring-slate-200 text-xs font-semibold text-slate-600 inline-flex items-center justify-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            {artwork ? 'Change artwork' : 'Upload cover artwork'}
          </button>

          <input
            ref={artRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]

              if (file) upload(file)
              event.target.value = ''
            }}
          />

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(event) => setShowGuides(event.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            Show trim and safe-area guides
          </label>
        </div>
      </Card>

      <div className="space-y-3">
        {error && (
          <p className="p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-sm text-red-600">
            {error}
          </p>
        )}

        {info && (
          <>
            {/* The numbers a printer checks, stated before upload. */}
            <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-3.5">
              <p className="text-sm font-semibold text-slate-900">
                {describeCover(info.layout, {
                  trimWidth: trim.width,
                  trimHeight: trim.height,
                  pageCount,
                  stock,
                })}
              </p>

              {info.resolution && !info.resolution.ok && (
                <p className="mt-2 text-xs text-amber-700 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  {info.resolution.message}
                </p>
              )}

              {info.resolution?.ok && (
                <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Artwork is {info.resolution.dpi} DPI — good for print
                </p>
              )}

              {info.layout.warnings.map((warning) => (
                <p
                  key={warning}
                  className="mt-2 text-xs text-amber-700 flex items-start gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  {warning}
                </p>
              ))}
            </div>

            {preview && (
              <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Cover proof" className="w-full rounded-lg" />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const link = document.createElement('a')

                      link.href = printFile
                      link.download = `${(title || 'cover').replace(/[^\w-]+/g, '-').toLowerCase()}-print.png`
                      link.click()
                    }}
                    disabled={busy}
                    className="h-9 px-3 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Download print file
                  </button>

                  <p className="text-[11px] text-slate-400 self-center">
                    Guides are never in the downloaded file.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Delivery links
// ---------------------------------------------------------------------------

interface Delivery {
  id: string
  token: string
  title: string
  filename: string
  expires_at: string | null
  max_downloads: number | null
  downloads: number
  sent_to: string | null
  revoked: boolean
  created_at: string
}

function DeliverTab() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState('')

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [presetKey, setPresetKey] = useState('single')
  const [file, setFile] = useState<{ path: string; name: string; size: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/deliveries', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (response.ok) setDeliveries(payload.deliveries ?? [])
      else setError(payload?.error ?? 'Could not load your links')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const upload = async (chosen: File) => {
    setUploading(true)
    setError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Your session expired. Sign in again.')
        return
      }

      const path = `${user.id}/${Date.now()}-${chosen.name.replace(/[^\w.-]+/g, '-')}`

      const { error: uploadError } = await supabase.storage
        .from('deliveries')
        .upload(path, chosen, { contentType: chosen.type || 'application/octet-stream' })

      if (uploadError) {
        setError(uploadError.message)
        return
      }

      setFile({ path, name: chosen.name, size: chosen.size })
      if (!title) setTitle(chosen.name.replace(/\.[^.]+$/, ''))
    } finally {
      setUploading(false)
    }
  }

  const create = async () => {
    if (!file) return

    setBusy('create')
    setError('')

    const response = await fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        bucket: 'deliveries',
        path: file.path,
        filename: file.name,
        sizeBytes: file.size,
        title,
        message,
        preset: presetKey,
      }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) setError(payload?.error ?? 'Could not create that link')
    else {
      setNotice('Link created.')
      setFile(null)
      setTitle('')
      setMessage('')
      await load()
    }

    setBusy('')
  }

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(id)
    setError('')

    const response = await fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id, ...extra }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) setError(payload?.error ?? 'That did not work')
    else {
      setNotice(action === 'send' ? 'Email sent.' : 'Done.')
      await load()
    }

    setBusy('')
  }

  return (
    <div className="grid lg:grid-cols-[21rem_1fr] gap-5 items-start">
      <Card>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">New delivery link</p>
            <p className="text-xs text-slate-500 mt-0.5">
              A link that expires and stops after a set number of downloads, so a
              link posted publicly does not become free distribution.
            </p>
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full h-10 rounded-xl ring-1 ring-slate-200 text-xs font-semibold text-slate-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {file ? file.name : 'Choose the file to deliver'}
          </button>

          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(event) => {
              const chosen = event.target.files?.[0]

              if (chosen) upload(chosen)
              event.target.value = ''
            }}
          />

          <Field label="What it is">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Your comic book"
              className={inputClass}
            />
          </Field>

          <Field label="Note to the buyer">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Thanks for your order — here is your download."
              className={`${inputClass} h-20 resize-none py-2.5`}
            />
          </Field>

          <Field label="Terms">
            <select
              value={presetKey}
              onChange={(event) => setPresetKey(event.target.value)}
              className={inputClass}
            >
              {DELIVERY_PRESETS.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>

          <p className="text-[11px] text-slate-400 -mt-2">
            {DELIVERY_PRESETS.find((entry) => entry.key === presetKey)?.hint}
          </p>

          <button
            onClick={create}
            disabled={!file || busy === 'create'}
            className="w-full h-10 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy === 'create' ? 'Creating…' : 'Create link'}
          </button>
        </div>
      </Card>

      <div className="space-y-3">
        {error && (
          <p className="p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-sm text-red-600">{error}</p>
        )}
        {notice && (
          <p className="p-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        {loading && <p className="text-sm text-slate-400">Loading…</p>}

        {!loading && deliveries.length === 0 && (
          <div className="rounded-2xl ring-1 ring-slate-200 bg-white py-12 text-center">
            <Link2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-900">No delivery links yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Upload a file and create one to send a buyer their download.
            </p>
          </div>
        )}

        {deliveries.map((delivery) => {
          const url = `${window.location.origin}/d/${delivery.token}`
          const dead =
            delivery.revoked ||
            (delivery.expires_at ? new Date(delivery.expires_at) <= new Date() : false) ||
            (delivery.max_downloads !== null && delivery.downloads >= delivery.max_downloads)

          return (
            <div
              key={delivery.id}
              className={`rounded-2xl ring-1 bg-white p-4 ${dead ? 'ring-slate-200 opacity-70' : 'ring-slate-200'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {delivery.title || delivery.filename}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {describeTerms({
                      expiresAt: delivery.expires_at,
                      maxDownloads: delivery.max_downloads,
                    })}{' '}
                    · {delivery.downloads} used
                    {delivery.sent_to && ` · sent to ${delivery.sent_to}`}
                  </p>
                  {dead && (
                    <p className="text-[11px] font-semibold text-amber-600 mt-1">
                      No longer works
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(url)
                      setCopied(delivery.id)
                      setTimeout(() => setCopied(''), 1500)
                    }}
                    title="Copy the link"
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    {copied === delivery.id ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      const to = window.prompt('Email this link to:')

                      if (to) act(delivery.id, 'send', { to })
                    }}
                    title="Email it to the buyer"
                    disabled={busy === delivery.id}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => act(delivery.id, delivery.revoked ? 'restore' : 'revoke')}
                    title={delivery.revoked ? 'Turn back on' : 'Turn off'}
                    disabled={busy === delivery.id}
                    className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-40"
                  >
                    <Ban className="w-4 h-4" />
                  </button>

                  <button
                    onClick={async () => {
                      if (!window.confirm('Delete this link? The file stays in your storage.')) return

                      await fetch(`/api/deliveries?id=${delivery.id}`, { method: 'DELETE' })
                      await load()
                    }}
                    title="Delete"
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="mt-2 text-[11px] font-mono text-slate-400 break-all">{url}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Post schedule
// ---------------------------------------------------------------------------

interface Post {
  id: string
  caption: string
  hashtags: string[]
  image_url: string | null
  connection_ids: string[]
  scheduled_for: string
  status: string
  error: string | null
}

function CalendarTab() {
  const [posts, setPosts] = useState<Post[]>([])
  const [connections, setConnections] = useState<
    { id: string; platform: string; account_name: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composing, setComposing] = useState(false)

  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('')
  const [when, setWhen] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/calendar', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (response.ok) {
        setPosts(payload.posts ?? [])
        setConnections(payload.connections ?? [])
      } else setError(payload?.error ?? 'Could not load your schedule')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hashtags = useMemo(
    () => tags.split(/[\s,]+/).map((tag) => tag.replace(/^#/, '')).filter(Boolean),
    [tags]
  )

  const platforms = connections
    .filter((entry) => chosen.includes(entry.id))
    .map((entry) => entry.platform)

  const problems = captionProblems(composeCaption(caption, hashtags), platforms)

  const create = async () => {
    setBusy(true)
    setError('')

    const response = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        caption,
        hashtags,
        connectionIds: chosen,
        scheduledFor: new Date(when).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) setError(payload?.error ?? 'Could not schedule that')
    else {
      setComposing(false)
      setCaption('')
      setTags('')
      setChosen([])
      await load()
    }

    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${posts.length} post${posts.length === 1 ? '' : 's'} scheduled`}
        </p>

        <button
          onClick={() => {
            // Default to the next slot an hour out, which is what people
            // actually want when they open this.
            const soon = roundToSlot(new Date(Date.now() + 60 * 60 * 1000))
            const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000)

            setWhen(local.toISOString().slice(0, 16))
            setComposing(true)
          }}
          className="h-9 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule a post
        </button>
      </div>

      {error && (
        <p className="p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-sm text-red-600">{error}</p>
      )}

      {connections.length === 0 && !loading && (
        <div className="rounded-2xl ring-1 ring-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            No accounts connected yet. Connect one under{' '}
            <a href="/connections" className="font-semibold underline">
              Connections
            </a>{' '}
            before scheduling.
          </p>
        </div>
      )}

      {!loading && posts.length === 0 && connections.length > 0 && (
        <div className="rounded-2xl ring-1 ring-slate-200 bg-white py-12 text-center">
          <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-900">Nothing scheduled</p>
          <p className="text-sm text-slate-500 mt-1">
            Queue a post and it goes out on its own, even if you are not here.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {posts.map((post) => (
          <div key={post.id} className="rounded-2xl ring-1 ring-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">
                  {new Date(post.scheduled_for).toLocaleString()}
                  <span
                    className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                      post.status === 'posted'
                        ? 'bg-emerald-100 text-emerald-700'
                        : post.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : post.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {post.status}
                  </span>
                </p>

                <p className="text-sm text-slate-800 mt-1 line-clamp-2 whitespace-pre-line">
                  {post.caption}
                </p>

                {post.error && (
                  <p className="text-[11px] text-red-600 mt-1">{post.error}</p>
                )}
              </div>

              {post.status !== 'posted' && (
                <button
                  onClick={async () => {
                    await fetch('/api/calendar', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'cancel', id: post.id }),
                    })
                    await load()
                  }}
                  className="shrink-0 h-8 px-2.5 rounded-lg ring-1 ring-slate-200 text-[11px] font-semibold text-slate-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {composing && (
        <div className="fixed inset-0 z-[2000] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg my-4 bg-white rounded-2xl ring-1 ring-slate-200 shadow-2xl">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
              <h2 className="font-display text-base font-bold text-slate-900">Schedule a post</h2>
              <button
                onClick={() => setComposing(false)}
                className="w-8 h-8 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="Caption">
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  className={`${inputClass} h-28 resize-none py-2.5`}
                />
              </Field>

              <Field label="Hashtags" hint="Space or comma separated. The # is optional.">
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="comics kidlit newrelease"
                  className={inputClass}
                />
              </Field>

              <Field label="When">
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(event) => setWhen(event.target.value)}
                  className={inputClass}
                />
              </Field>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Post to
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {connections.map((entry) => {
                    const active = chosen.includes(entry.id)

                    return (
                      <button
                        key={entry.id}
                        onClick={() =>
                          setChosen((current) =>
                            active
                              ? current.filter((id) => id !== entry.id)
                              : [...current, entry.id]
                          )
                        }
                        className={`h-8 px-2.5 rounded-lg text-[11px] font-semibold ring-1 ${
                          active
                            ? 'bg-amber-50 ring-amber-400 text-amber-800'
                            : 'ring-slate-200 text-slate-600'
                        }`}
                      >
                        {entry.account_name || entry.platform}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Found while they are looking at it, not at 9am on Friday in
                  a failure log. */}
              {problems.length > 0 && (
                <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-2.5 space-y-1">
                  {problems.map((problem) => (
                    <p key={problem.platform} className="text-[11px] text-amber-800">
                      <span className="font-semibold capitalize">{problem.platform}</span> allows{' '}
                      {problem.limit} characters — this is {problem.over} over.
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 pt-0 flex justify-end gap-2">
              <button
                onClick={() => setComposing(false)}
                className="h-10 px-4 rounded-xl ring-1 ring-slate-200 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={busy || chosen.length === 0 || !when || !caption.trim()}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
