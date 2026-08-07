'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Lock,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react'
import {
  groupByKind,
  toolLinkFor,
  downloadName,
  kindInfo,
  marketplaceLabel,
  MARKETPLACES,
  type DfyAsset,
  type DfyNiche,
} from '@/lib/dfy/assets'

/**
 * The Done For You library.
 *
 * Two views in one component: the ten packs, and the inside of one pack. They
 * share the fetch, the locked state and the styling, and splitting them would
 * mean maintaining that twice for the sake of a route.
 *
 * The point of the screen is that nothing here is a preview — every asset is
 * finished, copyable and downloadable, and the ones that need artwork carry the
 * prompt straight into the tool that makes it.
 */

interface NicheSummary extends DfyNiche {
  assetCount: number
  kinds: string[]
  marketplaces: string[]
}

export function DfyLibrary() {
  const [niches, setNiches] = useState<NicheSummary[]>([])
  const [open, setOpen] = useState<{ niche: DfyNiche; assets: DfyAsset[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const response = await fetch('/api/dfy')
      const payload = await response.json().catch(() => ({}))

      if (cancelled) return

      if (response.status === 403) setLocked(true)
      else if (!response.ok) setError(payload.error ?? 'Could not load the library')
      else setNiches(payload.niches ?? [])

      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const openNiche = useCallback(async (slug: string) => {
    setLoading(true)

    const response = await fetch(`/api/dfy?niche=${encodeURIComponent(slug)}`)
    const payload = await response.json().catch(() => ({}))

    if (response.ok) setOpen({ niche: payload.niche, assets: payload.assets ?? [] })
    else setError(payload.error ?? 'Could not open that pack')

    setLoading(false)
    window.scrollTo({ top: 0 })
  }, [])

  if (locked) return <LockedNotice />

  if (loading && niches.length === 0) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-56 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (open) {
    return <PackDetail pack={open} onBack={() => setOpen(null)} />
  }

  return (
    <div>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 text-xs font-bold mb-3">
          <Package className="w-3.5 h-3.5" />
          OTO 2 — DONE FOR YOU
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Ten kids content businesses, ready to sell
        </h1>

        <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-2xl">
          Each pack is a complete business: the website, the storybooks, the video scripts, the
          rhymes, the printables, an AI tutor, blog content and the marketplace listings that sell
          them. Commercial rights included — publish them under your own name.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 ring-1 ring-red-100 dark:ring-red-500/20 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {niches.map((niche) => (
          <button
            key={niche.slug}
            onClick={() => openNiche(niche.slug)}
            className="group text-left rounded-3xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 hover:-translate-y-0.5 hover:shadow-xl transition-all"
          >
            <div
              className="p-6 text-white"
              style={{
                backgroundImage: `linear-gradient(135deg, ${niche.colourFrom}, ${niche.colourTo})`,
              }}
            >
              <div className="text-4xl mb-2">{niche.emoji}</div>
              <h2 className="font-display text-lg font-bold leading-tight">{niche.name}</h2>
              <p className="text-sm text-white/85 mt-1">{niche.tagline}</p>
            </div>

            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {niche.audience}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {niche.assetCount} ASSETS
                </span>

                {MARKETPLACES.filter((market) => niche.marketplaces.includes(market.id)).map(
                  (market) => (
                    <span
                      key={market.id}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
                      style={{ backgroundColor: market.colour }}
                    >
                      {market.label.replace('Amazon ', '')}
                    </span>
                  )
                )}
              </div>

              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:gap-2 transition-all">
                Open the pack
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Inside one pack
// ---------------------------------------------------------------------------

function PackDetail({
  pack,
  onBack,
}: {
  pack: { niche: DfyNiche; assets: DfyAsset[] }
  onBack: () => void
}) {
  const groups = groupByKind(pack.assets)
  const [tab, setTab] = useState(groups[0]?.info.kind ?? '')

  const active = groups.find((group) => group.info.kind === tab) ?? groups[0]

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 mb-6 px-3 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        All packs
      </button>

      <div
        className="rounded-3xl p-7 text-white mb-6"
        style={{
          backgroundImage: `linear-gradient(135deg, ${pack.niche.colourFrom}, ${pack.niche.colourTo})`,
        }}
      >
        <div className="text-5xl mb-3">{pack.niche.emoji}</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">{pack.niche.name}</h1>
        <p className="mt-1 text-white/90">{pack.niche.tagline}</p>
        <p className="mt-4 text-sm text-white/80 max-w-2xl">{pack.niche.description}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Commercial rights included
          </span>
          <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">
            {pack.niche.audience}
          </span>
        </div>
      </div>

      {/* Tabs — scroll rather than wrap, so the row keeps its shape on a phone */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {groups.map((group) => (
          <button
            key={group.info.kind}
            onClick={() => setTab(group.info.kind)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              active?.info.kind === group.info.kind
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'ring-1 ring-slate-200 dark:ring-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {group.info.plural}
            <span className="ml-1.5 opacity-60">{group.assets.length}</span>
          </button>
        ))}
      </div>

      {active && (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{active.info.hint}</p>

          <div className="space-y-4">
            {active.assets.map((asset) => (
              <AssetCard key={asset.id} niche={pack.niche} asset={asset} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AssetCard({ niche, asset }: { niche: DfyNiche; asset: DfyAsset }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState<'body' | 'prompt' | null>(null)

  const link = toolLinkFor(asset)
  const info = kindInfo(asset.kind)

  const copy = async (what: 'body' | 'prompt') => {
    await navigator.clipboard.writeText((what === 'body' ? asset.body : asset.prompt) ?? '')
    setCopied(what)
    setTimeout(() => setCopied(null), 1500)
  }

  const download = () => {
    const blob = new Blob([asset.body], { type: info.mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = downloadName(niche, asset)
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    // Chrome keeps the blob alive until the tab closes otherwise.
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-slate-900 dark:text-white">{asset.title}</h3>
            {asset.summary && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{asset.summary}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {Object.entries(asset.meta).slice(0, 4).map(([key, value]) => (
                <span
                  key={key}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                >
                  {key.replace(/_/g, ' ')}: {String(value)}
                </span>
              ))}

              {asset.marketplaces.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
                  style={{
                    backgroundColor:
                      MARKETPLACES.find((market) => market.id === id)?.colour ?? '#64748b',
                  }}
                >
                  <Store className="w-2.5 h-2.5" />
                  {marketplaceLabel(id).replace('Amazon ', '')}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setExpanded((current) => !current)}
            className="px-3 py-2 rounded-xl text-sm font-semibold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {expanded ? 'Hide' : 'Read it'}
          </button>

          <button
            onClick={() => copy('body')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {copied === 'body' ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Copy
          </button>

          <button
            onClick={download}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            Download .{info.extension}
          </button>

          {link && (
            <Link
              href={link.href}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-90"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {link.label}
            </Link>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <pre className="p-5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words font-mono max-h-[32rem] overflow-y-auto">
            {asset.body}
          </pre>

          {asset.prompt && (
            <div className="p-5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Generator prompt
                </p>

                <button
                  onClick={() => copy('prompt')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600"
                >
                  {copied === 'prompt' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy prompt
                </button>
              </div>

              <pre className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words font-mono">
                {asset.prompt}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LockedNotice() {
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center mx-auto mb-5">
        <Lock className="w-7 h-7 text-white" />
      </div>

      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
        Done For You is part of OTO 2
      </h1>

      <p className="mt-3 text-slate-500 dark:text-slate-400">
        Ten complete kids content businesses — websites, storybooks, videos, rhymes, printables, AI
        tutors and blog content, with commercial rights. Upgrade to unlock the library.
      </p>

      <Link
        href="/credits"
        className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:opacity-90"
      >
        <Package className="w-4 h-4" />
        See the upgrade
      </Link>
    </div>
  )
}
