import { BusinessAgent } from '@/components/business-agent'
import { UsageBadge } from '@/components/usage-badge'

export const metadata = {
  title: 'AI Business Agent - ComicAgent AI',
  description: 'Turn one idea into a launch-ready digital business',
}

export default function BusinessAgentPage() {
  return (
    <div className="w-full p-6 md:p-8">
      {/* Visible before anyone starts, so the limit is not a surprise. */}
      <div className="flex justify-end mb-3">
        <UsageBadge feature="business-agent" />
      </div>

      <BusinessAgent />
    </div>
  )
}
