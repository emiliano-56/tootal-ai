import { AnalyticsDashboard } from '@/components/analytics-dashboard'

export const metadata = {
  title: 'Analytics - ComicTale AI',
  description: 'Track your comic, coloring and video creation activity',
}

export default function AnalyticsPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <AnalyticsDashboard />
    </div>
  )
}
