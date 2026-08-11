import { NextRequest, NextResponse } from 'next/server'
import { completeJson, AiError } from '@/lib/ai/deepseek'
import { promptDirective } from '@/lib/i18n/languages'
import { loadCast } from '@/lib/characters/server'
import { castDirective, referenceImages } from '@/lib/characters/cast'

/**
 * Story-to-Comic Agent — the writing half.
 *
 * Produces the story, characters and a full panel breakdown including dialogue
 * and where each speech bubble should sit. Image generation happens on the
 * client afterwards so long runs never hit a serverless timeout.
 */

export interface ComicScript {
  title: string
  logline: string
  story: string
  characters: { name: string; description: string; appearance: string }[]
  pages: {
    page_number: number
    scene_title: string
    scene_summary: string
    panels: {
      panel_number: number
      image_prompt: string
      dialogues: {
        speaker: string
        text: string
        /** Normalised 0-1 position of the bubble within the panel. */
        x: number
        y: number
        type: 'speech' | 'thought' | 'caption'
      }[]
    }[]
  }[]
}

const SYSTEM = `You are a professional comic book writer and storyboard artist.

Produce a complete comic script. Return JSON EXACTLY in this shape:
{
  "title": "",
  "logline": "one sentence",
  "story": "the full prose story",
  "characters": [{ "name": "", "description": "personality and role", "appearance": "detailed, consistent visual description" }],
  "pages": [{
    "page_number": 1,
    "scene_title": "",
    "scene_summary": "",
    "panels": [{
      "panel_number": 1,
      "image_prompt": "detailed image prompt: subject, action, camera angle, lighting, environment, art style, quality",
      "dialogues": [{ "speaker": "", "text": "", "x": 0.2, "y": 0.12, "type": "speech" }]
    }]
  }]
}

Rules:
- Every image_prompt must restate the character's appearance so the art stays consistent between panels. Never write "the same character as before".
- x and y are 0-1 fractions positioning the bubble inside the panel. Keep bubbles clear of the centre subject: prefer y between 0.08-0.25 (top) or 0.72-0.9 (bottom).
- Max 2 dialogues per panel. Keep each under 90 characters.
- "caption" type is for narration boxes.
- Plain text only, no markdown.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

  // Empty for English, so the existing prompt is unchanged.
  const language = String(body?.language ?? 'en')

    const idea = String(body?.idea ?? '').trim()
    const pages = Math.min(Math.max(Number(body?.pages ?? 4), 1), 12)
    const panelsPerPage = Math.min(Math.max(Number(body?.panelsPerPage ?? 4), 1), 6)
    const style = String(body?.style ?? 'Modern comic book').trim()
    const audience = String(body?.audience ?? 'All ages').trim()
    const mood = String(body?.mood ?? 'Adventurous').trim()

    if (!idea) {
      return NextResponse.json({ error: 'Story idea is required' }, { status: 400 })
    }

    // A cast the customer picked in Character Studio. Read from the database
    // rather than trusted off the request, because these become instructions
    // in a prompt and the ids are the only part the browser should choose.
    const cast = await loadCast(body?.characterIds)
    const references = referenceImages(cast)

    const script = await completeJson<ComicScript>({
      // Story, dialogue and captions translate. `image_prompt` and the
      // character `appearance` both go to the image model, so both stay
      // English — otherwise the art stops matching the story it illustrates.
      system:
        SYSTEM +
        promptDirective(language, { keepEnglish: ['image_prompt', 'appearance'] }) +
        castDirective(cast, references.length > 0),
      prompt: `Idea: ${idea}
Art style: ${style}
Audience: ${audience}
Mood: ${mood}
Pages: exactly ${pages}
Panels per page: exactly ${panelsPerPage}
Story length: about ${pages * 120} words.`,
      temperature: 0.9,
      maxTokens: 8000,
    })

    // Guard against the model returning a different shape than requested.
    if (!Array.isArray(script?.pages) || script.pages.length === 0) {
      return NextResponse.json(
        { error: 'AI did not return any comic pages. Try again.' },
        { status: 502 }
      )
    }

    // The reference URLs ride back with the script so the browser can attach
    // them to each panel request. Sent from here rather than looked up in the
    // client, so the browser never has to be trusted with which pictures
    // belong to which account.
    return NextResponse.json({ ...script, references, cast: cast.map((c) => c.name) })
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[comic-script] error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
