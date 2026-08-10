import { PortalGate } from '@/components/console/portal-page'
import { AnalyticsView } from '@/components/console/analytics-view'

export const metadata = { title: 'Analytics - ComicAgent AI' }

export default function Page() {
  return (
    <PortalGate slug="superadmin">
      <AnalyticsView />
    </PortalGate>
  )
}
