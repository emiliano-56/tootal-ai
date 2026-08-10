import { NextRequest, NextResponse } from 'next/server'
import { completeJson, AiError } from '@/lib/ai/deepseek'
import { promptDirective } from '@/lib/i18n/languages'

/**
 * Turns comic pages into short cinematic video prompts.
 *
 * The video backend takes a text prompt, so each page needs a description of
 * what should *move* in that shot rather than a static scene description.
 */

interface ScenePromptResult {
  scenes: { prompt: string; caption: string }[]
}

const SYSTEM = `You are a storyboard director adapting comic pages into short video shots.

For each page you are given, write ONE cinematic video prompt describing motion:
camera movement, character action, lighting, atmosphere and art style. The prompt
must describe a moving shot, not a still image.

Also write a short on-screen caption (max 12 words) for that shot.

Return JSON exactly like:
{ "scenes": [{ "prompt": "...", "caption": "..." }] }

Return exactly one entry per page, in the same order. Plain text only.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    // Empty for English, so the existing prompt is unchanged.
    const language = String(body?.language ?? 'en')

    const pages: string[] = Array.isArray(body?.pages) ? body.pages : []
    const story = String(body?.story ?? '').trim()
    const style = String(body?.style ?? 'cinematic comic book').trim()

    if (pages.length === 0 && !story) {
      return NextResponse.json(
        { error: 'Provide page descriptions or a story summary.' },
        { status: 400 }
      )
    }

    const count = Math.min(Math.max(pages.length || 5, 1), 20)

    const result = await completeJson<ScenePromptResult>({
      // The caption is burned onto the screen and must be readable; the prompt
      // goes to the video model and must not be.
      system: SYSTEM + promptDirective(language, { keepEnglish: ['prompt'] }),
      prompt: [
        story && `Story: ${story}`,
        `Art style: ${style}`,
        `Number of shots: exactly ${count}`,
        pages.length > 0
          ? `Pages:\n${pages.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
          : 'No page text supplied — invent a coherent shot list from the story.',
      ]
        .filter(Boolean)
        .join('\n'),
      temperature: 0.85,
      maxTokens: 3000,
    })

    if (!Array.isArray(result?.scenes) || result.scenes.length === 0) {
      return NextResponse.json({ error: 'AI returned no scenes.' }, { status: 502 })
    }

    return NextResponse.json({ scenes: result.scenes.slice(0, count) })
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[scene-prompts] error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
