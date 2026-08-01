'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/db'
import {
  BarChart3,
  BookOpen,
  Palette,
  Video,
  Layers,
  Clock,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ItemType = 'comic' | 'coloring' | 'video'

interface Item {
  type: ItemType
  title: string
  created_at: string
}

const TYPE_COLOR: Record<ItemType, string> = {
  comic: '#2563eb',
  coloring: '#f59e0b',
  video: '#db2777',
}

const TYPE_LABEL: Record<ItemType, string> = {
  comic: 'Comics',
  coloring: 'Colorings',
  video: 'Videos',
}

const ranges = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
] as const

type RangeKey = (typeof ranges)[number]['key']

const MS_DAY = 86_400_000

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white rounded-xl shadow-xl ring-1 ring-slate-200 px-3 py-2 text-xs">
      <p className="font-semibold text-slate-900 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey ?? entry.name} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color ?? entry.payload?.color }}
          />
          <span className="text-slate-500">{entry.dataKey ?? entry.name}:</span>
          <span className="font-semibold text-slate-900">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsDashboard() {
  const [range, setRange] = useState<RangeKey>('7d')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        const [comicsRes, coloringsRes, videosRes] = await Promise.all([
          supabase
            .from('comics')
            .select('title, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1000),
          supabase
            .from('colorings')
            .select('title, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1000),
          supabase.storage.from('video').list(user.id),
        ])

        const all: Item[] = []

        for (const row of comicsRes.data || []) {
          all.push({ type: 'comic', title: row.title || 'Untitled Comic', created_at: row.created_at })
        }

        for (const row of coloringsRes.data || []) {
          all.push({ type: 'coloring', title: row.title || 'Untitled Coloring Book', created_at: row.created_at })
        }

        for (const file of videosRes.data || []) {
          if (file.id && file.name.includes('.')) {
            all.push({
              type: 'video',
              title: file.name,
              created_at: file.created_at || new Date().toISOString(),
            })
          }
        }

        setItems(all)
      } catch (error) {
        console.error('[v0] Analytics fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [])

  const activeRange = ranges.find((r) => r.key === range)!

  const { stats, chartData, breakdown, recent } = useMemo(() => {
    const days = activeRange.days

    // The window covers `days` calendar days ending with (and including) today.
    const windowStart = startOfToday().getTime() - (days - 1) * MS_DAY
    const prevWindowStart = windowStart - days * MS_DAY

    const currentItems = items.filter((i) => new Date(i.created_at).getTime() >= windowStart)
    const previousItems = items.filter((i) => {
      const t = new Date(i.created_at).getTime()
      return t >= prevWindowStart && t < windowStart
    })

    const countOf = (list: Item[], type?: ItemType) =>
      type ? list.filter((i) => i.type === type).length : list.length

    const delta = (cur: number, prev: number) => {
      if (cur === 0 && prev === 0) return { text: '—', tone: 'flat' as const }
      if (prev <= 0) return { text: '+100%', tone: 'up' as const }
      const d = ((cur - prev) / prev) * 100
      return {
        text: `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`,
        tone: d >= 0 ? ('up' as const) : ('down' as const),
      }
    }

    const statConfig: Array<{ key: string; label: string; icon: any; gradient: string; type?: ItemType }> = [
      { key: 'comics', label: 'Comics Created', icon: BookOpen, gradient: 'from-blue-500 to-indigo-600', type: 'comic' },
      { key: 'colorings', label: 'Coloring Pages', icon: Palette, gradient: 'from-amber-400 to-orange-500', type: 'coloring' },
      { key: 'videos', label: 'Videos Made', icon: Video, gradient: 'from-pink-500 to-rose-600', type: 'video' },
      { key: 'total', label: 'Total Creations', icon: Layers, gradient: 'from-purple-500 to-fuchsia-600' },
    ]

    const stats = statConfig.map((s) => {
      const cur = countOf(currentItems, s.type)
      const prev = countOf(previousItems, s.type)
      return { ...s, value: cur, ...delta(cur, prev) }
    })

    // Daily buckets up to 30 days, weekly beyond that so the axis stays readable.
    const bucketByWeek = days > 30
    const bucketSpanDays = bucketByWeek ? 7 : 1
    const bucketCount = Math.ceil(days / bucketSpanDays)

    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = new Date(windowStart + i * bucketSpanDays * MS_DAY)
      return {
        label: bucketByWeek
          ? `${bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : bucketStart.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        Comics: 0,
        Colorings: 0,
        Videos: 0,
      }
    })

    for (const item of currentItems) {
      const t = new Date(item.created_at).getTime()
      const index = Math.floor((t - windowStart) / (bucketSpanDays * MS_DAY))
      // Clamp so anything created later today still lands in the final bucket.
      const bucket = buckets[Math.min(Math.max(index, 0), bucketCount - 1)]
      if (!bucket) continue
      if (item.type === 'comic') bucket.Comics += 1
      if (item.type === 'coloring') bucket.Colorings += 1
      if (item.type === 'video') bucket.Videos += 1
    }

    const breakdown = (['comic', 'coloring', 'video'] as ItemType[])
      .map((type) => ({
        name: TYPE_LABEL[type],
        value: countOf(currentItems, type),
        color: TYPE_COLOR[type],
      }))
      .filter((b) => b.value > 0)

    const recent = [...items]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)

    return { stats, chartData: buckets, breakdown, recent }
  }, [items, activeRange])

  const hasChartData = chartData.some((d) => d.Comics || d.Colorings || d.Videos)

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-sm text-slate-500">Track your creation activity over time</p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white ring-1 ring-slate-200 rounded-full shadow-sm">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                range === r.key
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, index) => {
          const Icon = s.icon
          return (
            <div
              key={s.key}
              className="bg-white rounded-2xl p-5 ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
              style={{ animationDelay: `${index * 80}ms`, animationDuration: '450ms' }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">
                  {s.label}
                </p>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg shadow-slate-900/10 shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-[2rem] leading-none font-bold text-slate-900 tabular-nums">
                  {loading ? '—' : s.value}
                </span>
                {!loading && (
                  <span
                    className={`text-xs font-semibold ${
                      s.tone === 'up'
                        ? 'text-emerald-600'
                        : s.tone === 'down'
                          ? 'text-rose-600'
                          : 'text-slate-400'
                    }`}
                  >
                    {s.text}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Chart + breakdown */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-semibold text-slate-900 text-[17px]">Creation Trend</h3>
            <span className="text-[11px] font-medium text-slate-400">{activeRange.label}</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Comics, coloring pages and videos created over time
          </p>

          <div className="h-72 relative">
            {!loading && !hasChartData && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-slate-400 bg-white/80 px-3 py-1.5 rounded-lg">
                  No creations in this period yet
                </p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  interval={chartData.length > 8 ? Math.ceil(chartData.length / 8) - 1 : 0}
                />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} width={24} />
                <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Comics" fill={TYPE_COLOR.comic} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Colorings" fill={TYPE_COLOR.coloring} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Videos" fill={TYPE_COLOR.video} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]">
          <h3 className="font-display font-semibold text-slate-900 text-[17px] mb-1">Content Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">Share of creations in {activeRange.label.toLowerCase()}</p>

          {breakdown.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-400 text-center px-4">
              No creations yet in this period.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {breakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl overflow-hidden ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <h3 className="font-display font-semibold text-slate-900 text-[17px]">Recent Activity</h3>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading activity...</div>
        ) : recent.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No creations yet. Start creating to see activity here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((item, i) => {
              const Icon = item.type === 'comic' ? BookOpen : item.type === 'coloring' ? Palette : Video
              return (
                <div
                  key={`${item.type}-${item.title}-${i}`}
                  className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${TYPE_COLOR[item.type]}1a` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: TYPE_COLOR[item.type] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500">{TYPE_LABEL[item.type]}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
