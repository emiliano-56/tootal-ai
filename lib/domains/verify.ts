import 'server-only'

import { promises as dns } from 'node:dns'
import { normaliseHost, txtRecordName } from '@/lib/domains/records'

export { normaliseHost, txtRecordName, isApexDomain, TXT_PREFIX } from '@/lib/domains/records'

/**
 * Live DNS verification for mapped domains.
 *
 * Two records have to line up before a domain is usable:
 *
 *   CNAME  portal.customer.com        → our host   (routes the traffic)
 *   TXT    _comictale.portal.customer → the token  (proves ownership)
 *
 * The TXT check is the one that matters for security: without it, anyone
 * could point a CNAME at us and claim a domain that resolves to someone
 * else's branded portal.
 */

export interface RecordCheck {
  found: boolean
  values: string[]
  matches: boolean
  error?: string
}

export interface DomainVerification {
  domain: string
  cname: RecordCheck
  txt: RecordCheck
  /** Both records correct — the domain can be approved. */
  verified: boolean
}

async function checkCname(domain: string, expectedTarget: string): Promise<RecordCheck> {
  try {
    const values = await dns.resolveCname(domain)
    const wanted = normaliseHost(expectedTarget)

    return {
      found: values.length > 0,
      values,
      matches: values.some((value) => normaliseHost(value) === wanted),
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code

    return {
      found: false,
      values: [],
      matches: false,
      // ENODATA means the name exists but has no CNAME — worth saying plainly,
      // because it usually means an A record was added instead.
      error:
        code === 'ENOTFOUND'
          ? 'Domain does not resolve yet'
          : code === 'ENODATA'
            ? 'No CNAME record found (an A record will not work here)'
            : String(code ?? error),
    }
  }
}

async function checkTxt(domain: string, token: string): Promise<RecordCheck> {
  try {
    // Each TXT answer is an array of strings that the resolver may have split.
    const records = await dns.resolveTxt(txtRecordName(domain))
    const values = records.map((parts) => parts.join(''))

    return {
      found: values.length > 0,
      values,
      matches: values.some((value) => value.trim() === token),
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code

    return {
      found: false,
      values: [],
      matches: false,
      error:
        code === 'ENOTFOUND' || code === 'ENODATA'
          ? 'Verification TXT record not found'
          : String(code ?? error),
    }
  }
}

export async function verifyDomain(
  domain: string,
  token: string,
  expectedTarget: string
): Promise<DomainVerification> {
  const host = normaliseHost(domain)

  const [cname, txt] = await Promise.all([
    checkCname(host, expectedTarget),
    checkTxt(host, token),
  ])

  return { domain: host, cname, txt, verified: cname.matches && txt.matches }
}

