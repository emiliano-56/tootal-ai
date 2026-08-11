import { PublishStudio } from '@/components/publish-studio'

export const metadata = {
  title: 'Publish - ComicAgent AI',
  description: 'Print-ready covers, delivery links and a posting schedule',
}

export default function PublishPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <PublishStudio />
    </div>
  )
}
