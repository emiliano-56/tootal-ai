import { DfyLibrary } from '@/components/dfy-library'

export const metadata = {
  title: 'Done For You - ComicTale AI',
  description: 'Ten ready-made kids content businesses, with commercial rights',
}

export default function DfyBusinessPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <DfyLibrary />
    </div>
  )
}
