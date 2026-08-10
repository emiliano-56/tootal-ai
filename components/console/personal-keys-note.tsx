'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/db'
import { POLICY_MODES, effectivePolicy, toPolicyMode } from '@/lib/ai/policy'
import { SectionHeading } from '@/components/console/providers-manager'

/**
 * Whether customers may bring their own AI key, shown where the keys are.
 *
 * The two settings behind this live on the Settings screen, which is the right
 * home for them — but an owner asking "can my users add their own key" comes
 * to the Providers screen to find out, and a screen full of platform keys that
 * says nothing about personal ones reads as "no". So the current answer is
 * stated here, with a link to where it is changed.
 *
 * Read-only on purpose. Two places to edit the same setting is how they end up
 * disagreeing.
 */

export function PersonalKeysNote() {
  const [allow, setAllow] = useState<boolean | null>(null)
  const [fallback, setFallback] = useState('platform_only')
  const [userKeys, setUserKeys] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['allow_personal_api_keys', 'default_api_policy'])

      const rows = (data ?? []) as { key: string; value: unknown }[]
      const valueOf = (key: string) => rows.find((row) => row.key === key)?.value

      setAllow(valueOf('allow_personal_api_keys') === true)
      setFallback(toPolicyMode(valueOf('default_api_policy')))

      // How many customers have actually added one. A zero here when the
      // switch is on is worth seeing: it usually means nobody found the screen.
      const { count } = await supabase
        .from('api_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('scope', 'user')

      setUserKeys(count ?? 0)
    }

    load()
  }, [])

  if (allow === null) return null

  const mode = effectivePolicy({
    allowPersonalKeys: allow,
    defaultPolicy: toPolicyMode(fallback),
  })

  const described = POLICY_MODES.find((entry) => entry.value === mode)

  return (
    <div className="mt-8">
      <SectionHeading
        title="Customer keys"
        hint="Whether the people on your platform may run generation on their own AI key."
      />

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-9 h-9 shrink-0 rounded-xl grid place-items-center ${
                allow ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <KeyRound className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-white">
                {allow ? described?.label : 'Off — everything runs on your keys'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {allow
                  ? described?.description
                  : 'Customers have no place to add a key, and any they added earlier is ignored until you switch this back on.'}
              </p>

              {allow && (
                <p className="text-xs text-slate-400 mt-1.5 tabular-nums">
                  {userKeys === 0
                    ? 'No customer has added one yet.'
                    : `${userKeys} customer key${userKeys === 1 ? '' : 's'} added.`}
                </p>
              )}
            </div>
          </div>

          <Link
            href="settings"
            className="shrink-0 text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
          >
            Change in Settings
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
