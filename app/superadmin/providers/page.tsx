import { PortalGate } from '@/components/console/portal-page'
import { ProvidersManager } from '@/components/console/providers-manager'

export const metadata = { title: 'AI Providers - ComicAgent AI' }

export default function Page() {
  return (
    <PortalGate slug="superadmin">
      <ProvidersManager />
    </PortalGate>
  )
}
