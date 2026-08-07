import { Users, Contact, Cpu, TrendingUp } from 'lucide-react'
import { createServerSupabase, getSessionContext } from '@/lib/supabase/server'
import { PageHeader, StatTile } from '@/components/console/console-ui'

/**
 * Analytics.
 *
 * Aggregates through the RLS-scoped client, so a reseller's figures cover only
 * their own tenant without this component filtering anything itself.
 */

const ICON = 'w-[18px] h-[18px] text-white'

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

export async function AnalyticsView() {
  const session = await getSessionContext()

  if (!session) return null

  const supabase = await createServerSupabase()

  const [{ data: profiles }, { data: leads }, { data: usage }] = await Promise.all([
    supabase.from('profiles').select('role, status, created_at'),
    supabase.from('leads').select('created_at'),
    supabase.from('api_usage_logs').select('provider, succeeded, created_at').limit(1000),
  ])

  const accounts = profiles ?? []
  const users = accounts.filter((row) => (row as { role: string }).role === 'user')

  const suspended = accounts.filter(
    (row) => (row as { status: string }).status === 'suspended'
  ).length

  // Signups per month, most recent six months that have data.
  const byMonth = new Map<string, number>()

  for (const row of users) {
    const createdAt = (row as { created_at?: string }).created_at

    if (!createdAt) continue

    const key = monthKey(createdAt)
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
  }

  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6)
  const peak = Math.max(1, ...months.map(([, count]) => count))

  const providerUsage = new Map<string, { total: number; failed: number }>()

  for (const row of usage ?? []) {
    const entry = row as { provider: string; succeeded: boolean }
    const current = providerUsage.get(entry.provider) ?? { total: 0, failed: 0 }

    current.total++
    if (!entry.succeeded) current.failed++

    providerUsage.set(entry.provider, current)
  }

  return (
    <>
      <PageHeader title="Analytics" subtitle="Growth, leads and provider usage." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatTile
          label="Users"
          value={users.length}
          hint={suspended > 0 ? `${suspended} suspended` : 'All active'}
          icon={<Users className={ICON} />}
          tone="from-blue-500 to-indigo-600"
        />
        <StatTile
          label="Leads"
          value={(leads ?? []).length}
          icon={<Contact className={ICON} />}
          tone="from-purple-500 to-fuchsia-600"
        />
        <StatTile
          label="AI calls logged"
          value={(usage ?? []).length}
          icon={<Cpu className={ICON} />}
          tone="from-emerald-500 to-teal-600"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Signups */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-[18px] h-[18px] text-indigo-600" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              New users per month
            </h2>
          </div>

          {months.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Not enough data yet.</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {months.map(([month, count]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {count}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-violet-500 transition-all"
                    style={{ height: `${Math.max(4, (count / peak) * 100)}%` }}
                  />
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {month.slice(5)}/{month.slice(2, 4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Provider usage */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Cpu className="w-[18px] h-[18px] text-indigo-600" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Provider usage
            </h2>
          </div>

          {providerUsage.size === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No AI calls logged yet. Usage appears here once generation runs through a
              managed provider key.
            </p>
          ) : (
            <div className="space-y-3">
              {[...providerUsage.entries()]
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([provider, stats]) => {
                  const failureRate = Math.round((stats.failed / stats.total) * 100)

                  return (
                    <div key={provider}>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                          {provider}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {stats.total} calls
                          {stats.failed > 0 && (
                            <span className="text-red-500"> · {failureRate}% failed</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                          style={{
                            width: `${(stats.total / Math.max(...[...providerUsage.values()].map((s) => s.total))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
