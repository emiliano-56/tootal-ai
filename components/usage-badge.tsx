'use client'

import { Infinity as InfinityIcon, Lock } from 'lucide-react'
import Link from 'next/link'
import { useFeature } from '@/components/entitlements-context'

/**
 * "7 of 10 left this month" beside a generate button.
 *
 * Sits next to the action rather than on a separate page, because the moment
 * someone wants to know how many they have left is the moment they are about
 * to use one.
 */
export function UsageBadge({ feature, className = '' }: { feature: string; className?: string }) {
  const entitlement = useFeature(feature)

  if (entitlement.unlimited) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 ${className}`}
      >
        <InfinityIcon className="w-3.5 h-3.5" />
        Unlimited
      </span>
    )
  }

  // Not in the plan at all — distinct from having run out.
  if (entitlement.limit === 0 && entitlement.used === 0 && !entitlement.allowed) {
    return (
      <Link
        href="/credits"
        className={`inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors ${className}`}
      >
        <Lock className="w-3.5 h-3.5" />
        Not in your plan
      </Link>
    )
  }

  const remaining = entitlement.remaining ?? 0
  const tone =
    remaining === 0 ? 'text-red-500' : remaining <= 2 ? 'text-amber-600' : 'text-indigo-600'

  return (
    <Link
      href="/credits"
      className={`text-[11px] font-semibold tabular-nums hover:underline ${tone} ${className}`}
      title="Resets on the 1st of the month"
    >
      {remaining === 0
        ? 'None left this month'
        : `${remaining} of ${entitlement.limit} left this month`}
    </Link>
  )
}
