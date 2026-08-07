'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client.
 *
 * Sessions live in cookies rather than localStorage so that middleware, server
 * components and route handlers can all read the same session. Without this the
 * server has no idea who is signed in, and role guards cannot be enforced
 * anywhere except in the browser — where they can simply be edited away.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Add NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.'
  )
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export function createClient() {
  return supabase
}
