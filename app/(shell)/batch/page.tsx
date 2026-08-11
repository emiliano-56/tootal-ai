import { BulkStudio } from '@/components/bulk-studio'

export const metadata = {
  title: 'Batch & Styles - ComicAgent AI',
  description: 'Generate a list of ideas unattended, with one house style',
}

export default function BatchPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <BulkStudio />
    </div>
  )
}
