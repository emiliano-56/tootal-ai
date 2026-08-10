import { PortalGate } from '@/components/console/portal-page'
import { ConsoleOverview } from '@/components/console/console-overview'
import { getPortal } from '@/lib/auth/portals'

export const metadata = { title: `${getPortal('whitelabel')!.title} - ComicAgent AI` }

export default function Page() {
  return (
    <PortalGate slug="whitelabel">
      <ConsoleOverview />
    </PortalGate>
  )
}
