import { StoryComicAgent } from '@/components/story-comic-agent'

export const metadata = {
  title: 'Story-to-Comic Agent - ComicTale AI',
  description: 'Turn one idea into a finished comic automatically',
}

export default function ComicAgentPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <StoryComicAgent />
    </div>
  )
}
