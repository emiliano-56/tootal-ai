import { HeroSection } from '@/components/hero-section'
import { StatsRow } from '@/components/stats-row'
import { QuickActions } from '@/components/quick-actions'
import { GettingStarted } from '@/components/getting-started'
import { ActivityChart } from '@/components/activity-chart'

export const metadata = {
  title: 'Dashboard - ComicTale AI',
  description: 'Create amazing school comics and coloring pages with AI',
}

export default function Dashboard() {
  return (
    <div className="w-full p-6 md:p-8">
      <HeroSection />
      <StatsRow />
      <QuickActions />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GettingStarted />
        <ActivityChart />
      </section>
    </div>
  )
}
