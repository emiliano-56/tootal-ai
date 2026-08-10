import { AgentHistory } from '@/components/agent-history'

export const metadata = {
  title: 'History - ComicAgent AI',
  description: 'Every AI agent run you have made',
}

export default function HistoryPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <AgentHistory />
    </div>
  )
}
