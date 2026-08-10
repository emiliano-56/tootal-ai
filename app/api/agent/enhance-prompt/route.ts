import { NextRequest, NextResponse } from 'next/server'
import { completeJson, AiError } from '@/lib/ai/deepseek'
import { promptDirective } from '@/lib/i18n/languages'

/**
 * Prompt Enhancer agent.
 *
 * Expands a short prompt into a production-ready image prompt by adding the
 * details an image model needs: lighting, camera angle, character detail,
 * environment, art style and quality cues.
 */

interface EnhanceResult {
  enhanced: string
  added: {
    lighting?: string
    camera?: string
    character?: string
    environment?: string
    style?: string
    quality?: string
  }
}

const SYSTEM = `You are a prompt engineer for comic and illustration image models.

Given a short prompt, rewrite it as ONE richly detailed prompt. You must weave in:
- Lighting (direction, quality, colour, time of day)
- Camera angle / shot type (low angle, close-up, wide, dutch tilt...)
- Character details (clothing, expression, pose, age)
- Environment (setting, weather, background detail)
- Art style (the requested style, or a fitting comic/illustration style)
- Quality cues (ultra detailed, vibrant colours, 8K, sharp focus)

Rules:
- Keep the user's original subject and intent. Never change what the scene is about.
- The enhanced prompt must be a single flowing comma-separated description, 40-90 words.
- No markdown, no bullet points, no quotes around the prompt.

Return JSON exactly like:
{
  "enhanced": "the full enhanced prompt",
  "added": {
    "lighting": "short phrase",
    "camera": "short phrase",
    "character": "short phrase",
    "environment": "short phrase",
    "style": "short phrase",
    "quality": "short phrase"
  }
}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    // Empty for English, so the existing prompt is unchanged.
    const language = String(body?.language ?? 'en')
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    const style = typeof body?.style === 'string' ? body.style.trim() : ''

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: 'Prompt is too long (max 2000 characters).' },
        { status: 400 }
      )
    }

    const result = await completeJson<EnhanceResult>({
      // The whole point of this agent is the prompt itself, which the image
      // model reads — so that one field stays English. The `added` phrases are
      // shown to the customer as "what was added", and those do translate.
      system: SYSTEM + promptDirective(language, { keepEnglish: ['enhanced'] }),
      prompt: style
        ? `Prompt: ${prompt}\nPreferred art style: ${style}`
        : `Prompt: ${prompt}`,
      temperature: 0.8,
      maxTokens: 700,
    })

    if (!result?.enhanced) {
      return NextResponse.json(
        { error: 'AI did not return an enhanced prompt.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      enhanced: result.enhanced,
      added: result.added ?? {},
    })
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[enhance-prompt] error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
