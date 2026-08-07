import { PortalGate } from '@/components/console/portal-page'
import { AccountsManager } from '@/components/console/accounts-manager'
import { getSessionContext } from '@/lib/supabase/server'
import type { Role } from '@/lib/auth/rbac'

export const metadata = { title: 'Bundle Users - ComicTale AI' }

export default async function Page() {
  const session = await getSessionContext()

  return (
    <PortalGate slug="superadmin">
      <AccountsManager
        actorRole={(session?.role ?? 'user') as Role}
        manageRole={['user', 'reseller', 'white_label']}
        title="Bundle Users"
        subtitle="Accounts holding the Mega Bundle — every version from Front End through OTO 5."
        bundleOnly
      />
    </PortalGate>
  )
}
