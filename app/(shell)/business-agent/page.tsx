import { BusinessAgent } from '@/components/business-agent'

export const metadata = {
  title: 'AI Business Agent - ComicTale AI',
  description: 'Turn one idea into a launch-ready digital business',
}

export default function BusinessAgentPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <BusinessAgent />
    </div>
  )
}
