import { MarketingGenerator } from '@/components/marketing-generator'
import { UsageBadge } from '@/components/usage-badge'

export const metadata = {
  title: 'Marketing Agent - ComicTale AI',
  description: 'Generate ads, social posts, emails, blog and SEO copy',
}

export default function MarketingPage() {
  return (
    <div className="w-full p-6 md:p-8">
      {/* Visible before anyone starts, so the limit is not a surprise. */}
      <div className="flex justify-end mb-3">
        <UsageBadge feature="marketing" />
      </div>

      <MarketingGenerator />
    </div>
  )
}
