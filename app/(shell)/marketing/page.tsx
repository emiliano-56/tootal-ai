import { MarketingGenerator } from '@/components/marketing-generator'

export const metadata = {
  title: 'Marketing Agent - ComicTale AI',
  description: 'Generate ads, social posts, emails, blog and SEO copy',
}

export default function MarketingPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <MarketingGenerator />
    </div>
  )
}
