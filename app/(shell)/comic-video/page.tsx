import { ComicVideoStudio } from '@/components/comic-video-studio'

export const metadata = {
  title: 'Comic-to-Video - ComicTale AI',
  description: 'Animate comic pages into a video with camera moves and captions',
}

export default function ComicVideoPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <ComicVideoStudio />
    </div>
  )
}
