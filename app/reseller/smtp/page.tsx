import { PortalGate } from '@/components/console/portal-page'
import { ComingSoon } from '@/components/console/console-sections'

export const metadata = { title: 'SMTP - ComicAgent AI' }

export default function Page() {
  return (
    <PortalGate slug="reseller">
      <ComingSoon title="SMTP" description="Primary and backup mail servers, with a send test." />
    </PortalGate>
  )
}
