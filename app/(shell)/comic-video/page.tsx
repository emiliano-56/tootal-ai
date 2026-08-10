import { ComicVideoStudio } from '@/components/comic-video-studio'
import { UsageBadge } from '@/components/usage-badge'

export const metadata = {
  title: 'Comic-to-Video - ComicAgent AI',
  description: 'Animate comic pages into a video with camera moves and captions',
}

export default function ComicVideoPage() {
  return (
    <div className="w-full p-6 md:p-8">
      {/* Visible before anyone starts, so the limit is not a surprise. */}
      <div className="flex justify-end mb-3">
        <UsageBadge feature="comic-video" />
      </div>

      <ComicVideoStudio />
    </div>
  )
}
