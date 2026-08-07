import { NextRequest, NextResponse } from 'next/server'
import { complete, AiError } from '@/lib/ai/deepseek'

/**
 * Book generation endpoint.
 *
 * Goes through lib/ai/deepseek, which resolves the key from the
 * `api_credentials` table (managed under Superadmin → AI Providers), falls
 * through the provider chain on failure, and records usage. No key is read or
 * held here.
 */

const SYSTEM_PROMPT =
  'You are a professional Amazon KDP book generator. Your output must be structured using ONLY plain text. ' +
  'Use numbered headings like: 1. Title, 2. Description, 3. Chapter Outline, 4. Chapter 1. ' +
  'Do NOT use Markdown (#, **, *, or ---). Do not add emojis. Ensure formatting is clean and publication-ready.'

export async function POST(request: NextRequest) {
  try {
    const { prompt, chapters, niches } = await request.json()

    if (!prompt || !chapters || !niches) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const bookPrompt = `Create a detailed outline and first chapter for a book with the following specifications:

Title Concept: ${prompt}
Number of Chapters: ${chapters}
Niches/Genres: ${niches}

Please provide:
1. Book title suggestion
2. Brief description (2-3 sentences)
3. Chapter outline for all ${chapters} chapters
4. Full text of Chapter 1 (approximately 500-1000 words)

Format the response clearly with headers and sections.`

    const content = await complete({
      system: SYSTEM_PROMPT,
      prompt: bookPrompt,
      temperature: 0.8,
      maxTokens: 4000,
    })

    return NextResponse.json({ content })
  } catch (error) {
    console.error('[BOOK API ERROR]:', error)

    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
