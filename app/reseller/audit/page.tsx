import { PortalGate } from '@/components/console/portal-page'
import { AuditLog } from '@/components/console/console-sections'

export const metadata = { title: 'Audit Logs - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="reseller">
      <AuditLog />
    </PortalGate>
  )
}
