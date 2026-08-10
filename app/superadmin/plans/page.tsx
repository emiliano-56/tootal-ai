import { PortalGate } from '@/components/console/portal-page'
import { PlansManager } from '@/components/console/plans-manager'

export const metadata = { title: 'Plans - ComicAgent AI' }

export default function Page() {
  return (
    <PortalGate slug="superadmin">
      <PlansManager />
    </PortalGate>
  )
}
