import { PortalGate } from '@/components/console/portal-page'
import { AccountsManager } from '@/components/console/accounts-manager'
import { getSessionContext } from '@/lib/supabase/server'
import type { Role } from '@/lib/auth/rbac'

export const metadata = { title: 'Users - ComicAgent AI' }

export default async function Page() {
  const session = await getSessionContext()

  return (
    <PortalGate slug="superadmin">
      <AccountsManager
        actorRole={(session?.role ?? 'user') as Role}
        manageRole={['user', 'reseller', 'white_label']}
        title="Users"
        subtitle="Every customer account, with the versions they own. Buying OTO 4 or OTO 5 turns an account into a reseller or white label — they stay listed here."
      />
    </PortalGate>
  )
}
