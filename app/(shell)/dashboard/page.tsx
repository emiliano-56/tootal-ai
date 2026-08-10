import { HeroSection } from '@/components/hero-section'
import { StatsRow } from '@/components/stats-row'
import { QuickActions } from '@/components/quick-actions'
import { GettingStarted } from '@/components/getting-started'
import { ActivityChart } from '@/components/activity-chart'
import { LibraryCard } from '@/components/library-card'

export const metadata = {
  title: 'Dashboard - ComicAgent AI',
  description: 'Create amazing school comics and coloring pages with AI',
}

export default function Dashboard() {
  return (
    <div className="w-full p-6 md:p-8">
      <HeroSection />
      <StatsRow />
      <QuickActions />

      {/* The keep-limit is the one rule a customer can hit without having
          done anything wrong, so it belongs where they will see it coming
          rather than in a dialog interrupting a save. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <LibraryCard />
        <ActivityChart />
      </section>

      <GettingStarted />
    </div>
  )
}
