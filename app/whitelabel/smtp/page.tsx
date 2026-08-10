import { PortalGate } from '@/components/console/portal-page'
import { SmtpManager } from '@/components/console/smtp-manager'
import { getSessionContext, PLATFORM_TENANT_ID } from '@/lib/supabase/server'

export const metadata = { title: 'SMTP - ComicAgent AI' }

export default async function Page() {
  const session = await getSessionContext()

  return (
    <PortalGate slug="whitelabel">
      <SmtpManager tenantId={session?.tenantId ?? PLATFORM_TENANT_ID} />
    </PortalGate>
  )
}
