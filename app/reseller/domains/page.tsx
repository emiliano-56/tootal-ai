import { PortalGate } from '@/components/console/portal-page'
import { ComingSoon } from '@/components/console/console-sections'

export const metadata = { title: 'Domains - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="reseller">
      <ComingSoon title="Domains" description="Map your own domain and track its verification and SSL status." />
    </PortalGate>
  )
}
