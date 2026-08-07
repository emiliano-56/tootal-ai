import { Construction } from 'lucide-react'
import { createServerSupabase, getSessionContext } from '@/lib/supabase/server'
import { PageHeader, StatusPill } from '@/components/console/console-ui'

/**
 * Sections that are routed but not built yet.
 *
 * A named placeholder beats a 404: the navigation stays honest about what
 * exists, and nobody has to guess whether a link is broken or unfinished.
 */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} />

      <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto">
          <Construction className="w-6 h-6 text-amber-600" />
        </div>

        <h2 className="font-display mt-4 text-lg font-bold text-slate-900 dark:text-white">
          Not built yet
        </h2>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-6">
          {description}
        </p>

        <p className="mt-4 text-xs text-slate-400">
          The database tables and business logic behind this screen already exist —
          only the interface is outstanding.
        </p>
      </div>
    </>
  )
}

/** Audit trail — every privileged action, newest first. */
export async function AuditLog() {
  const session = await getSessionContext()

  if (!session) return null

  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, target_type, target_id, metadata, actor_role, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = data ?? []

  return (
    <>
      <PageHeader
        title="Audit Logs"
        subtitle="Every account change, newest first. Scoped to what you administer."
      />

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-red-600 text-sm">
          {error.message}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {['Action', 'Target', 'By', 'When'].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((entry) => {
                const row = entry as {
                  id: number
                  action: string
                  target_type: string | null
                  metadata: Record<string, unknown> | null
                  actor_role: string | null
                  created_at: string
                }

                const email = row.metadata?.email as string | undefined

                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {row.action.replace(/[._]/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {email ?? row.target_type ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.actor_role ? <StatusPill value={row.actor_role} /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                  </tr>
                )
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-14 text-center text-sm text-slate-500">
                    Nothing logged yet. Account changes will appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
