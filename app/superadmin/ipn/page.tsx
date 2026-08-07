import { PortalGate } from '@/components/console/portal-page'
import { IpnManager } from '@/components/console/ipn-manager'

export const metadata = { title: 'IPN - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="superadmin">
      <IpnManager />
    </PortalGate>
  )
}
