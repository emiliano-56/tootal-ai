/**
 * Autoresponder adapter contract.
 *
 * Nine providers with nine different APIs — some REST with a bearer token,
 * some basic auth, one with a datacentre baked into the key. Each adapter
 * normalises to this shape so the lead pipeline never branches on provider.
 *
 * Pure types plus a shared result shape: no network code here, so the contract
 * can be tested without hitting any provider.
 */

export type AutoresponderProvider =
  | 'getresponse'
  | 'emailoctopus'
  | 'aweber'
  | 'mailchimp'
  | 'brevo'
  | 'convertkit'
  | 'mailerlite'
  | 'constantcontact'
  | 'sendfox'

export interface Subscriber {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  tags?: string[]
  /** Provider-specific extras, merged into the payload where supported. */
  fields?: Record<string, string>
}

export interface Connection {
  provider: AutoresponderProvider
  apiKey: string
  apiSecret?: string | null
  /** List / audience / form id, depending on the provider's vocabulary. */
  listId?: string | null
  extra?: Record<string, unknown>
}

export interface PushResult {
  ok: boolean
  /** True when the provider reported the address was already subscribed. */
  alreadySubscribed?: boolean
  providerId?: string
  error?: string
  /** HTTP status, kept for diagnosing auth vs validation failures. */
  status?: number
}

export interface ListSummary {
  id: string
  name: string
}

export interface Adapter {
  provider: AutoresponderProvider
  label: string
  /** What the connection form should ask for. */
  fields: {
    apiKey: { label: string; hint?: string }
    apiSecret?: { label: string; hint?: string }
    listId: { label: string; hint?: string; required: boolean }
  }
  /** Credentials valid? Used by the Test button. */
  verify(connection: Connection): Promise<PushResult>
  /** Fetch the lists so the console can offer a picker instead of a raw id. */
  lists(connection: Connection): Promise<{ ok: boolean; lists?: ListSummary[]; error?: string }>
  /** Add or update one subscriber. Must be idempotent. */
  push(connection: Connection, subscriber: Subscriber): Promise<PushResult>
}

/** Shared fetch wrapper: consistent timeouts and error shapes across adapters. */
export async function request(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 15_000)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()

    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
      error: response.ok ? undefined : describeError(body, response.status),
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'

    return {
      ok: false,
      status: 0,
      body: null,
      error: aborted ? 'Request timed out' : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

/** Pull a human-readable message out of whatever shape the provider returned. */
export function describeError(body: unknown, status: number): string {
  if (typeof body === 'string' && body.trim()) return body.slice(0, 300)

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>

    for (const key of ['message', 'error', 'detail', 'title', 'error_description', 'codeDescription']) {
      const value = record[key]
      if (typeof value === 'string' && value) return value
    }

    // Constant Contact and AWeber return arrays of errors.
    const list = record.errors ?? record.error_list
    if (Array.isArray(list) && list.length > 0) {
      const first = list[0] as Record<string, unknown>
      const message = first?.message ?? first?.error_message ?? first?.error
      if (typeof message === 'string') return message
    }
  }

  return `HTTP ${status}`
}

/** Split a display name the way most providers expect first/last. */
export function nameParts(subscriber: Subscriber): { first: string; last: string } {
  return { first: subscriber.firstName ?? '', last: subscriber.lastName ?? '' }
}
