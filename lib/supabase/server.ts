import 'server-only'

import { cache } from 'react'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Role } from '@/lib/auth/rbac'
import { resolveRoleFromProfile } from '@/lib/auth/portals'

/** Seeded in migration 002; used as the fallback before tenancy exists. */
export const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Server-side Supabase client, scoped to the caller's cookies.
 *
 * Use this in server components and route handlers. It respects Row Level
 * Security, so a reseller reading `profiles` through it sees only their own
 * tenant — the isolation comes from the database, not from query filters we
 * have to remember to write.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Add NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the server.'
  )
}

export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a server component, where cookies are read-only.
          // Middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  })
}

export interface SessionContext {
  userId: string
  email: string | null
  role: Role
  tenantId: string
  status: 'active' | 'suspended' | 'pending'
  /**
   * This account's API-key override, straight off the profile row.
   *
   * Carried here because the row is already fetched: resolving it separately
   * would put an extra query in front of every single AI call, and this is one
   * column of a row we are holding anyway. Null on a schema older than
   * migration 003, and null means "no override" rather than any particular
   * mode — `effectivePolicy` decides what that resolves to.
   */
  apiPolicy: string | null
}

/**
 * The signed-in user's role and tenant, or null when signed out.
 *
 * Always read the role from the database rather than from user metadata —
 * metadata is writable by the user in some Supabase setups, which would make
 * privilege escalation a one-line request.
 *
 * Wrapped in `cache()`, which dedupes per request rather than across requests
 * — so it never serves one visitor's session to another, and every call site
 * in a single render shares one answer. That matters more than it looks: this
 * makes two round trips, and `getUser()` is a call to Supabase's auth service
 * rather than a database query. The shell layout alone was paying for it three
 * times over before anything rendered.
 */
export const getSessionContext = cache(async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createServerSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Whole row: the tenancy columns only exist once migration 002 has run.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) return null

  return {
    userId: user.id,
    email: (profile.email as string) ?? user.email ?? null,
    role: resolveRoleFromProfile(profile) ?? 'user',
    tenantId: (profile.tenant_id as string) ?? PLATFORM_TENANT_ID,
    status: (profile.status as SessionContext['status']) ?? 'active',
    apiPolicy: (profile.api_policy as string) ?? null,
  }
})
