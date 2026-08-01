import { createClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client.
 *
 * The anon key is safe to expose (it is protected by Row Level Security), but it
 * still comes from the environment so every credential lives in one place.
 * Copy .env.example to .env.local to configure it.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Add NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
