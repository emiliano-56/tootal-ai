import { ActivityStudio } from '@/components/activity-studio'

export const metadata = {
  title: 'Activity Studio - ComicAgent AI',
  description: 'Mazes, word searches, dot-to-dot, journal pages and product mockups',
}

export default function ActivitiesPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <ActivityStudio />
    </div>
  )
}
