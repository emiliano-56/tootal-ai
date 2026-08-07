import { PortalGate } from '@/components/console/portal-page'
import { DomainsManager } from '@/components/console/domains-manager'
import { getSessionContext, PLATFORM_TENANT_ID } from '@/lib/supabase/server'
import type { Role } from '@/lib/auth/rbac'

export const metadata = { title: 'Domains - ComicTale AI' }

export default async function Page() {
  const session = await getSessionContext()

  return (
    <PortalGate slug="superadmin">
      <DomainsManager tenantId={session?.tenantId ?? PLATFORM_TENANT_ID}
        actorRole={(session?.role ?? 'user') as Role}
        userId={session?.userId ?? ''} />
    </PortalGate>
  )
}
