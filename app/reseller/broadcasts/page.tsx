import { PortalGate } from '@/components/console/portal-page'
import { BroadcastsManager } from '@/components/console/broadcasts-manager'
import { getSessionContext, PLATFORM_TENANT_ID } from '@/lib/supabase/server'

export const metadata = { title: 'Broadcasts - ComicTale AI' }

export default async function Page() {
  const session = await getSessionContext()

  return (
    <PortalGate slug="reseller">
      <BroadcastsManager tenantId={session?.tenantId ?? PLATFORM_TENANT_ID} />
    </PortalGate>
  )
}
