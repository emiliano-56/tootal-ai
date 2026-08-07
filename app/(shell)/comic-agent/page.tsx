import { StoryComicAgent } from '@/components/story-comic-agent'
import { UsageBadge } from '@/components/usage-badge'

export const metadata = {
  title: 'Story-to-Comic Agent - ComicTale AI',
  description: 'Turn one idea into a finished comic automatically',
}

export default function ComicAgentPage() {
  return (
    <div className="w-full p-6 md:p-8">
      {/* Visible before anyone starts, so the limit is not a surprise. */}
      <div className="flex justify-end mb-3">
        <UsageBadge feature="comic-agent" />
      </div>

      <StoryComicAgent />
    </div>
  )
}
