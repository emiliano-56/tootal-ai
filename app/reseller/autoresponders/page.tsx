import { PortalGate } from '@/components/console/portal-page'
import { AutorespondersManager } from '@/components/console/autoresponders-manager'
import { getSessionContext, PLATFORM_TENANT_ID } from '@/lib/supabase/server'

export const metadata = { title: 'Autoresponders - ComicTale AI' }

export default async function Page() {
  const session = await getSessionContext()

  return (
    <PortalGate slug="reseller">
      <AutorespondersManager tenantId={session?.tenantId ?? PLATFORM_TENANT_ID} />
    </PortalGate>
  )
}
