import { CoverDesigner } from '@/components/cover-designer'

export const metadata = {
  title: 'Cover Designer - ComicTale AI',
  description: 'Design front and back comic book covers with AI',
}

export default function CoverDesignerPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <CoverDesigner />
    </div>
  )
}
