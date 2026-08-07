import { Suspense } from 'react'
import { SocialConnections } from '@/components/social-connections'

export const metadata = {
  title: 'Connections - ComicTale AI',
  description: 'Connect the accounts Autopilot posts to',
}

export default function ConnectionsPage() {
  return (
    <div className="w-full p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Connections
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-2xl">
          Sign in to a social account once and Autopilot can post to it on your schedule. Every
          connection can be tested before you trust it with a campaign.
        </p>
      </div>

      {/* The OAuth callback returns here with its result in the query string,
          which useSearchParams needs a boundary to read. */}
      <Suspense fallback={<div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />}>
        <SocialConnections />
      </Suspense>
    </div>
  )
}
