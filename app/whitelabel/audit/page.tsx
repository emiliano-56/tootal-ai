import { PortalGate } from '@/components/console/portal-page'
import { AuditLog } from '@/components/console/console-sections'

export const metadata = { title: 'Audit Logs - ComicAgent AI' }

export default function Page() {
  return (
    <PortalGate slug="whitelabel">
      <AuditLog />
    </PortalGate>
  )
}
