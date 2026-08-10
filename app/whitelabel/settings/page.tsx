import { PortalGate } from '@/components/console/portal-page'
import { ComingSoon } from '@/components/console/console-sections'

export const metadata = { title: 'Settings - ComicAgent AI' }

export default function Page() {
  return (
    <PortalGate slug="whitelabel">
      <ComingSoon title="Settings" description="Platform-wide defaults, feature toggles and plans." />
    </PortalGate>
  )
}
