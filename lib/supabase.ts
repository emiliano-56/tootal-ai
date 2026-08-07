/**
 * Browser Supabase client — compatibility re-export.
 *
 * The real client moved to `lib/supabase/client.ts` when sessions were
 * switched from localStorage to cookies, so that middleware and server
 * components can read the same session. This file stays so the existing
 * `@/lib/supabase` and `@/lib/db` imports keep working unchanged.
 *
 * New code should import from '@/lib/supabase/client' (browser) or
 * '@/lib/supabase/server' (server components and route handlers).
 */

export { supabase, createClient } from './supabase/client'
