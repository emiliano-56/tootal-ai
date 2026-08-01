'use client'

import { useState } from 'react'
import { Megaphone, Sparkles, Mail, Search, FileText, Share2, ShoppingBag } from 'lucide-react'
import type { MarketingOutput } from '@/app/api/agent/marketing/route'
import { saveAgentRun, saveMarketingAssets } from '@/lib/agents/history'
import {
  AgentHeader,
  Card,
  Field,
  inputClass,
  PrimaryButton,
  CopyButton,
  DownloadButton,
  ErrorNote,
} from '@/components/agent-ui'

const TABS = [
  { key: 'ads', label: 'Ads', icon: Megaphone },
  { key: 'social', label: 'Social', icon: Share2 },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'seo', label: 'SEO & Blog', icon: Search },
  { key: 'sales', label: 'Sales Copy', icon: ShoppingBag },
] as const

type TabKey = (typeof TABS)[number]['key']

export function MarketingGenerator() {
  const [product, setProduct] = useState('')
  const [audience, setAudience] = useState('')
  const [niche, setNiche] = useState('')
  const [price, setPrice] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MarketingOutput | null>(null)
  const [tab, setTab] = useState<TabKey>('ads')

  const generate = async () => {
    if (!product.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/agent/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, audience, niche, price }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Generation failed')
      setResult(data)
      setTab('ads')

      // Persist so the kit shows up in History and survives a refresh.
      const m = data as MarketingOutput
      await saveAgentRun({
        agent: 'marketing_content',
        title: product,
        input: { product, audience, niche, price },
        output: m,
      })
      await saveMarketingAssets([
        ...(m.facebook_ads ?? []).map((a) => ({
          kind: 'facebook_ad',
          title: a.headline,
          content: `${a.primary_text}\n\nCTA: ${a.cta}`,
        })),
        ...(m.google_ads ?? []).map((a) => ({
          kind: 'google_ad',
          title: a.headline,
          content: a.description,
        })),
        ...(m.instagram ?? []).map((c) => ({ kind: 'instagram', content: c })),
        ...(m.twitter ?? []).map((c) => ({ kind: 'twitter', content: c })),
        ...(m.linkedin ?? []).map((c) => ({ kind: 'linkedin', content: c })),
        ...(m.email_sequence ?? []).map((e) => ({
          kind: 'email',
          title: e.subject,
          content: e.body,
          meta: { day: e.day },
        })),
        { kind: 'blog', title: m.blog_article?.title, content: m.blog_article?.body ?? '' },
        { kind: 'seo_title', content: m.seo?.meta_title ?? '' },
        { kind: 'seo_description', content: m.seo?.meta_description ?? '' },
        { kind: 'product_description', content: m.product_description ?? '' },
        { kind: 'sales_copy', content: m.sales_copy ?? '' },
      ])
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  /** Everything as one plain-text bundle for download. */
  const asText = (r: MarketingOutput) =>
    [
      `POSITIONING\n${r.positioning}`,
      `\n\nFACEBOOK ADS\n` +
        r.facebook_ads
          .map((a, i) => `${i + 1}. ${a.headline}\n${a.primary_text}\nCTA: ${a.cta}`)
          .join('\n\n'),
      `\n\nGOOGLE ADS\n` +
        r.google_ads.map((a, i) => `${i + 1}. ${a.headline}\n${a.description}`).join('\n\n'),
      `\n\nINSTAGRAM\n${r.instagram.join('\n\n')}`,
      `\n\nTWITTER/X\n${r.twitter.join('\n\n')}`,
      `\n\nLINKEDIN\n${r.linkedin.join('\n\n')}`,
      `\n\nEMAIL SEQUENCE\n` +
        r.email_sequence
          .map((e) => `Day ${e.day} — ${e.subject}\n${e.body}`)
          .join('\n\n'),
      `\n\nBLOG: ${r.blog_article.title}\n${r.blog_article.body}`,
      `\n\nSEO\nTitle: ${r.seo.meta_title}\nDescription: ${r.seo.meta_description}\nKeywords: ${r.seo.keywords.join(', ')}`,
      `\n\nPRODUCT DESCRIPTION\n${r.product_description}`,
      `\n\nSALES COPY\n${r.sales_copy}`,
    ].join('')

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<Megaphone className="w-5 h-5 text-white" />}
        gradient="from-orange-500 to-rose-600"
        title="Marketing Content Agent"
        subtitle="Ads, social posts, emails, blog and SEO copy — generated together"
        action={
          result ? (
            <DownloadButton
              filename={`${product.replace(/\s+/g, '-').toLowerCase() || 'marketing'}-kit.txt`}
              content={asText(result)}
              label="Download all"
            />
          ) : undefined
        }
      />

      {/* Input */}
      <Card>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Product / comic name or idea *">
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Zombie Survival — a 20-page action comic"
              className={inputClass}
            />
          </Field>
          <Field label="Target audience">
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Teens and young adults who love horror"
              className={inputClass}
            />
          </Field>
          <Field label="Niche">
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Horror / Survival"
              className={inputClass}
            />
          </Field>
          <Field label="Price">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="$17"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <PrimaryButton
            onClick={generate}
            loading={loading}
            disabled={!product.trim()}
            gradient="from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700"
            shadow="shadow-orange-500/25"
          >
            {!loading && <Sparkles className="w-4 h-4" />}
            {loading ? 'Writing your campaign…' : 'Generate Marketing Kit'}
          </PrimaryButton>
          {loading && (
            <span className="text-xs text-slate-500">
              This writes ~20 assets, it takes around a minute.
            </span>
          )}
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote message={error} />
          </div>
        )}
      </Card>

      {/* Output */}
      {result && (
        <>
          <Card title="Positioning" icon={<Sparkles className="w-[18px] h-[18px] text-orange-500" />}>
            <p className="text-sm text-slate-700 leading-relaxed">{result.positioning}</p>
          </Card>

          <div className="inline-flex gap-1 p-1 bg-white ring-1 ring-slate-200 rounded-xl shadow-sm">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all inline-flex items-center gap-1.5 ${
                    tab === t.key
                      ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {tab === 'ads' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card title="Facebook Ads">
                <div className="space-y-3">
                  {result.facebook_ads.map((ad, i) => (
                    <div key={i} className="rounded-xl ring-1 ring-slate-200 p-4">
                      <p className="font-display font-semibold text-slate-900 text-sm">
                        {ad.headline}
                      </p>
                      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                        {ad.primary_text}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-semibold">
                          {ad.cta}
                        </span>
                        <CopyButton
                          text={`${ad.headline}\n\n${ad.primary_text}\n\nCTA: ${ad.cta}`}
                          className="ml-auto"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Google Ads">
                <div className="space-y-3">
                  {result.google_ads.map((ad, i) => (
                    <div key={i} className="rounded-xl ring-1 ring-slate-200 p-4">
                      <p className="font-display font-semibold text-blue-700 text-sm">
                        {ad.headline}
                      </p>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                        {ad.description}
                      </p>
                      <CopyButton
                        text={`${ad.headline}\n${ad.description}`}
                        className="mt-3"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {tab === 'social' && (
            <div className="grid lg:grid-cols-3 gap-4">
              {[
                { title: 'Instagram', items: result.instagram },
                { title: 'Twitter / X', items: result.twitter },
                { title: 'LinkedIn', items: result.linkedin },
              ].map((group) => (
                <Card key={group.title} title={group.title}>
                  <div className="space-y-3">
                    {group.items?.map((post, i) => (
                      <div key={i} className="rounded-xl ring-1 ring-slate-200 p-3.5">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {post}
                        </p>
                        <CopyButton text={post} className="mt-2.5" />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === 'email' && (
            <Card title="Email Sequence" subtitle="Ready to paste into your autoresponder">
              <div className="space-y-3">
                {result.email_sequence.map((mail, i) => (
                  <div key={i} className="rounded-xl ring-1 ring-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                        Day {mail.day}
                      </span>
                      <p className="font-display font-semibold text-slate-900 text-sm truncate">
                        {mail.subject}
                      </p>
                      <CopyButton
                        text={`Subject: ${mail.subject}\n\n${mail.body}`}
                        className="ml-auto"
                      />
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {mail.body}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'seo' && (
            <div className="space-y-4">
              <Card title="SEO Metadata">
                <div className="space-y-3">
                  <div className="rounded-xl ring-1 ring-slate-200 p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Meta title ({result.seo.meta_title.length} chars)
                    </p>
                    <p className="text-sm text-slate-800">{result.seo.meta_title}</p>
                  </div>
                  <div className="rounded-xl ring-1 ring-slate-200 p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Meta description ({result.seo.meta_description.length} chars)
                    </p>
                    <p className="text-sm text-slate-800">{result.seo.meta_description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.seo.keywords?.map((k) => (
                      <span
                        key={k}
                        className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>

              <Card
                title={result.blog_article.title}
                icon={<FileText className="w-[18px] h-[18px] text-slate-400" />}
                right={
                  <CopyButton
                    text={`${result.blog_article.title}\n\n${result.blog_article.body}`}
                  />
                }
              >
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {result.blog_article.body}
                </p>
              </Card>
            </div>
          )}

          {tab === 'sales' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card
                title="Product Description"
                right={<CopyButton text={result.product_description} />}
              >
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {result.product_description}
                </p>
              </Card>
              <Card title="Sales Copy" right={<CopyButton text={result.sales_copy} />}>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {result.sales_copy}
                </p>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
