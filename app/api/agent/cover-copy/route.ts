import { NextRequest, NextResponse } from 'next/server'
import { completeJson, AiError } from '@/lib/ai/deepseek'

/** Cover Designer — the copy half (title, subtitle, blurb, art direction). */

export interface CoverCopy {
  title: string
  subtitle: string
  tagline: string
  back_blurb: string
  bullets: string[]
  spine_text: string
  art_prompt: string
  theme: { primary: string; accent: string; text: string }
}

const SYSTEM = `You art-direct and copywrite comic book covers.

Return JSON EXACTLY in this shape:
{
  "title": "punchy book title, max 4 words",
  "subtitle": "supporting line, max 8 words",
  "tagline": "front cover hook, max 10 words",
  "back_blurb": "back cover description, 60-90 words",
  "bullets": ["3 short selling points for the back cover"],
  "spine_text": "title and author for the spine",
  "art_prompt": "detailed image prompt for the cover artwork: subject, composition with clear empty space at top and bottom for text, lighting, mood, art style, quality. No text or lettering in the image.",
  "theme": { "primary": "#hex", "accent": "#hex", "text": "#hex that is readable on primary" }
}

The art_prompt MUST ask for no text/letters/words in the image, since the title is drawn over it.
Plain text only, no markdown.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    const idea = String(body?.idea ?? '').trim()
    const author = String(body?.author ?? '').trim()
    const genre = String(body?.genre ?? '').trim()

    if (!idea) {
      return NextResponse.json({ error: 'Book idea or title is required' }, { status: 400 })
    }

    const copy = await completeJson<CoverCopy>({
      system: SYSTEM,
      prompt: [`Book: ${idea}`, genre && `Genre: ${genre}`, author && `Author: ${author}`]
        .filter(Boolean)
        .join('\n'),
      temperature: 0.85,
      maxTokens: 1600,
    })

    return NextResponse.json(copy)
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[cover-copy] error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
