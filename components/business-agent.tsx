'use client'
import { consumeFeature } from '@/lib/plans/use-feature'

import { useState } from 'react'
import Link from 'next/link'
import {
  Rocket,
  Sparkles,
  Download,
  ExternalLink,
  CheckCircle2,
  Megaphone,
  Globe,
  ImagePlus,
  BookOpen,
  Film,
  Package,
  Palette,
  Heart,
  Loader2,
} from 'lucide-react'
import type { MarketingOutput } from '@/app/api/agent/marketing/route'
import type { LandingConfig } from '@/app/api/agent/landing-page/route'
import type { CoverCopy } from '@/app/api/agent/cover-copy/route'
import {
  renderLandingPage,
  renderThankYouPage,
  THEME_PRESETS,
  DEFAULT_SECTIONS,
  type LandingTheme,
} from '@/lib/landing/render'
import { renderBookMockup, renderSocialBanner } from '@/lib/mockup/book-mockup'
import { saveAgentRun, saveLandingPage } from '@/lib/agents/history'
import {
  AgentHeader,
  Card,
  Field,
  inputClass,
  PrimaryButton,
  ErrorNote,
  StepProgress,
} from '@/components/agent-ui'
import { useLanguage, LanguagePicker } from '@/components/language-picker'

const STEPS = [
  { key: 'cover', label: 'Cover copy, blurb and art direction' },
  { key: 'landing', label: 'Sales page and thank-you page' },
  { key: 'marketing', label: 'Ads, emails, social and SEO' },
  { key: 'assets', label: 'Product mockups and banners' },
]

interface Bundle {
  cover: CoverCopy | null
  landing: LandingConfig | null
  marketing: MarketingOutput | null
  mockup: string | null
  banner: string | null
}

const EMPTY: Bundle = {
  cover: null,
  landing: null,
  marketing: null,
  mockup: null,
  banner: null,
}

export function BusinessAgent() {
  const [idea, setIdea] = useState('')
  const [audience, setAudience] = useState('')
  const [price, setPrice] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')

  // One language for the whole package — cover, sales page and marketing.
  // Splitting them would produce a bundle that reads in two languages.
  const language = useLanguage()

  const [running, setRunning] = useState(false)
  const [stepIndex, setStepIndex] = useState(-1)
  const [failedIndex, setFailedIndex] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [zipping, setZipping] = useState(false)

  const [theme, setTheme] = useState<LandingTheme>({
    primary: '#4f46e5',
    accent: '#a21caf',
    mode: 'light',
    font: 'sans',
    radius: 16,
    heroStyle: 'gradient',
  })

  const renderArgs = {
    checkoutUrl: checkoutUrl || '#',
    theme,
    sections: DEFAULT_SECTIONS,
  }

  const post = async <T,>(url: string, body: unknown): Promise<T> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Request failed')
    return data as T
  }

  const run = async () => {

    if (!idea.trim()) return

    // Charged only once the input is valid — an empty submit would otherwise
    // cost one of the month's allowance and generate nothing.
    const allowance = await consumeFeature('business-agent')

    if (!allowance.ok) {
      setError(allowance.error ?? 'Monthly limit reached')
      return
    }

    setRunning(true)
    setError(null)
    setFailedIndex(undefined)
    setBundle(null)

    const result: Bundle = { ...EMPTY }
    let step = 0

    try {
      // 1. Cover
      step = 0
      setStepIndex(step)
      result.cover = await post<CoverCopy>('/api/agent/cover-copy', {
        idea,
        genre: audience,
        language: language.value,
      })
      setBundle({ ...result })

      const activeTheme: LandingTheme = {
        ...theme,
        primary: result.cover.theme?.primary || theme.primary,
        accent: result.cover.theme?.accent || theme.accent,
      }
      setTheme(activeTheme)

      // 2. Landing
      step = 1
      setStepIndex(step)
      result.landing = await post<LandingConfig>('/api/agent/landing-page', {
        product: idea,
        audience,
        price,
        language: language.value,
      })
      setBundle({ ...result })

      // 3. Marketing
      step = 2
      setStepIndex(step)
      result.marketing = await post<MarketingOutput>('/api/agent/marketing', {
        product: idea,
        audience,
        price,
        language: language.value,
      })
      setBundle({ ...result })

      // 4. Visual assets (local canvas work, no API calls)
      step = 3
      setStepIndex(step)
      const title = result.cover?.title || result.landing?.brand || idea
      const subtitle = result.cover?.subtitle || ''

      result.mockup = await renderBookMockup({
        title,
        subtitle,
        primary: activeTheme.primary,
        accent: activeTheme.accent,
      })
      result.banner = await renderSocialBanner({
        title,
        subtitle,
        primary: activeTheme.primary,
        accent: activeTheme.accent,
      })
      setBundle({ ...result })

      // Persist the whole package. Images are omitted from the job row because
      // data URLs would bloat it; the ZIP download carries them instead.
      await saveAgentRun({
        agent: 'business_agent',
        title: result.cover?.title || idea,
        input: { idea, audience, price },
        output: {
          cover: result.cover,
          landing: result.landing,
          marketing: result.marketing,
        },
      })

      if (result.landing) {
        await saveLandingPage({
          title: result.landing.brand || idea,
          config: result.landing,
          html: renderLandingPage(result.landing, {
            checkoutUrl: checkoutUrl || '#',
            theme: activeTheme,
            sections: DEFAULT_SECTIONS,
          }),
        })
      }

      setStepIndex(4)
    } catch (err: any) {
      setFailedIndex(step)
      setError(err.message || 'Something went wrong.')

      // Record the failure too, so a broken run is still visible in History.
      await saveAgentRun({
        agent: 'business_agent',
        title: idea,
        input: { idea, audience, price },
        output: null,
        status: 'failed',
        error: err?.message ?? 'Unknown error',
      })
    } finally {
      setRunning(false)
    }
  }

  const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob()

  /** Bundles every generated asset into a single downloadable ZIP. */
  const downloadZip = async () => {
    if (!bundle) return
    setZipping(true)

    try {
      const { cover, landing, marketing, mockup, banner } = bundle
      const name = (cover?.title || landing?.brand || idea)
        .replace(/[^a-z0-9]+/gi, '-')
        .toLowerCase()

      // Loaded on demand — only the download button needs it.
      const { default: JSZip } = await import('jszip')

      const zip = new JSZip()

      if (landing) {
        zip.file('sales-page/index.html', renderLandingPage(landing, renderArgs))
        zip.file('sales-page/thank-you.html', renderThankYouPage(landing, renderArgs))
      }

      if (cover) {
        zip.file(
          'product/cover-copy.txt',
          [
            `TITLE: ${cover.title}`,
            `SUBTITLE: ${cover.subtitle}`,
            `TAGLINE: ${cover.tagline}`,
            `SPINE: ${cover.spine_text}`,
            '',
            'BACK COVER BLURB',
            cover.back_blurb,
            '',
            'SELLING POINTS',
            ...(cover.bullets ?? []).map((b) => `- ${b}`),
            '',
            'COVER ART PROMPT',
            cover.art_prompt,
          ].join('\n')
        )
      }

      if (marketing) {
        const m = zip.folder('marketing')!
        m.file('positioning.txt', marketing.positioning ?? '')
        m.file(
          'facebook-ads.txt',
          (marketing.facebook_ads ?? [])
            .map((a, i) => `${i + 1}. ${a.headline}\n${a.primary_text}\nCTA: ${a.cta}`)
            .join('\n\n')
        )
        m.file(
          'google-ads.txt',
          (marketing.google_ads ?? [])
            .map((a, i) => `${i + 1}. ${a.headline}\n${a.description}`)
            .join('\n\n')
        )
        m.file('instagram.txt', (marketing.instagram ?? []).join('\n\n'))
        m.file('twitter.txt', (marketing.twitter ?? []).join('\n\n'))
        m.file('linkedin.txt', (marketing.linkedin ?? []).join('\n\n'))
        m.file(
          'email-sequence.txt',
          (marketing.email_sequence ?? [])
            .map((e) => `Day ${e.day} — ${e.subject}\n\n${e.body}`)
            .join('\n\n---\n\n')
        )
        m.file(
          'blog-article.txt',
          `${marketing.blog_article?.title ?? ''}\n\n${marketing.blog_article?.body ?? ''}`
        )
        m.file(
          'seo.txt',
          [
            `Meta title: ${marketing.seo?.meta_title}`,
            `Meta description: ${marketing.seo?.meta_description}`,
            `Keywords: ${(marketing.seo?.keywords ?? []).join(', ')}`,
          ].join('\n')
        )
        m.file('product-description.txt', marketing.product_description ?? '')
        m.file('sales-copy.txt', marketing.sales_copy ?? '')
      }

      const images = zip.folder('images')!
      if (mockup) images.file('product-mockup.jpg', await dataUrlToBlob(mockup))
      if (banner) images.file('social-banner.jpg', await dataUrlToBlob(banner))

      zip.file(
        'README.txt',
        [
          `${cover?.title || idea}`,
          '='.repeat(40),
          '',
          'This package was generated by the ComicAgent AI Business Agent.',
          '',
          'CONTENTS',
          '  sales-page/index.html      Your sales page (open in any browser)',
          '  sales-page/thank-you.html  Post-purchase delivery page',
          '  product/cover-copy.txt     Title, blurb and cover art prompt',
          '  marketing/                 Ads, emails, social posts, blog and SEO',
          '  images/                    Product mockup and social banner',
          '',
          'NEXT STEPS',
          '  1. Upload sales-page/index.html to your host.',
          '  2. Point the buy buttons at your checkout link.',
          '  3. Load the email sequence into your autoresponder.',
        ].join('\n')
      )

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}-business-package.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('[business-agent] zip failed:', err)
      setError(err?.message || 'Could not build the ZIP package.')
    } finally {
      setZipping(false)
    }
  }

  const done = stepIndex >= 4 && bundle

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<Rocket className="w-5 h-5 text-white" />}
        gradient="from-fuchsia-500 to-purple-600"
        title="AI Business Agent"
        subtitle="One idea becomes a launch-ready package"
        action={
          done ? (
            <button
              onClick={downloadZip}
              disabled={zipping}
              className="font-display h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors"
            >
              {zipping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              {zipping ? 'Packaging…' : 'Download ZIP'}
            </button>
          ) : undefined
        }
      />

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        <div className="space-y-4">
          <Card>
            <div className="space-y-4">
              <Field label="Your idea *">
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Create a kids educational comic about dinosaurs."
                  className={`${inputClass} h-28 resize-none`}
                />
              </Field>
              <Field label="Audience">
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Parents and teachers of kids aged 5-10"
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price">
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="$19"
                    className={inputClass}
                  />
                </Field>
                <Field label="Checkout link">
                  <input
                    value={checkoutUrl}
                    onChange={(e) => setCheckoutUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClass}
                  />
                </Field>
              </div>

              <LanguagePicker
                value={language.value}
                onChange={language.setValue}
                allowed={language.allowed}
              />

              <PrimaryButton
                onClick={run}
                loading={running}
                disabled={!idea.trim()}
                gradient="from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
                shadow="shadow-fuchsia-500/25"
                className="w-full"
              >
                {!running && <Sparkles className="w-4 h-4" />}
                {running ? 'Building your business…' : 'Launch Business Agent'}
              </PrimaryButton>

              <p className="text-[11px] text-slate-400 text-center">
                Takes 2-3 minutes. Keep this tab open.
              </p>
            </div>
          </Card>

          {stepIndex >= 0 && (
            <Card title="Progress">
              <StepProgress steps={STEPS} currentIndex={stepIndex} failedIndex={failedIndex} />
              {error && (
                <div className="mt-4">
                  <ErrorNote message={error} />
                </div>
              )}
            </Card>
          )}

          {bundle?.landing && (
            <Card
              title="Brand colours"
              icon={<Palette className="w-[18px] h-[18px] text-fuchsia-600" />}
              subtitle="Applies to the sales page, thank-you page and images"
            >
              <div className="grid grid-cols-4 gap-2">
                {THEME_PRESETS.map((preset) => {
                  const active =
                    theme.primary.toLowerCase() === preset.primary.toLowerCase() &&
                    theme.accent.toLowerCase() === preset.accent.toLowerCase()
                  return (
                    <button
                      key={preset.name}
                      title={preset.name}
                      onClick={() =>
                        setTheme((t) => ({
                          ...t,
                          primary: preset.primary,
                          accent: preset.accent,
                        }))
                      }
                      className={`h-10 rounded-lg transition-all ring-2 ${
                        active ? 'ring-slate-900 scale-105' : 'ring-transparent hover:scale-105'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})`,
                      }}
                    />
                  )
                })}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <input
                  type="color"
                  value={theme.primary}
                  onChange={(e) => setTheme((t) => ({ ...t, primary: e.target.value }))}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer bg-white"
                />
                <input
                  type="color"
                  value={theme.accent}
                  onChange={(e) => setTheme((t) => ({ ...t, accent: e.target.value }))}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer bg-white"
                />
                <Link
                  href="/landing-pages"
                  className="ml-auto text-[11px] font-semibold text-fuchsia-600 hover:text-fuchsia-700 inline-flex items-center gap-1"
                >
                  Full editor
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </Card>
          )}

          <Card title="Also available">
            <div className="space-y-2">
              {[
                { href: '/comic-agent', label: 'Story-to-Comic Agent', icon: BookOpen },
                { href: '/comic-video', label: 'Comic-to-Video', icon: Film },
                { href: '/cover-designer', label: 'Cover Designer', icon: ImagePlus },
              ].map((l) => {
                const Icon = l.icon
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50 transition-all"
                  >
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700 flex-1">{l.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                  </Link>
                )
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {!bundle && (
            <Card className="flex flex-col items-center justify-center text-center py-24">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-fuchsia-500/25">
                <Rocket className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-display font-semibold text-slate-900 text-xl">
                One idea in, a whole business out
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 max-w-md">
                Cover copy, a full sales page, a thank-you page, product mockups, a social
                banner and every marketing asset — packaged as a ZIP you can ship.
              </p>
            </Card>
          )}

          {(bundle?.mockup || bundle?.banner) && (
            <Card
              title="Product Images"
              icon={<ImagePlus className="w-[18px] h-[18px] text-fuchsia-500" />}
              right={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            >
              <div className="grid sm:grid-cols-2 gap-3">
                {bundle.mockup && (
                  <div className="rounded-xl overflow-hidden ring-1 ring-slate-200">
                    <img src={bundle.mockup} alt="Product mockup" className="w-full" />
                    <p className="text-[11px] text-slate-500 px-3 py-2 bg-white">
                      3D product mockup
                    </p>
                  </div>
                )}
                {bundle.banner && (
                  <div className="rounded-xl overflow-hidden ring-1 ring-slate-200">
                    <img src={bundle.banner} alt="Social banner" className="w-full" />
                    <p className="text-[11px] text-slate-500 px-3 py-2 bg-white">
                      Social banner / thumbnail
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {bundle?.cover && (
            <Card
              title="Cover & Product"
              icon={<BookOpen className="w-[18px] h-[18px] text-violet-500" />}
              right={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            >
              <p className="font-display text-lg font-bold text-slate-900">
                {bundle.cover.title}
              </p>
              <p className="text-sm text-slate-500">{bundle.cover.subtitle}</p>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                {bundle.cover.back_blurb}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {(bundle.cover.bullets ?? []).map((b, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-[11px] font-medium"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {bundle?.landing && (
            <>
              <Card
                title="Sales Page"
                icon={<Globe className="w-[18px] h-[18px] text-emerald-500" />}
                right={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              >
                <p className="font-display text-lg font-bold text-slate-900">
                  {bundle.landing.headline}
                </p>
                <p className="text-sm text-slate-500 mt-1">{bundle.landing.subheadline}</p>
                <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 mt-4">
                  <iframe
                    srcDoc={renderLandingPage(bundle.landing, renderArgs)}
                    title="Sales page preview"
                    sandbox="allow-same-origin"
                    className="w-full h-96 bg-white"
                  />
                </div>
              </Card>

              <Card
                title="Thank You Page"
                icon={<Heart className="w-[18px] h-[18px] text-rose-500" />}
                right={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              >
                <div className="rounded-xl overflow-hidden ring-1 ring-slate-200">
                  <iframe
                    srcDoc={renderThankYouPage(bundle.landing, renderArgs)}
                    title="Thank you page preview"
                    sandbox="allow-same-origin"
                    className="w-full h-72 bg-white"
                  />
                </div>
              </Card>
            </>
          )}

          {bundle?.marketing && (
            <Card
              title="Marketing Assets"
              icon={<Megaphone className="w-[18px] h-[18px] text-orange-500" />}
              right={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            >
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: 'Facebook ads', count: bundle.marketing.facebook_ads?.length },
                  { label: 'Google ads', count: bundle.marketing.google_ads?.length },
                  { label: 'Instagram', count: bundle.marketing.instagram?.length },
                  { label: 'Twitter / X', count: bundle.marketing.twitter?.length },
                  { label: 'LinkedIn', count: bundle.marketing.linkedin?.length },
                  { label: 'Emails', count: bundle.marketing.email_sequence?.length },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl ring-1 ring-slate-200 px-3.5 py-2.5"
                  >
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <span className="font-display text-sm font-bold text-slate-900">
                      {item.count ?? 0}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  SEO title
                </p>
                <p className="text-sm text-slate-800">{bundle.marketing.seo?.meta_title}</p>
              </div>

              <Link
                href="/marketing"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
              >
                Open full marketing kit
                <ExternalLink className="w-3 h-3" />
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
