import { PortalGate } from '@/components/console/portal-page'
import { SocialManager } from '@/components/console/social-manager'

export const metadata = { title: 'Social apps - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="superadmin">
      <SocialManager />
    </PortalGate>
  )
}
