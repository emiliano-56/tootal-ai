import { AutopilotManager } from '@/components/autopilot-manager'

export const metadata = {
  title: 'Autopilot - ComicTale AI',
  description: 'Hands-free comic production on your own calendar',
}

export default function AutopilotPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <AutopilotManager />
    </div>
  )
}
