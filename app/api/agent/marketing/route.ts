import { NextRequest, NextResponse } from 'next/server'
import { completeJson, AiError } from '@/lib/ai/deepseek'
import { promptDirective } from '@/lib/i18n/languages'

/** Marketing Content Agent — every promo asset for a product, in one pass. */

export interface MarketingOutput {
  positioning: string
  facebook_ads: { headline: string; primary_text: string; cta: string }[]
  google_ads: { headline: string; description: string }[]
  instagram: string[]
  twitter: string[]
  linkedin: string[]
  email_sequence: { day: number; subject: string; body: string }[]
  blog_article: { title: string; body: string }
  seo: { meta_title: string; meta_description: string; keywords: string[] }
  product_description: string
  sales_copy: string
}

const SYSTEM = `You are a direct-response marketer for digital products (comics, ebooks, coloring books).

Write copy that is specific, benefit-led and free of clichés. Never use placeholder text.

Return JSON with EXACTLY this shape:
{
  "positioning": "one paragraph on the angle and who it is for",
  "facebook_ads": [{ "headline": "", "primary_text": "", "cta": "" }],
  "google_ads": [{ "headline": "max 30 chars", "description": "max 90 chars" }],
  "instagram": ["caption with hashtags"],
  "twitter": ["post under 280 chars"],
  "linkedin": ["professional post"],
  "email_sequence": [{ "day": 1, "subject": "", "body": "" }],
  "blog_article": { "title": "", "body": "600+ words, plain text paragraphs" },
  "seo": { "meta_title": "max 60 chars", "meta_description": "max 155 chars", "keywords": [] },
  "product_description": "sales-ready description",
  "sales_copy": "long-form sales copy with a clear offer and close"
}

Counts: 3 facebook_ads, 3 google_ads, 4 instagram, 4 twitter, 2 linkedin, 5 email_sequence (days 1,2,3,5,7), 8 keywords.
Plain text only — no markdown symbols.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

  // Empty for English, so the existing prompt is unchanged.
  const language = String(body?.language ?? 'en')

    const product = String(body?.product ?? '').trim()
    const audience = String(body?.audience ?? '').trim()
    const niche = String(body?.niche ?? '').trim()
    const price = String(body?.price ?? '').trim()

    if (!product) {
      return NextResponse.json({ error: 'Product name or idea is required' }, { status: 400 })
    }

    const output = await completeJson<MarketingOutput>({
      system: SYSTEM + promptDirective(language),
      prompt: [
        `Product: ${product}`,
        audience && `Target audience: ${audience}`,
        niche && `Niche: ${niche}`,
        price && `Price: ${price}`,
      ]
        .filter(Boolean)
        .join('\n'),
      temperature: 0.85,
      maxTokens: 6000,
    })

    return NextResponse.json(output)
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[marketing] error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
