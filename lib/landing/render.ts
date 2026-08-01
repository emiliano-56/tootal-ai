import type { LandingConfig } from '@/app/api/agent/landing-page/route'

/**
 * Renders a LandingConfig into a standalone, responsive HTML document.
 *
 * The output has no external dependencies (no CDN, no fonts, no JS framework)
 * so it can be hosted anywhere or opened straight from disk.
 */

export type FontChoice = 'sans' | 'serif' | 'rounded' | 'mono'
export type HeroStyle = 'gradient' | 'solid' | 'split' | 'dark'

export interface LandingTheme {
  primary: string
  accent: string
  mode: 'light' | 'dark'
  font: FontChoice
  radius: number
  heroStyle: HeroStyle
}

export interface SectionToggles {
  stats: boolean
  features: boolean
  benefits: boolean
  about: boolean
  bonuses: boolean
  testimonials: boolean
  pricing: boolean
  guarantee: boolean
  faq: boolean
  finalCta: boolean
}

export const DEFAULT_SECTIONS: SectionToggles = {
  stats: true,
  features: true,
  benefits: true,
  about: true,
  bonuses: true,
  testimonials: true,
  pricing: true,
  guarantee: true,
  faq: true,
  finalCta: true,
}

export const THEME_PRESETS: { name: string; primary: string; accent: string }[] = [
  { name: 'Indigo', primary: '#4f46e5', accent: '#a21caf' },
  { name: 'Ocean', primary: '#0284c7', accent: '#0891b2' },
  { name: 'Sunset', primary: '#ea580c', accent: '#db2777' },
  { name: 'Forest', primary: '#059669', accent: '#0d9488' },
  { name: 'Midnight', primary: '#1e293b', accent: '#6366f1' },
  { name: 'Candy', primary: '#db2777', accent: '#8b5cf6' },
  { name: 'Gold', primary: '#b45309', accent: '#eab308' },
  { name: 'Crimson', primary: '#be123c', accent: '#f97316' },
]

const FONT_STACKS: Record<FontChoice, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", ui-serif, serif',
  rounded: '"Trebuchet MS", "Segoe UI", ui-rounded, system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

const ICONS: Record<string, string> = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
}

function icon(name: string) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.sparkles}</svg>`
}

/** Escapes text so generated copy can never break out into markup. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeColor(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value ?? '') ? (value as string) : fallback
}

export interface RenderArgs {
  checkoutUrl?: string
  theme?: Partial<LandingTheme>
  sections?: Partial<SectionToggles>
}

export function renderLandingPage(config: LandingConfig, args: RenderArgs = {}): string {
  const primary = safeColor(args.theme?.primary ?? config.theme?.primary, '#4f46e5')
  const accent = safeColor(args.theme?.accent ?? config.theme?.accent, '#a21caf')
  const mode = args.theme?.mode ?? 'light'
  const font = FONT_STACKS[args.theme?.font ?? 'sans']
  const radius = args.theme?.radius ?? 16
  const heroStyle = args.theme?.heroStyle ?? 'gradient'

  const S = { ...DEFAULT_SECTIONS, ...args.sections }
  const cta = esc(args.checkoutUrl || '#')

  const dark = mode === 'dark'
  const ink = dark ? '#f1f5f9' : '#0f172a'
  const muted = dark ? '#94a3b8' : '#64748b'
  const surface = dark ? '#0f172a' : '#ffffff'
  const alt = dark ? '#1e293b' : '#f8fafc'
  const line = dark ? '#334155' : '#e2e8f0'

  const heroBg =
    heroStyle === 'solid'
      ? primary
      : heroStyle === 'dark'
        ? '#0f172a'
        : `linear-gradient(135deg, ${primary}, ${accent})`

  const has = <T,>(arr: T[] | undefined) => Array.isArray(arr) && arr.length > 0

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.seo?.title || config.brand)}</title>
<meta name="description" content="${esc(config.seo?.description || config.subheadline)}">
<meta property="og:title" content="${esc(config.seo?.title || config.brand)}">
<meta property="og:description" content="${esc(config.seo?.description || config.subheadline)}">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--p:${primary};--a:${accent};--ink:${ink};--muted:${muted};--line:${line};--bg:${alt};--surface:${surface};--r:${radius}px}
html{scroll-behavior:smooth}
body{font-family:${font};color:var(--ink);background:var(--surface);line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:16px 32px;border-radius:calc(var(--r) - 4px);font-weight:700;text-decoration:none;font-size:16px;transition:transform .15s,box-shadow .15s;border:0;cursor:pointer}
.btn-p{background:linear-gradient(135deg,var(--p),var(--a));color:#fff;box-shadow:0 12px 28px -10px var(--p)}
.btn-p:hover{transform:translateY(-2px);box-shadow:0 18px 34px -10px var(--p)}
.btn-s{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.32)}
.btn-s:hover{background:rgba(255,255,255,.24)}
header{background:${heroBg};color:#fff;padding:84px 0 92px;text-align:center;position:relative;overflow:hidden}
header::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 18% 18%,rgba(255,255,255,.18),transparent 45%);pointer-events:none}
.brand{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;background:rgba(255,255,255,.16);padding:8px 16px;border-radius:999px;margin-bottom:24px}
h1{font-size:clamp(32px,5.2vw,58px);line-height:1.1;font-weight:800;max-width:16ch;margin:0 auto 20px;position:relative}
.sub{font-size:clamp(16px,2vw,20px);opacity:.93;max-width:62ch;margin:0 auto 30px;position:relative}
.ctas{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;position:relative}
.note{margin-top:18px;font-size:14px;opacity:.85;position:relative}
.urg{display:inline-block;margin-top:22px;background:rgba(0,0,0,.24);border:1px solid rgba(255,255,255,.24);padding:9px 18px;border-radius:999px;font-size:14px;font-weight:600;position:relative}
.statbar{background:var(--surface);border-bottom:1px solid var(--line)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:20px;padding:34px 0;text-align:center}
.stat b{display:block;font-size:clamp(26px,3.6vw,38px);font-weight:800;background:linear-gradient(135deg,var(--p),var(--a));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.stat span{font-size:13px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
section{padding:76px 0}
.alt{background:var(--bg)}
h2{font-size:clamp(26px,3.4vw,38px);font-weight:800;text-align:center;margin-bottom:12px}
.lead{text-align:center;color:var(--muted);max-width:60ch;margin:0 auto 46px}
.grid{display:grid;gap:22px}
.g3{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.g2{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:28px;transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-3px);box-shadow:0 18px 36px -18px rgba(15,23,42,.3)}
.ico{width:46px;height:46px;border-radius:calc(var(--r) - 6px);background:linear-gradient(135deg,var(--p),var(--a));display:flex;align-items:center;justify-content:center;color:#fff;margin-bottom:16px}
.ico svg{width:22px;height:22px}
.card h3{font-size:18px;font-weight:700;margin-bottom:8px}
.card p{color:var(--muted);font-size:15px}
.bonus{border:2px dashed var(--p);position:relative}
.bonus .val{position:absolute;top:-13px;right:20px;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;font-size:12px;font-weight:800;padding:5px 14px;border-radius:999px}
.about{max-width:760px;margin:0 auto;text-align:center}
.about p{color:var(--muted);font-size:17px}
.quote{font-style:italic;color:var(--ink);opacity:.9;margin-bottom:16px}
.who{display:flex;align-items:center;gap:12px}
.av{width:40px;height:40px;border-radius:999px;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
.who strong{display:block;font-size:14px}
.who span{font-size:13px;color:var(--muted)}
.stars{color:#f59e0b;margin-bottom:10px;letter-spacing:2px}
.plan{background:var(--surface);border:1px solid var(--line);border-radius:calc(var(--r) + 2px);padding:32px;display:flex;flex-direction:column}
.plan.hot{border:2px solid var(--p);box-shadow:0 22px 46px -22px var(--p);position:relative}
.tag{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,var(--p),var(--a));color:#fff;font-size:12px;font-weight:700;padding:6px 16px;border-radius:999px}
.price{font-size:42px;font-weight:800;margin:14px 0 4px}
.was{font-size:18px;color:var(--muted);text-decoration:line-through;font-weight:600;margin-left:8px}
.plan ul{list-style:none;margin:22px 0;flex:1}
.plan li{padding:8px 0 8px 26px;position:relative;font-size:15px;color:var(--muted)}
.plan li::before{content:"✓";position:absolute;left:0;color:var(--p);font-weight:800}
.guar{max-width:720px;margin:0 auto;text-align:center;border:2px solid var(--p);border-radius:var(--r);padding:40px 32px;background:var(--surface)}
.guar .seal{width:72px;height:72px;border-radius:999px;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 18px}
.guar .seal svg{width:34px;height:34px}
.guar p{color:var(--muted);margin-top:10px}
details{background:var(--surface);border:1px solid var(--line);border-radius:calc(var(--r) - 4px);margin-bottom:12px;overflow:hidden}
summary{padding:18px 22px;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:16px}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";color:var(--p);font-weight:800;font-size:20px;line-height:1}
details[open] summary::after{content:"–"}
details p{padding:0 22px 20px;color:var(--muted);font-size:15px}
.final{background:linear-gradient(135deg,var(--p),var(--a));color:#fff;text-align:center}
.final h2{color:#fff}
.final p{opacity:.93;margin-bottom:30px}
footer{background:${dark ? '#020617' : '#0f172a'};color:#94a3b8;text-align:center;padding:40px 0;font-size:14px}
@media(max-width:640px){section{padding:56px 0}.card{padding:22px}header{padding:64px 0 72px}}
</style>
</head>
<body>

<header>
  <div class="wrap">
    <span class="brand">${esc(config.brand)}</span>
    <h1>${esc(config.headline)}</h1>
    <p class="sub">${esc(config.subheadline)}</p>
    <div class="ctas">
      <a class="btn btn-p" href="${cta}">${esc(config.cta_primary)}</a>
      <a class="btn btn-s" href="#features">${esc(config.cta_secondary)}</a>
    </div>
    <p class="note">${esc(config.hero_note)}</p>
    ${config.urgency ? `<div class="urg">⚡ ${esc(config.urgency)}</div>` : ''}
  </div>
</header>

${
  S.stats && has(config.stats)
    ? `<div class="statbar"><div class="wrap"><div class="stats">
  ${config.stats
    .map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`)
    .join('')}
</div></div></div>`
    : ''
}

${
  S.features && has(config.features)
    ? `<section id="features">
  <div class="wrap">
    <h2>What's Inside</h2>
    <p class="lead">Everything you get with ${esc(config.brand)}.</p>
    <div class="grid g3">
      ${config.features
        .map(
          (f) => `<div class="card">
        <div class="ico">${icon(f.icon)}</div>
        <h3>${esc(f.title)}</h3>
        <p>${esc(f.description)}</p>
      </div>`
        )
        .join('')}
    </div>
  </div>
</section>`
    : ''
}

${
  S.benefits && has(config.benefits)
    ? `<section class="alt">
  <div class="wrap">
    <h2>Why You'll Love It</h2>
    <p class="lead">The difference it makes.</p>
    <div class="grid g2">
      ${config.benefits
        .map(
          (b) => `<div class="card"><h3>${esc(b.title)}</h3><p>${esc(b.description)}</p></div>`
        )
        .join('')}
    </div>
  </div>
</section>`
    : ''
}

${
  S.about && config.about?.text
    ? `<section>
  <div class="wrap about">
    <h2>${esc(config.about.title || 'The Story')}</h2>
    <p>${esc(config.about.text)}</p>
  </div>
</section>`
    : ''
}

${
  S.bonuses && has(config.bonuses)
    ? `<section class="alt">
  <div class="wrap">
    <h2>Free Bonuses</h2>
    <p class="lead">Included when you get it today.</p>
    <div class="grid g3">
      ${config.bonuses
        .map(
          (b) => `<div class="card bonus">
        <span class="val">${esc(b.value)} value</span>
        <h3>${esc(b.title)}</h3>
        <p>${esc(b.description)}</p>
      </div>`
        )
        .join('')}
    </div>
  </div>
</section>`
    : ''
}

${
  S.testimonials && has(config.testimonials)
    ? `<section>
  <div class="wrap">
    <h2>What People Say</h2>
    <p class="lead">Feedback from readers.</p>
    <div class="grid g3">
      ${config.testimonials
        .map(
          (t) => `<div class="card">
        <div class="stars">★★★★★</div>
        <p class="quote">"${esc(t.quote)}"</p>
        <div class="who">
          <div class="av">${esc((t.name || '?').charAt(0).toUpperCase())}</div>
          <div><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></div>
        </div>
      </div>`
        )
        .join('')}
    </div>
  </div>
</section>`
    : ''
}

${
  S.pricing && has(config.pricing?.plans)
    ? `<section class="alt">
  <div class="wrap">
    <h2>Simple Pricing</h2>
    <p class="lead">Pick the option that fits you.</p>
    <div class="grid g3">
      ${config.pricing.plans
        .map(
          (p) => `<div class="plan${p.highlighted ? ' hot' : ''}">
        ${p.highlighted ? '<span class="tag">Most Popular</span>' : ''}
        <h3>${esc(p.name)}</h3>
        <div class="price">${esc(p.price)}${p.original_price ? `<span class="was">${esc(p.original_price)}</span>` : ''}</div>
        <p style="color:var(--muted);font-size:14px">${esc(p.tagline)}</p>
        <ul>${(p.features ?? []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <a class="btn btn-p" href="${cta}">${esc(config.cta_primary)}</a>
      </div>`
        )
        .join('')}
    </div>
  </div>
</section>`
    : ''
}

${
  S.guarantee && config.guarantee?.text
    ? `<section>
  <div class="wrap">
    <div class="guar">
      <div class="seal">${icon('shield')}</div>
      <h2 style="font-size:26px">${esc(config.guarantee.title)}</h2>
      <p>${esc(config.guarantee.text)}</p>
    </div>
  </div>
</section>`
    : ''
}

${
  S.faq && has(config.faq)
    ? `<section class="alt">
  <div class="wrap" style="max-width:820px">
    <h2>Questions</h2>
    <p class="lead">Everything people usually ask.</p>
    ${config.faq
      .map(
        (f) => `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`
      )
      .join('')}
  </div>
</section>`
    : ''
}

${
  S.finalCta
    ? `<section class="final">
  <div class="wrap">
    <h2>${esc(config.headline)}</h2>
    <p>${esc(config.footer_note)}</p>
    <a class="btn btn-p" style="background:#fff;color:var(--p);box-shadow:0 12px 28px -10px rgba(0,0,0,.4)" href="${cta}">${esc(config.cta_primary)}</a>
  </div>
</section>`
    : ''
}

<footer>
  <div class="wrap">© ${new Date().getFullYear()} ${esc(config.brand)}. All rights reserved.</div>
</footer>

</body>
</html>`
}

/** Simple thank-you / delivery page that pairs with the landing page. */
export function renderThankYouPage(
  config: LandingConfig,
  args: RenderArgs = {},
  downloadUrl = '#'
): string {
  const primary = safeColor(args.theme?.primary ?? config.theme?.primary, '#4f46e5')
  const accent = safeColor(args.theme?.accent ?? config.theme?.accent, '#a21caf')
  const font = FONT_STACKS[args.theme?.font ?? 'sans']
  const radius = args.theme?.radius ?? 16

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thank You — ${esc(config.brand)}</title>
<meta name="robots" content="noindex">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:${font};background:linear-gradient(135deg,${primary},${accent});min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;color:#0f172a}
.card{background:#fff;border-radius:${radius + 8}px;max-width:640px;width:100%;padding:52px 40px;text-align:center;box-shadow:0 30px 60px -20px rgba(0,0,0,.4)}
.tick{width:82px;height:82px;border-radius:999px;background:linear-gradient(135deg,${primary},${accent});display:flex;align-items:center;justify-content:center;margin:0 auto 26px}
.tick svg{width:40px;height:40px;stroke:#fff;stroke-width:3;fill:none}
h1{font-size:32px;font-weight:800;margin-bottom:12px}
p{color:#64748b;font-size:17px;margin-bottom:28px}
.btn{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,${primary},${accent});color:#fff;padding:16px 36px;border-radius:${radius - 4}px;font-weight:700;text-decoration:none;font-size:16px}
.steps{text-align:left;margin-top:36px;border-top:1px solid #e2e8f0;padding-top:28px}
.steps h3{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:16px}
.step{display:flex;gap:14px;margin-bottom:14px;align-items:flex-start}
.n{width:26px;height:26px;border-radius:999px;background:${primary};color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step p{margin:0;font-size:15px;color:#334155}
</style>
</head>
<body>
<div class="card">
  <div class="tick"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
  <h1>Thank you for your order!</h1>
  <p>Your copy of <strong>${esc(config.brand)}</strong> is ready. Click below to download it right now.</p>
  <a class="btn" href="${esc(downloadUrl)}">Download ${esc(config.brand)}</a>
  <div class="steps">
    <h3>What happens next</h3>
    <div class="step"><span class="n">1</span><p>Download your files using the button above.</p></div>
    <div class="step"><span class="n">2</span><p>Check your email — we have also sent the download link there.</p></div>
    <div class="step"><span class="n">3</span><p>Need help? Just reply to that email and we will sort it out.</p></div>
  </div>
</div>
</body>
</html>`
}
