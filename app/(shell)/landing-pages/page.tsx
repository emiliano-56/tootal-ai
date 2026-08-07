import { LandingBuilder } from '@/components/landing-builder'
import { UsageBadge } from '@/components/usage-badge'

export const metadata = {
  title: 'Landing Page Builder - ComicTale AI',
  description: 'Generate a complete sales page for any product',
}

export default function LandingPagesPage() {
  return (
    <div className="w-full p-6 md:p-8">
      {/* Visible before anyone starts, so the limit is not a surprise. */}
      <div className="flex justify-end mb-3">
        <UsageBadge feature="landing-pages" />
      </div>

      <LandingBuilder />
    </div>
  )
}
