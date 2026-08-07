import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { normaliseSiteUrl, looksInternal } from '@/lib/settings/site-url'

/**
 * Reading the configured site URL.
 *
 * Cached in module scope for a minute. Every share link, OAuth redirect and
 * welcome email would otherwise cost a database round trip, and the value
 * changes about once in the life of an installation.
 */

let cached: { value: string | null; at: number } | null = null

const TTL_MS = 60_000

/** Forget the cache, so a save in the console takes effect at once. */
export function clearSiteUrlCache(): void {
  cached = null
}

async function configured(): Promise<string | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value

  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('value')
    .eq('key', 'site_url')
    .maybeSingle()

  // The column is jsonb, so a string arrives quoted.
  const raw = (data as { value: unknown } | null)?.value

  const value = normaliseSiteUrl(typeof raw === 'string' ? raw : null)

  cached = { value, at: Date.now() }

  return value
}

/**
 * The address to build links with.
 *
 * Falls back to the origin of the request that asked, so a fresh install works
 * before anyone visits Settings.
 */
export async function siteUrl(requestOrigin = ''): Promise<string> {
  const setting = await configured()

  if (setting) return setting

  const fallback = normaliseSiteUrl(requestOrigin)

  if (fallback && looksInternal(fallback)) {
    // Not an error in development, and not worth failing over in production —
    // but worth saying once, because the symptom (customers receiving links to
    // localhost) is baffling if you have not seen it before.
    console.warn(
      `[site-url] building links from "${fallback}". Set Site URL under Superadmin → Settings to fix links in emails and shares.`
    )
  }

  return fallback ?? ''
}

/** The site URL with a path already joined on. */
export async function siteLink(path: string, requestOrigin = ''): Promise<string> {
  const base = await siteUrl(requestOrigin)

  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * The address to show a particular tenant's customers.
 *
 * This is where Site URL and the Domains screen meet, and they answer two
 * different questions:
 *
 *   - Site URL is the platform's own address. There is one, and it is what
 *     OAuth redirect URIs and the payment processor's webhook must use,
 *     because those are registered once with an outside service.
 *
 *   - A mapped domain belongs to a white label. It is what *their* customers
 *     see. Handing one of their share links an address on the platform's
 *     domain would put our brand on their work, which is the one thing white
 *     label is sold to prevent.
 *
 * So links a customer sees use the tenant's domain when there is a live one,
 * and everything registered with a third party keeps using `siteUrl`.
 */
export async function tenantSiteUrl(
  tenantId: string | null | undefined,
  requestOrigin = ''
): Promise<string> {
  const platform = await siteUrl(requestOrigin)

  if (!tenantId) return platform

  const { data } = await supabaseAdmin
    .from('custom_domains')
    .select('domain')
    .eq('tenant_id', tenantId)
    .eq('purpose', 'portal')
    // Both flags matter: verified means the DNS is right, approved means the
    // platform owner allowed it. An unapproved domain must not be advertised.
    .eq('verified', true)
    .eq('approved', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const domain = (data as { domain: string } | null)?.domain

  if (!domain) return platform

  return normaliseSiteUrl(domain) ?? platform
}
