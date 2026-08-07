import { NextRequest, NextResponse } from 'next/server'
import { complete, AiError } from '@/lib/ai/deepseek'

/**
 * Chat endpoint.
 *
 * Goes through lib/ai/deepseek, which resolves the key from the
 * `api_credentials` table (managed under Superadmin → AI Providers), falls
 * through the provider chain on failure, and records usage. No key is read or
 * held here.
 */

const SYSTEM_PROMPT =
  "You are a multilingual AI assistant for a SaaS platform. Always detect and respond in the user's language. " +
  'Output must be strictly plain text only. You are NOT allowed to use Markdown formatting symbols such as #, ##, *, **, ***, -, ' +
  'or any decorative formatting. Use only clean text with simple numbering for structure when necessary. ' +
  'Ensure responses are professional, readable, and ready for direct publishing use.'

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const response = await complete({
      system: SYSTEM_PROMPT,
      prompt: message,
      temperature: 0.7,
      maxTokens: 1000,
    })

    return NextResponse.json({ response })
  } catch (error) {
    console.error('[API ERROR]:', error)

    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
