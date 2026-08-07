'use client'

import { useMemo, useState } from 'react'
import {
  Search, ChevronLeft, ChevronRight, Inbox, AlertTriangle, X, ChevronUp, ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Shared console building blocks.
 *
 * The superadmin, reseller and white-label consoles are the same product with
 * different menus, so they share these components rather than each growing
 * their own table and dialog. Styling follows the existing user dashboard —
 * white cards, slate text, indigo accents — so the app still reads as one
 * application.
 */

// ---------------------------------------------------------------------------
//  Page header
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>

      {/* Wraps rather than overflowing once several buttons stack up on a phone. */}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Stat tile
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'from-blue-500 to-indigo-600',
  loading,
}: {
  label: string
  value: string | number
  hint?: string
  /**
   * A rendered element, not a component reference — server components cannot
   * pass function/component props across the client boundary.
   */
  icon: React.ReactNode
  tone?: string
  loading?: boolean
}) {
  return (
    <div className="group relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-5 ring-1 ring-slate-200/70 dark:ring-slate-800 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.18)] transition-all duration-300">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-tight">
          {label}
        </p>
        <div
          className={cn(
            'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg shadow-slate-900/10 shrink-0 group-hover:scale-110 transition-transform duration-300',
            tone
          )}
        >
          {icon}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 h-8 w-20 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
      ) : (
        <p className="font-display mt-4 text-[2rem] leading-none font-bold text-slate-900 dark:text-white tabular-nums">
          {value}
        </p>
      )}

      {hint && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Seat meter
// ---------------------------------------------------------------------------

export function SeatMeter({
  purchased,
  used,
  remaining,
  percentUsed,
  unlimited,
}: {
  purchased: number | null
  used: number
  remaining: number | null
  percentUsed: number
  unlimited: boolean
}) {
  // Amber from 80%, red when full — the point is to notice before it blocks.
  const barTone =
    percentUsed >= 100
      ? 'bg-red-500'
      : percentUsed >= 80
        ? 'bg-amber-500'
        : 'bg-gradient-to-r from-indigo-500 to-violet-500'

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 ring-1 ring-slate-200/70 dark:ring-slate-800">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Licence usage
        </p>
        <p className="font-display text-sm font-bold text-slate-900 dark:text-white tabular-nums">
          {unlimited ? `${used} · unlimited` : `${used} / ${purchased}`}
        </p>
      </div>

      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barTone)}
          style={{ width: unlimited ? '100%' : `${percentUsed}%` }}
        />
      </div>

      <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
        {unlimited
          ? 'No seat limit on this account.'
          : remaining === 0
            ? 'No seats remaining — upgrade the licence to add users.'
            : `${remaining} seat${remaining === 1 ? '' : 's'} remaining.`}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Data table
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  className?: string
  /**
   * Makes the header clickable and sorts on this value. Returning the raw
   * field rather than the rendered node keeps sorting correct for dates and
   * numbers, which would otherwise sort as the strings they display as.
   */
  sortValue?: (row: T) => string | number
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  loading,
  searchable,
  searchPlaceholder = 'Search…',
  searchFields,
  emptyMessage = 'Nothing here yet.',
  pageSize = 10,
}: {
  rows: T[]
  columns: Column<T>[]
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  searchFields?: (row: T) => string
  emptyMessage?: string
  pageSize?: number
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const matched =
      needle && searchFields
        ? rows.filter((row) => searchFields(row).toLowerCase().includes(needle))
        : rows

    if (!sort) return matched

    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortValue) return matched

    // Copy before sorting — mutating the caller's array would reorder their state.
    return [...matched].sort((a, b) => {
      const av = column.sortValue!(a)
      const bv = column.sortValue!(b)

      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })

      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, query, searchFields, sort, columns])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  // Filtering can shrink the list under the current page.
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 overflow-hidden">
      {searchable && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(0)
              }}
              placeholder={searchPlaceholder}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {columns.map((column) => {
                const active = sort?.key === column.key

                return (
                  <th
                    key={column.key}
                    className={cn(
                      'px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap',
                      column.className
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        onClick={() =>
                          setSort((current) =>
                            current?.key === column.key
                              ? { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
                              : { key: column.key, dir: 'asc' }
                          )
                        }
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors',
                          active && 'text-indigo-600 dark:text-indigo-400'
                        )}
                      >
                        {column.header}
                        {active ? (
                          <ChevronUp
                            className={cn('w-3 h-3 transition-transform', sort.dir === 'desc' && 'rotate-180')}
                          />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {loading &&
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index} className="border-b border-slate-50 dark:border-slate-800/60">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3.5">
                      <div className="h-4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              visible.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-4 py-3.5 text-slate-700 dark:text-slate-300', column.className)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {query ? `No results for “${query}”.` : emptyMessage}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of{' '}
            {filtered.length}
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 px-2 tabular-nums">
              {safePage + 1} / {pageCount}
            </span>

            <button
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Status pill
// ---------------------------------------------------------------------------

const STATUS_TONES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  suspended: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  superadmin: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20',
  reseller: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
  white_label: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:ring-fuchsia-500/20',
  user: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 whitespace-nowrap',
        STATUS_TONES[value] ?? STATUS_TONES.user
      )}
    >
      {value.replace('_', ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
//  Confirm dialog
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3">
          {destructive && (
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-6">{message}</p>
          </div>

          <button
            onClick={onCancel}
            aria-label="Close"
            className="p-1 -mt-1 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>

          <Button
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              destructive && 'bg-red-600 hover:bg-red-700 text-white'
            )}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
