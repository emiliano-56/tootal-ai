import { CoverDesigner } from '@/components/cover-designer'
import { UsageBadge } from '@/components/usage-badge'

export const metadata = {
  title: 'Cover Designer - ComicTale AI',
  description: 'Design front and back comic book covers with AI',
}

export default function CoverDesignerPage() {
  return (
    <div className="w-full p-6 md:p-8">
      {/* Visible before anyone starts, so the limit is not a surprise. */}
      <div className="flex justify-end mb-3">
        <UsageBadge feature="cover-designer" />
      </div>

      <CoverDesigner />
    </div>
  )
}
