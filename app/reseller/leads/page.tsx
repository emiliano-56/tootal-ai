import { PortalGate } from '@/components/console/portal-page'
import { LeadsManager } from '@/components/console/leads-manager'
import { getSessionContext, PLATFORM_TENANT_ID } from '@/lib/supabase/server'

export const metadata = { title: 'Leads - ComicTale AI' }

export default async function Page() {
  const session = await getSessionContext()

  return (
    <PortalGate slug="reseller">
      <LeadsManager tenantId={session?.tenantId ?? PLATFORM_TENANT_ID} />
    </PortalGate>
  )
}
