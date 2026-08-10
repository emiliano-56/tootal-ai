import { PortalGate } from '@/components/console/portal-page'
import { SettingsManager } from '@/components/console/settings-manager'

export const metadata = { title: 'Settings - ComicAgent AI' }

export default function Page() {
  return (
    <PortalGate slug="superadmin">
      <SettingsManager />
    </PortalGate>
  )
}
