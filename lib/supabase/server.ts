import 'server-only'

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
}

/**
 * The signed-in user's role and tenant, or null when signed out.
 *
 * Always read the role from the database rather than from user metadata —
 * metadata is writable by the user in some Supabase setups, which would make
 * privilege escalation a one-line request.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
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
  }
}
