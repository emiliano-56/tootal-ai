/**
 * Reading a payment notification.
 *
 * launchpadjv.com posts a form or a JSON body when someone buys. Which keys
 * carry the email, the product and the transaction type is configuration
 * rather than code: vendors rename fields, and a rename should be a settings
 * edit rather than a release.
 *
 * Pure so the whole intake can be tested without a webhook or a database.
 */

export interface IpnFieldMap {
  email: string
  name: string
  product: string
  transaction: string
  event: string
}

export interface IpnRules {
  fields: IpnFieldMap
  saleEvents: string[]
  refundEvents: string[]
}

export type IpnAction = 'sale' | 'refund' | 'ignore'

export interface ParsedIpn {
  action: IpnAction
  email: string
  firstName: string
  productId: string
  transactionId: string
  eventType: string
  reason?: string
}

/**
 * Pull a value out of a payload, tolerating the shapes vendors actually send.
 *
 * Keys are matched without case or punctuation because the same field arrives
 * as `customer_email`, `CustomerEmail` and `customer-email` depending on who
 * built the integration. A dotted path reaches into a nested object.
 */
export function readField(payload: Record<string, unknown>, key: string): string {
  if (!key) return ''

  if (key.includes('.')) {
    let cursor: unknown = payload

    for (const part of key.split('.')) {
      if (!cursor || typeof cursor !== 'object') return ''
      cursor = (cursor as Record<string, unknown>)[part]
    }

    return scalar(cursor)
  }

  if (key in payload) return scalar(payload[key])

  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const wanted = normalise(key)

  for (const [candidate, value] of Object.entries(payload)) {
    if (normalise(candidate) === wanted) return scalar(value)
  }

  return ''
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return ''

  return String(value).trim()
}

/** The first name to greet someone by, from whatever name field arrived. */
export function firstNameFrom(full: string, email: string): string {
  const trimmed = full.trim()

  if (trimmed) return trimmed.split(/\s+/)[0]

  const local = email.split('@')[0] ?? ''

  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there'
}

/**
 * What the platform should do about one notification.
 *
 * Anything that is not a recognised sale or refund is ignored rather than
 * guessed at: a rebill notice that got treated as a sale would create a
 * duplicate account, and one treated as a refund would close a paying one.
 */
export function parseIpn(payload: Record<string, unknown>, rules: IpnRules): ParsedIpn {
  const email = readField(payload, rules.fields.email).toLowerCase()
  const productId = readField(payload, rules.fields.product)
  const eventType = readField(payload, rules.fields.event)

  const parsed: ParsedIpn = {
    action: 'ignore',
    email,
    firstName: firstNameFrom(readField(payload, rules.fields.name), email),
    productId,
    transactionId: readField(payload, rules.fields.transaction),
    eventType,
  }

  const matches = (list: string[]) =>
    list.some((candidate) => candidate.toLowerCase() === eventType.toLowerCase())

  // An empty event field means the vendor only posts sales.
  if (!eventType || matches(rules.saleEvents)) parsed.action = 'sale'
  else if (matches(rules.refundEvents)) parsed.action = 'refund'
  else parsed.reason = `Event "${eventType}" is neither a sale nor a refund`

  if (parsed.action !== 'ignore') {
    if (!email || !email.includes('@')) {
      parsed.action = 'ignore'
      parsed.reason = 'No usable email address in the payload'
    } else if (!productId) {
      parsed.action = 'ignore'
      parsed.reason = 'No product id in the payload'
    }
  }

  return parsed
}

/**
 * Every tier to grant for a purchase, including the ones beneath it.
 *
 * The funnel only shows an upsell to someone who has already bought what came
 * before, so an OTO 2 notification means the customer owns Front End and
 * OTO 1 whether or not those notifications reached us. Granting the chain
 * makes a missed or out-of-order post self-healing instead of leaving an
 * account that the database will refuse to complete.
 *
 * A bundle is granted alone — it already expands to everything.
 */
export function chainFor(
  code: string,
  catalogue: { code: string; tier?: string; requires?: string | null; isBundle: boolean }[]
): string[] {
  const byCode = new Map(catalogue.map((plan) => [plan.code, plan]))
  const start = byCode.get(code)

  if (!start) return []
  if (start.isBundle) return [code]

  const chain = [code]
  let required = start.requires

  // Bounded by the catalogue size, so a circular `requires` cannot hang here.
  for (let step = 0; step < catalogue.length && required; step += 1) {
    const tier = required

    // Either licence size satisfies a tier; take the cheapest, since that is
    // the one a customer who never told us otherwise most likely bought.
    const options = catalogue.filter((plan) => !plan.isBundle && (plan.tier ?? plan.code) === tier)
    const pick = options.sort((a, b) => a.code.localeCompare(b.code))[0]

    if (!pick) break

    chain.unshift(pick.code)
    required = pick.requires
  }

  return chain
}

/** A first password for an account created by a purchase. */
export function generatePassword(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''

  for (let index = 0; index < 12; index += 1) {
    out += alphabet[Math.floor(random() * alphabet.length)]
  }

  // Guaranteed to satisfy the usual "must contain a symbol and a digit" rule.
  return `${out}#7`
}
