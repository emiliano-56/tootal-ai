import { PortalGate } from '@/components/console/portal-page'
import { AnalyticsView } from '@/components/console/analytics-view'

export const metadata = { title: 'Analytics - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="whitelabel">
      <AnalyticsView />
    </PortalGate>
  )
}
