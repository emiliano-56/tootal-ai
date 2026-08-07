import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { network } from '@/lib/social/networks'
import { verifyState, exchangeCode, loadApp } from '@/lib/social/oauth'
import { DRIVE_PLATFORM, exchangeDriveCode } from '@/lib/drive/client'
import { siteUrl } from '@/lib/settings/site-url.server'

/**
 * Coming back from a platform's consent screen.
 *
 * The customer is redirected here by Facebook or X, not by us, so nothing
 * about the request can be trusted except the signed `state` — which is the
 * only thing saying whose account this is. A forged one would attach a
 * stranger's social account to somebody else's login.
 *
 * Always redirects back to the app with a message rather than rendering JSON:
 * this is a browser navigation, and a customer who just clicked "Allow" should
 * land somewhere that makes sense.
 */

function back(origin: string, message: string, ok = false): NextResponse {
  const url = new URL('/connections', origin)

  url.searchParams.set(ok ? 'connected' : 'error', message)

  return NextResponse.redirect(url)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params
  const origin = await siteUrl(request.nextUrl.origin)
  const info = network(platform)
  const isDrive = platform === DRIVE_PLATFORM

  // Drive is not a social network, so it is not in that catalogue — but it
  // returns through the same callback and the same signed state.
  if (!info && !isDrive) return back(origin, 'Unknown platform')

  const search = request.nextUrl.searchParams

  // The customer pressed Cancel, or the platform refused.
  const denied = search.get('error_description') ?? search.get('error')

  if (denied) return back(origin, denied.slice(0, 200))

  const code = search.get('code')
  const state = search.get('state')

  if (!code || !state) return back(origin, 'The platform sent an incomplete reply')

  const verified = verifyState(state)

  if (!verified || verified.platform !== platform) {
    return back(origin, 'That authorisation link has expired — please try again')
  }

  const app = await loadApp(platform)
  const label = isDrive ? 'Google Drive' : info!.label

  if (!app?.client_id || !app.client_secret) {
    return back(origin, `${label} is not set up`)
  }

  try {
    const result = isDrive
      ? await exchangeDriveCode(origin, code)
      : await exchangeCode(platform as Parameters<typeof exchangeCode>[0], app, origin, code, state)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', verified.userId)
      .maybeSingle()

    const { error } = await supabaseAdmin.from('social_connections').upsert(
      {
        user_id: verified.userId,
        tenant_id: (profile as { tenant_id: string } | null)?.tenant_id ?? null,
        platform,
        // Empty rather than null: account_id is part of the unique key, and a
        // null there would never match on upsert.
        account_id: result.accountId ?? '',
        account_name: result.accountName,
        access_token: result.accessToken,
        refresh_token: result.refreshToken ?? null,
        expires_at: result.expiresAt ?? null,
        settings: 'settings' in result ? (result.settings ?? {}) : {},
        status: 'active',
        last_error: null,
      },
      { onConflict: 'user_id,platform,account_id' }
    )

    if (error) return back(origin, error.message.slice(0, 200))

    return back(origin, `${label} connected as ${result.accountName}`, true)
  } catch (error) {
    // The platform's own words are more useful than anything generic — they
    // say which permission is missing or which setting is wrong.
    return back(origin, (error instanceof Error ? error.message : String(error)).slice(0, 250))
  }
}

export const dynamic = 'force-dynamic'
