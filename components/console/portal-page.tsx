import { redirect } from 'next/navigation'
import { getSessionContext, createServerSupabase } from '@/lib/supabase/server'
import { ConsoleShell } from '@/components/console/console-shell'
import { AuthLayout } from '@/components/auth/auth-layout'
import { LoginForm } from '@/components/auth/login-form'
import { HOME_ROUTE, type Role } from '@/lib/auth/rbac'
import { getPortal } from '@/lib/auth/portals'

/**
 * One URL, two faces.
 *
 * /superadmin (and the other portal roots) show the sign-in form to a visitor
 * and the console to the account that belongs there, so an administrator's
 * whole world lives under a single path instead of being split across a login
 * URL and a separate console URL.
 */

export async function PortalGate({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  const portal = getPortal(slug)

  if (!portal) redirect('/login')

  const session = await getSessionContext()

  // Signed out — the front door.
  if (!session) {
    return (
      <AuthLayout portal={portal}>
        <LoginForm portal={portal} />
      </AuthLayout>
    )
  }

  // Signed in as somebody else — send them to their own portal rather than
  // showing a console they may not use.
  if (portal.role && session.role !== portal.role && session.role !== 'superadmin') {
    redirect(HOME_ROUTE[session.role])
  }

  const supabase = await createServerSupabase()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, brand_name')
    .eq('id', session.tenantId)
    .maybeSingle()

  const tenantName =
    session.role === 'white_label' ? (tenant?.brand_name ?? tenant?.name) : tenant?.name

  return (
    <ConsoleShell role={session.role as Role} email={session.email} tenantName={tenantName}>
      {children}
    </ConsoleShell>
  )
}
