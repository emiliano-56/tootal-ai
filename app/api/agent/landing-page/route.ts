import { NextRequest, NextResponse } from 'next/server'
import { completeJson, AiError } from '@/lib/ai/deepseek'
import { promptDirective } from '@/lib/i18n/languages'

/** Landing Page Builder — structured sections, kept editable after generation. */

export interface LandingConfig {
  brand: string
  headline: string
  subheadline: string
  cta_primary: string
  cta_secondary: string
  hero_note: string
  urgency: string
  stats: { value: string; label: string }[]
  features: { title: string; description: string; icon: string }[]
  benefits: { title: string; description: string }[]
  about: { title: string; text: string }
  bonuses: { title: string; description: string; value: string }[]
  testimonials: { name: string; role: string; quote: string }[]
  guarantee: { title: string; text: string }
  faq: { question: string; answer: string }[]
  pricing: {
    plans: {
      name: string
      price: string
      original_price: string
      tagline: string
      features: string[]
      highlighted: boolean
    }[]
  }
  footer_note: string
  seo: { title: string; description: string }
  theme: { primary: string; accent: string }
}

const SYSTEM = `You write high-converting landing pages for digital products.

Return JSON EXACTLY in this shape:
{
  "brand": "short product name",
  "headline": "big benefit-driven headline, max 12 words",
  "subheadline": "one supporting sentence",
  "cta_primary": "e.g. Get Instant Access",
  "cta_secondary": "e.g. See What's Inside",
  "hero_note": "small reassurance line, e.g. Instant download. No subscription.",
  "urgency": "one short scarcity or urgency line",
  "stats": [{ "value": "20+", "label": "Pages" }],
  "features": [{ "title": "", "description": "", "icon": "one of: book, sparkles, palette, download, shield, zap, star, users, clock, gift" }],
  "benefits": [{ "title": "", "description": "" }],
  "about": { "title": "", "text": "2-3 sentences about who made this and why" },
  "bonuses": [{ "title": "", "description": "", "value": "$47" }],
  "testimonials": [{ "name": "", "role": "", "quote": "" }],
  "guarantee": { "title": "e.g. 30-Day Money-Back Guarantee", "text": "2 sentences" },
  "faq": [{ "question": "", "answer": "" }],
  "pricing": { "plans": [{ "name": "", "price": "$27", "original_price": "$97", "tagline": "", "features": [], "highlighted": false }] },
  "footer_note": "short closing line",
  "seo": { "title": "max 60 chars", "description": "max 155 chars" },
  "theme": { "primary": "#hex", "accent": "#hex" }
}

Counts: 4 stats, 6 features, 4 benefits, 3 bonuses, 3 testimonials, 6 faq, 3 pricing plans (exactly one highlighted).
Pick theme colours that suit the product's mood. Plain text only, no markdown.
Testimonials must read as realistic but clearly generic praise — do not invent real people or brands.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

  // Empty for English, so the existing prompt is unchanged.
  const language = String(body?.language ?? 'en')

    const product = String(body?.product ?? '').trim()
    const audience = String(body?.audience ?? '').trim()
    const price = String(body?.price ?? '').trim()

    if (!product) {
      return NextResponse.json({ error: 'Product name or idea is required' }, { status: 400 })
    }

    const config = await completeJson<LandingConfig>({
      system: SYSTEM + promptDirective(language),
      prompt: [
        `Product: ${product}`,
        audience && `Audience: ${audience}`,
        price && `Price: ${price}`,
      ]
        .filter(Boolean)
        .join('\n'),
      temperature: 0.85,
      maxTokens: 6000,
    })

    return NextResponse.json(config)
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[landing-page] error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
