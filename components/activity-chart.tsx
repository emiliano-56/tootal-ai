'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import { BarChart3 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const COMIC_COLOR = '#2563eb'
const COLORING_COLOR = '#f59e0b'

function buildLastSevenDays() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
    })
  }
  return days
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-xs">
      <p className="font-semibold text-black mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-gray-500">{entry.dataKey}:</span>
          <span className="font-semibold text-black">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function ActivityChart() {
  const [data, setData] = useState(
    buildLastSevenDays().map((d) => ({ day: d.label, Comics: 0, Colorings: 0 }))
  )
  const [totals, setTotals] = useState({ comics: 0, colorings: 0 })

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const since = new Date()
        since.setDate(since.getDate() - 6)
        since.setHours(0, 0, 0, 0)

        const [comicsRes, coloringsRes] = await Promise.all([
          supabase
            .from('comics')
            .select('created_at')
            .eq('user_id', user.id)
            .gte('created_at', since.toISOString()),
          supabase
            .from('colorings')
            .select('created_at')
            .eq('user_id', user.id)
            .gte('created_at', since.toISOString()),
        ])

        const days = buildLastSevenDays()
        const buckets = Object.fromEntries(
          days.map((d) => [d.key, { day: d.label, Comics: 0, Colorings: 0 }])
        )

        for (const row of comicsRes.data || []) {
          const key = row.created_at.slice(0, 10)
          if (buckets[key]) buckets[key].Comics += 1
        }

        for (const row of coloringsRes.data || []) {
          const key = row.created_at.slice(0, 10)
          if (buckets[key]) buckets[key].Colorings += 1
        }

        const bucketList = days.map((d) => buckets[d.key])
        setData(bucketList)
        setTotals({
          comics: bucketList.reduce((sum, d) => sum + d.Comics, 0),
          colorings: bucketList.reduce((sum, d) => sum + d.Colorings, 0),
        })
      } catch (error) {
        console.error('[v0] ActivityChart fetch error:', error)
      }
    }

    fetchActivity()
  }, [])

  return (
    <div className="bg-white rounded-2xl p-6 h-full flex flex-col ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <BarChart3 className="w-[18px] h-[18px] text-white" />
          </div>
          <h3 className="font-display font-semibold text-slate-900 text-[17px]">Creation Activity</h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400">Last 7 days</span>
      </div>

      <div className="flex items-center gap-3 mt-4 mb-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span className="text-xs font-semibold text-blue-700">{totals.comics} Comics</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs font-semibold text-amber-700">{totals.colorings} Colorings</span>
        </div>
      </div>

      <div className="flex-1 min-h-[220px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={6}>
            <defs>
              <linearGradient id="comicsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COMIC_COLOR} stopOpacity={1} />
                <stop offset="100%" stopColor={COMIC_COLOR} stopOpacity={0.65} />
              </linearGradient>
              <linearGradient id="coloringsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORING_COLOR} stopOpacity={1} />
                <stop offset="100%" stopColor={COLORING_COLOR} stopOpacity={0.65} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              width={24}
            />
            <Tooltip cursor={{ fill: '#f9fafb' }} content={<CustomTooltip />} />
            <Bar dataKey="Comics" fill="url(#comicsFill)" radius={[6, 6, 0, 0]} maxBarSize={26} />
            <Bar dataKey="Colorings" fill="url(#coloringsFill)" radius={[6, 6, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
