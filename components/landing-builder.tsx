'use client'

import { useState } from 'react'
import {
  Globe,
  Sparkles,
  Eye,
  Code2,
  Download,
  Link2,
  Copy,
  Check,
  AlertTriangle,
  Palette,
  Layers,
  Monitor,
  Smartphone,
  Heart,
} from 'lucide-react'
import type { LandingConfig } from '@/app/api/agent/landing-page/route'
import {
  renderLandingPage,
  renderThankYouPage,
  THEME_PRESETS,
  DEFAULT_SECTIONS,
  type LandingTheme,
  type SectionToggles,
  type FontChoice,
  type HeroStyle,
} from '@/lib/landing/render'
import {
  AgentHeader,
  Card,
  Field,
  inputClass,
  PrimaryButton,
  ErrorNote,
  downloadText,
} from '@/components/agent-ui'
import { useLanguage, LanguagePicker } from '@/components/language-picker'
import { saveAgentRun, saveLandingPage } from '@/lib/agents/history'
import { consumeFeature } from '@/lib/plans/use-feature'

const FONTS: { value: FontChoice; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'mono', label: 'Mono' },
]

const HERO_STYLES: { value: HeroStyle; label: string }[] = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'solid', label: 'Solid' },
  { value: 'dark', label: 'Dark' },
]

const SECTION_LABELS: { key: keyof SectionToggles; label: string }[] = [
  { key: 'stats', label: 'Stats bar' },
  { key: 'features', label: 'Features' },
  { key: 'benefits', label: 'Benefits' },
  { key: 'about', label: 'About / Story' },
  { key: 'bonuses', label: 'Bonuses' },
  { key: 'testimonials', label: 'Testimonials' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'guarantee', label: 'Guarantee' },
  { key: 'faq', label: 'FAQ' },
  { key: 'finalCta', label: 'Final CTA' },
]

export function LandingBuilder() {
  const [product, setProduct] = useState('')
  const [audience, setAudience] = useState('')
  const [price, setPrice] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')

  // What language the sales page is written in.
  const language = useLanguage()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<LandingConfig | null>(null)
  const [view, setView] = useState<'preview' | 'thankyou' | 'html' | 'domain'>('preview')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')

  // Live-editable design
  const [theme, setTheme] = useState<LandingTheme>({
    primary: '#4f46e5',
    accent: '#a21caf',
    mode: 'light',
    font: 'sans',
    radius: 16,
    heroStyle: 'gradient',
  })
  const [sections, setSections] = useState<SectionToggles>(DEFAULT_SECTIONS)

  // Custom domain
  const [domain, setDomain] = useState('')
  const [domainSaved, setDomainSaved] = useState<string | null>(null)
  const [copiedDns, setCopiedDns] = useState(false)

  const renderArgs = { checkoutUrl: checkoutUrl || '#', theme, sections }
  const html = config ? renderLandingPage(config, renderArgs) : ''
  const thankYouHtml = config ? renderThankYouPage(config, renderArgs) : ''

  const generate = async () => {

    if (!product.trim()) return

    // Charged only once the input is valid — an empty submit would otherwise
    // cost one of the month's allowance and generate nothing.
    const allowance = await consumeFeature('landing-pages')

    if (!allowance.ok) {
      setError(allowance.error ?? 'Monthly limit reached')
      return
    }

    setLoading(true)
    setError(null)
    setConfig(null)

    try {
      const res = await fetch('/api/agent/landing-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, audience, price, language: language.value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Generation failed')

      setConfig(data)
      // Adopt the AI's colour suggestion as the starting point.
      const nextTheme = {
        ...theme,
        primary: data?.theme?.primary || theme.primary,
        accent: data?.theme?.accent || theme.accent,
      }
      setTheme(nextTheme)
      setView('preview')

      // Persist so the page appears in History and can be reopened later.
      await saveAgentRun({
        agent: 'landing_page',
        title: data?.brand || product,
        input: { product, audience, price },
        output: data,
      })
      await saveLandingPage({
        title: data?.brand || product,
        config: data,
        html: renderLandingPage(data, {
          checkoutUrl: checkoutUrl || '#',
          theme: nextTheme,
          sections,
        }),
      })
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const slug = (config?.brand || product || 'landing')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const sectionCount = Object.values(sections).filter(Boolean).length

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<Globe className="w-5 h-5 text-white" />}
        gradient="from-emerald-500 to-teal-600"
        title="Landing Page Builder"
        subtitle="A complete sales page you can restyle live — with custom domain support"
      />

      <Card>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Product / comic name *">
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Space Warriors — a sci-fi comic series"
              className={inputClass}
            />
          </Field>
          <Field label="Audience">
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Sci-fi fans aged 12-25"
              className={inputClass}
            />
          </Field>
          <Field label="Price">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="$27"
              className={inputClass}
            />
          </Field>
          <Field label="Checkout / buy link">
            <input
              value={checkoutUrl}
              onChange={(e) => setCheckoutUrl(e.target.value)}
              placeholder="https://your-checkout-link.com"
              className={inputClass}
            />
          </Field>

          <LanguagePicker
            value={language.value}
            onChange={language.setValue}
            allowed={language.allowed}
          />
        </div>

        <div className="mt-5">
          <PrimaryButton
            onClick={generate}
            loading={loading}
            disabled={!product.trim()}
            gradient="from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            shadow="shadow-emerald-500/25"
          >
            {!loading && <Sparkles className="w-4 h-4" />}
            {loading ? 'Building your page…' : 'Generate Landing Page'}
          </PrimaryButton>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote message={error} />
          </div>
        )}
      </Card>

      {config && (
        <div className="grid xl:grid-cols-[320px_1fr] gap-6">
          {/* ---------------- Design controls ---------------- */}
          <div className="space-y-4">
            <Card
              title="Colours"
              icon={<Palette className="w-[18px] h-[18px] text-emerald-600" />}
            >
              <div className="grid grid-cols-4 gap-2 mb-4">
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
                      className={`h-11 rounded-lg transition-all ring-2 ${
                        active ? 'ring-slate-900 scale-105' : 'ring-transparent hover:scale-105'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})`,
                      }}
                    />
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Primary
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.primary}
                      onChange={(e) => setTheme((t) => ({ ...t, primary: e.target.value }))}
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer bg-white"
                    />
                    <input
                      value={theme.primary}
                      onChange={(e) => setTheme((t) => ({ ...t, primary: e.target.value }))}
                      className="flex-1 min-w-0 rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-mono text-slate-700 ring-1 ring-slate-200 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Accent
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.accent}
                      onChange={(e) => setTheme((t) => ({ ...t, accent: e.target.value }))}
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer bg-white"
                    />
                    <input
                      value={theme.accent}
                      onChange={(e) => setTheme((t) => ({ ...t, accent: e.target.value }))}
                      className="flex-1 min-w-0 rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-mono text-slate-700 ring-1 ring-slate-200 outline-none"
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Style">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Font
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {FONTS.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setTheme((t) => ({ ...t, font: f.value }))}
                        className={`h-8 rounded-lg text-[11px] font-semibold transition-all ring-1 ${
                          theme.font === f.value
                            ? 'bg-emerald-600 text-white ring-emerald-600'
                            : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-400'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Hero style
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {HERO_STYLES.map((h) => (
                      <button
                        key={h.value}
                        onClick={() => setTheme((t) => ({ ...t, heroStyle: h.value }))}
                        className={`h-8 rounded-lg text-[11px] font-semibold transition-all ring-1 ${
                          theme.heroStyle === h.value
                            ? 'bg-emerald-600 text-white ring-emerald-600'
                            : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-400'
                        }`}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Page mode
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['light', 'dark'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setTheme((t) => ({ ...t, mode: m }))}
                        className={`h-8 rounded-lg text-[11px] font-semibold capitalize transition-all ring-1 ${
                          theme.mode === m
                            ? 'bg-emerald-600 text-white ring-emerald-600'
                            : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-400'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Corner radius</span>
                    <span className="text-slate-400 normal-case tracking-normal">
                      {theme.radius}px
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={28}
                    value={theme.radius}
                    onChange={(e) =>
                      setTheme((t) => ({ ...t, radius: Number(e.target.value) }))
                    }
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>
            </Card>

            <Card
              title="Sections"
              icon={<Layers className="w-[18px] h-[18px] text-emerald-600" />}
              right={
                <span className="text-[11px] font-medium text-slate-400">
                  {sectionCount}/{SECTION_LABELS.length}
                </span>
              }
            >
              <div className="space-y-1">
                {SECTION_LABELS.map((s) => (
                  <label
                    key={s.key}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={sections[s.key]}
                      onChange={(e) =>
                        setSections((prev) => ({ ...prev, [s.key]: e.target.checked }))
                      }
                      className="w-4 h-4 rounded accent-emerald-600"
                    />
                    <span className="text-sm text-slate-700">{s.label}</span>
                  </label>
                ))}
              </div>
            </Card>
          </div>

          {/* ---------------- Preview ---------------- */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex gap-1 p-1 bg-white ring-1 ring-slate-200 rounded-xl shadow-sm">
                {[
                  { key: 'preview', label: 'Sales Page', icon: Eye },
                  { key: 'thankyou', label: 'Thank You', icon: Heart },
                  { key: 'html', label: 'HTML', icon: Code2 },
                  { key: 'domain', label: 'Domain', icon: Link2 },
                ].map((t) => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.key}
                      onClick={() => setView(t.key as typeof view)}
                      className={`px-3.5 py-2 rounded-lg font-semibold text-sm transition-all inline-flex items-center gap-1.5 ${
                        view === t.key
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {(view === 'preview' || view === 'thankyou') && (
                <div className="inline-flex gap-1 p-1 bg-white ring-1 ring-slate-200 rounded-xl shadow-sm">
                  {[
                    { key: 'desktop', icon: Monitor },
                    { key: 'mobile', icon: Smartphone },
                  ].map((d) => {
                    const Icon = d.icon
                    return (
                      <button
                        key={d.key}
                        onClick={() => setDevice(d.key as typeof device)}
                        className={`px-3 py-2 rounded-lg transition-all ${
                          device === d.key
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => downloadText(`${slug}.html`, html, 'text/html')}
                  className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Sales page
                </button>
                <button
                  onClick={() =>
                    downloadText(`${slug}-thank-you.html`, thankYouHtml, 'text/html')
                  }
                  className="h-10 px-4 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Thank you
                </button>
              </div>
            </div>

            {(view === 'preview' || view === 'thankyou') && (
              <div className="rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-lg bg-white">
                <div className="h-9 bg-slate-100 flex items-center gap-2 px-3.5 border-b border-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-[11px] font-medium text-slate-500">
                    {domainSaved || `${slug}.yoursite.com`}
                    {view === 'thankyou' ? '/thank-you' : ''}
                  </span>
                </div>
                <div className={device === 'mobile' ? 'flex justify-center bg-slate-100 py-6' : ''}>
                  {/* Sandboxed so generated markup can never touch the dashboard */}
                  <iframe
                    key={`${view}-${device}`}
                    srcDoc={view === 'thankyou' ? thankYouHtml : html}
                    title="Landing page preview"
                    sandbox="allow-same-origin"
                    className={
                      device === 'mobile'
                        ? 'w-[390px] h-[760px] rounded-2xl ring-1 ring-slate-300 bg-white'
                        : 'w-full h-[760px] bg-white'
                    }
                  />
                </div>
              </div>
            )}

            {view === 'html' && (
              <Card
                title="Generated HTML"
                subtitle="Self-contained — no CDN, no external fonts, works offline"
                right={
                  <button
                    onClick={() => navigator.clipboard.writeText(html)}
                    className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                }
              >
                <pre className="text-[11px] leading-relaxed bg-slate-900 text-slate-100 rounded-xl p-4 overflow-auto max-h-[620px]">
                  <code>{html}</code>
                </pre>
              </Card>
            )}

            {view === 'domain' && (
              <Card
                title="Custom Domain"
                subtitle="Point your own domain at this landing page"
                icon={<Link2 className="w-[18px] h-[18px] text-emerald-600" />}
              >
                <Field label="Your domain">
                  <div className="flex gap-2">
                    <input
                      value={domain}
                      onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
                      placeholder="comics.yourbrand.com"
                      className={inputClass}
                    />
                    <button
                      onClick={() => setDomainSaved(domain || null)}
                      disabled={!domain}
                      className="h-[42px] px-5 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                </Field>

                {domainSaved && (
                  <div className="mt-5 space-y-4">
                    <p className="text-sm text-slate-600">
                      Add these two records at your domain registrar (GoDaddy, Namecheap,
                      Cloudflare…). Changes can take up to 24 hours to propagate.
                    </p>

                    <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-semibold">Type</th>
                            <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                            <th className="text-left px-4 py-2.5 font-semibold">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-4 py-3 font-mono text-xs">CNAME</td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {domainSaved.split('.')[0]}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-emerald-700">
                              cname.vercel-dns.com
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-mono text-xs">TXT</td>
                            <td className="px-4 py-3 font-mono text-xs">
                              _comictale.{domainSaved.split('.')[0]}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-emerald-700 break-all">
                              comictale-verify={slug}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          `CNAME ${domainSaved.split('.')[0]} cname.vercel-dns.com\nTXT _comictale.${domainSaved.split('.')[0]} comictale-verify=${slug}`
                        )
                        setCopiedDns(true)
                        setTimeout(() => setCopiedDns(false), 1600)
                      }}
                      className="h-9 px-4 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      {copiedDns ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy DNS records
                        </>
                      )}
                    </button>

                    <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 leading-relaxed">
                        <strong>Hosting step still required.</strong> These records point the
                        domain at your host, but the host must also be told to serve this page
                        for that domain. On Vercel that means adding the domain to the project
                        (Settings → Domains) or calling their Domains API. Until then the DNS
                        will resolve but the page will not load.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
