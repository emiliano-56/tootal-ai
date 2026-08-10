import { PortalGate } from '@/components/console/portal-page'
import { SocialManager } from '@/components/console/social-manager'

export const metadata = { title: 'Social apps - ComicAgent AI' }

export default function Page() {
  return (
    <PortalGate slug="superadmin">
      <SocialManager />
    </PortalGate>
  )
}
