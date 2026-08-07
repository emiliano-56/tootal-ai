import { PortalGate } from '@/components/console/portal-page'
import { TemplatesManager } from '@/components/console/templates-manager'

export const metadata = { title: 'Email Templates - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="superadmin">
      <TemplatesManager />
    </PortalGate>
  )
}
