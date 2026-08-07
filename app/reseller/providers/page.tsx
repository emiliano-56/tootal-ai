import { PortalGate } from '@/components/console/portal-page'
import { ComingSoon } from '@/components/console/console-sections'

export const metadata = { title: 'AI Providers - ComicTale AI' }

export default function Page() {
  return (
    <PortalGate slug="reseller">
      <ComingSoon title="AI Providers" description="Add and prioritise Zoop, DeepSeek, Claude, OpenAI, Gemini and OpenRouter keys, with failover and usage limits." />
    </PortalGate>
  )
}
