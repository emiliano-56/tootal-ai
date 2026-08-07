import { PortalGate } from '@/components/console/portal-page'
import { ComingSoon } from '@/components/console/console-sections'

export const metadata = { title: 'Brand - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="reseller">
      <ComingSoon title="Brand" description="Logo, colours, product name and custom CSS for your branded platform." />
    </PortalGate>
  )
}
