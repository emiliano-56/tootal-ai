import { redirect } from 'next/navigation'
import { DEFAULT_PORTAL } from '@/lib/auth/portals'

/**
 * Root now forwards to the default sign-in portal, so every sign-in page lives
 * at a named URL (/login, /superadmin, /reseller, /whitelabel) rather than one
 * of them being special-cased at `/`.
 *
 * Signed-in visitors never reach this: proxy.ts sends them to their own
 * console first.
 */

export default function RootPage() {
  redirect(DEFAULT_PORTAL.path)
}
