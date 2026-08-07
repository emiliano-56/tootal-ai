import { PortalGate } from '@/components/console/portal-page'
import { AccountsManager } from '@/components/console/accounts-manager'
import { getSessionContext } from '@/lib/supabase/server'
import type { Role } from '@/lib/auth/rbac'

export const metadata = { title: 'Users - ComicTale AI' }

export default async function Page() {
  const session = await getSessionContext()

  return (
    <PortalGate slug="reseller">
      <AccountsManager
        actorRole={(session?.role ?? 'user') as Role}
        manageRole="user"
        title="Users"
        subtitle="Every user account you administer."
      />
    </PortalGate>
  )
}
