import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Admin Supabase client — bypasses Row Level Security.
 *
 * Server-side only. The `server-only` import makes the build fail if this is
 * ever pulled into a client component, which would leak the service role key
 * to the browser.
 */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  'https://xcsbwpagpvixxwupnmwn.supabase.co'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseServiceKey) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local and restart the server.'
  )
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
