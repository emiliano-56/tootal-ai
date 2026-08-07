import { PortalGate } from '@/components/console/portal-page'
import { ComingSoon } from '@/components/console/console-sections'

export const metadata = { title: 'Settings - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="reseller">
      <ComingSoon title="Settings" description="Platform-wide defaults, feature toggles and plans." />
    </PortalGate>
  )
}
