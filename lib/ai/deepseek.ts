import 'server-only'

import { resolveCredentials, logApiUsage } from '@/lib/ai/credentials'

/**
 * Shared server-side LLM client.
 *
 * Every agent goes through this module so prompting, JSON parsing, retries and
 * error handling live in one place instead of being re-implemented per route.
 *
 * Keys come from the `api_credentials` table, managed in the superadmin
 * console, with the environment variable as a fallback. Nothing is hardcoded:
 * anything in source travels with the repo.
 */

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface CompleteOptions {
  system?: string
  prompt: string
  /** 0 = deterministic, 1 = creative. Defaults to 0.7. */
  temperature?: number
  maxTokens?: number
  /** Ask the model for strict JSON and parse it before returning. */
  json?: boolean
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number = 500
  ) {
    super(message)
    this.name = 'AiError'
  }
}

async function callDeepseek(
  messages: ChatMessage[],
  { temperature = 0.7, maxTokens = 2000, json = false }: Omit<CompleteOptions, 'prompt' | 'system'>
): Promise<string> {
  const credentials = await resolveCredentials('deepseek')

  if (credentials.length === 0) {
    throw new AiError(
      'No DeepSeek key configured. Add one under Superadmin → AI Providers.',
      500
    )
  }

  let lastError: AiError | null = null

  // Walk the failover chain: a dead or rate-limited key moves to the next one
  // rather than failing the whole job.
  for (const credential of credentials) {
    const startedAt = Date.now()

    try {
      const res = await fetch(credential.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credential.apiKey}`,
        },
        body: JSON.stringify({
          model: credential.model || 'deepseek-chat',
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new AiError(
          data?.error?.message || `AI request failed (HTTP ${res.status})`,
          res.status
        )
      }

      const content: string | undefined = data?.choices?.[0]?.message?.content

      if (!content) throw new AiError('AI returned an empty response.', 502)

      await logApiUsage({
        credentialId: credential.id,
        provider: 'deepseek',
        operation: json ? 'completeJson' : 'complete',
        latencyMs: Date.now() - startedAt,
        succeeded: true,
      })

      return content
    } catch (error) {
      lastError = error instanceof AiError ? error : new AiError(String(error), 502)

      await logApiUsage({
        credentialId: credential.id,
        provider: 'deepseek',
        operation: json ? 'completeJson' : 'complete',
        latencyMs: Date.now() - startedAt,
        succeeded: false,
        errorMessage: lastError.message,
      })
    }
  }

  throw lastError ?? new AiError('AI request failed.', 502)
}

/** Plain text completion. */
export async function complete(options: CompleteOptions): Promise<string> {
  const messages: ChatMessage[] = []

  if (options.system) messages.push({ role: 'system', content: options.system })
  messages.push({ role: 'user', content: options.prompt })

  return callDeepseek(messages, {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
}

/**
 * JSON completion. Models occasionally wrap JSON in prose or code fences, so the
 * raw text is salvaged before parsing rather than failing the whole job.
 */
export async function completeJson<T = unknown>(options: CompleteOptions): Promise<T> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        (options.system ? options.system + '\n\n' : '') +
        'Respond with valid JSON only. No markdown, no code fences, no commentary.',
    },
    { role: 'user', content: options.prompt },
  ]

  const raw = await callDeepseek(messages, {
    temperature: options.temperature ?? 0.6,
    maxTokens: options.maxTokens,
    json: true,
  })

  return parseJsonLoose<T>(raw)
}

/** Extracts a JSON object/array from a model response that may include extra text. */
export function parseJsonLoose<T = unknown>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Fall back to the outermost {...} or [...] block.
    const start = cleaned.search(/[[{]/)
    const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'))

    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T
      } catch {
        /* fall through */
      }
    }

    throw new AiError('AI returned malformed JSON.', 502)
  }
}
