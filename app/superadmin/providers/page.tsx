import { PortalGate } from '@/components/console/portal-page'
import { ProvidersManager } from '@/components/console/providers-manager'

export const metadata = { title: 'AI Providers - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="superadmin">
      <ProvidersManager />
    </PortalGate>
  )
}
