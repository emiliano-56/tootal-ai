import { PortalGate } from '@/components/console/portal-page'
import { ComingSoon } from '@/components/console/console-sections'

export const metadata = { title: 'Email Templates - ComicAgent AI' }

export default function Page() {
  return (
    <PortalGate slug="reseller">
      <ComingSoon title="Email Templates" description="Edit the welcome, password reset and suspension emails." />
    </PortalGate>
  )
}
