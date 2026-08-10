import { NextRequest, NextResponse } from 'next/server'
import { completeJson, AiError } from '@/lib/ai/deepseek'
import { getSessionContext } from '@/lib/supabase/server'
import { normaliseDirection, fallbackDirection, fitToLength, MIN_SHOT, MAX_SHOT } from '@/lib/video/director'
import { promptDirective, languageName } from '@/lib/i18n/languages'

/**
 * Directing a comic, rather than putting effects on it.
 *
 * Comic-to-Video used to ask the customer to pick "Zoom In" from a dropdown
 * for each panel and type a prompt by hand. Nothing read the comic, so nothing
 * knew that a quiet page wants to linger and a chase wants to cut — which is
 * the whole difference between a video and a slideshow.
 *
 * The model is given the panels in order, with whatever text each one carries,
 * and returns a shot list: hold times, camera moves with a reason, narration,
 * and how the whole thing should sound. Falling back to one shot per panel
 * when it cannot answer, which is exactly what the feature did before — so the
 * worst case is never worse than the old behaviour.
 */

const SYSTEM = `You direct short videos made from comic panels.

Return JSON exactly in this shape:
{
  "title": "",
  "treatment": "one line on how the whole thing should feel",
  "music_mood": "two or three words",
  "voice_style": "two or three words",
  "shots": [
    {
      "panel": 0,
      "seconds": 4,
      "move": "zoom-in",
      "intent": "why this move, in a few words",
      "narration": "what the voice says over this shot",
      "transition": "cut"
    }
  ]
}

Rules:
- "panel" is a ZERO-BASED index into the panels you were given.
- "move" is one of: zoom-in, zoom-out, pan-left, pan-right, pan-up, pan-down.
- "transition" is "cut" or "dissolve".
- "seconds" is between ${MIN_SHOT} and ${MAX_SHOT}.

Direct it properly. Pacing carries the story:
- A panel that establishes a place wants a slow zoom-out and a longer hold.
- A reaction or a punchline wants a short hold and a hard cut.
- A quiet or sad beat wants a dissolve and time to sit.
- Push in on emotion. Pull out on scale. Pan along movement, in the direction
  the action travels.
- Do not use the same move twice in a row.
- Narration is read aloud by one voice. Do not narrate what the picture already
  shows — say the thing the picture cannot.
- You may give one panel two shots, or skip a panel that adds nothing.`

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)

  const panels = Array.isArray(body?.panels) ? body.panels : []

  if (panels.length === 0) {
    return NextResponse.json({ error: 'No panels to work from' }, { status: 400 })
  }

  if (panels.length > 60) {
    return NextResponse.json(
      { error: 'That is more panels than one video should hold — split it up.' },
      { status: 400 }
    )
  }

  const language = String(body?.language ?? 'en')
  const targetSeconds = Number(body?.targetSeconds) || 0

  const described = panels
    .map((panel: Record<string, unknown>, index: number) => {
      const caption = String(panel?.caption ?? panel?.text ?? '').slice(0, 400)
      const scene = String(panel?.scene ?? '').slice(0, 200)

      return `Panel ${index}: ${scene || '(no scene note)'}${caption ? `\n  Text: ${caption}` : ''}`
    })
    .join('\n')

  try {
    const raw = await completeJson({
      system: SYSTEM + promptDirective(language),
      prompt: `Title: ${String(body?.title ?? 'Untitled comic').slice(0, 200)}
Audience: ${String(body?.audience ?? 'children').slice(0, 100)}
Mood: ${String(body?.mood ?? 'warm').slice(0, 100)}
Narration language: ${languageName(language)}
${targetSeconds > 0 ? `Target length: about ${targetSeconds} seconds.` : ''}

The panels, in order:
${described}`,
      temperature: 0.7,
      maxTokens: 3000,
    })

    const direction = normaliseDirection(raw, panels.length)

    if (!direction) {
      // The model answered with something unusable. One shot per panel is
      // still a video, and it is what this feature produced before.
      return NextResponse.json({
        direction: fallbackDirection(panels, String(body?.title ?? 'Your comic')),
        fellBack: true,
        reason: 'The director could not be read, so an even-paced cut was used.',
      })
    }

    return NextResponse.json({
      direction: targetSeconds > 0 ? fitToLength(direction, targetSeconds) : direction,
      fellBack: false,
    })
  } catch (error) {
    const message =
      error instanceof AiError ? error.message : error instanceof Error ? error.message : String(error)

    console.error('[video-director] failed:', message)

    // Never leave the customer with nothing: the fallback is the old
    // behaviour, so the feature still works when the model is down.
    return NextResponse.json({
      direction: fallbackDirection(panels, String(body?.title ?? 'Your comic')),
      fellBack: true,
      reason: `The director is unavailable (${message}), so an even-paced cut was used.`,
    })
  }
}

export const dynamic = 'force-dynamic'
export const maxDuration = 120
