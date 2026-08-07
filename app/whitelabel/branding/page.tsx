import { PortalGate } from '@/components/console/portal-page'
import { BrandingManager } from '@/components/console/branding-manager'
import { getSessionContext, PLATFORM_TENANT_ID } from '@/lib/supabase/server'

export const metadata = { title: 'Brand - ComicTale AI' }

export default async function Page() {
  const session = await getSessionContext()

  return (
    <PortalGate slug="whitelabel">
      <BrandingManager tenantId={session?.tenantId ?? PLATFORM_TENANT_ID} />
    </PortalGate>
  )
}
