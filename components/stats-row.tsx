'use client'

import { BookOpen, Palette, Video, Coins, TrendingUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/db'
import { useT } from '@/components/locale-provider'

const statConfig = [
  {
    key: 'comics',
    label: 'dash.comics',
    icon: BookOpen,
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'group-hover:shadow-blue-500/20',
    wash: 'from-blue-50',
  },
  {
    key: 'colorings',
    label: 'dash.coloringBooks',
    icon: Palette,
    gradient: 'from-purple-500 to-fuchsia-600',
    glow: 'group-hover:shadow-purple-500/20',
    wash: 'from-purple-50',
  },
  {
    key: 'videos',
    label: 'dash.videos',
    icon: Video,
    gradient: 'from-pink-500 to-rose-500',
    glow: 'group-hover:shadow-pink-500/20',
    wash: 'from-pink-50',
  },
  {
    key: 'tools',
    label: 'dash.toolsUnlocked',
    icon: Coins,
    gradient: 'from-amber-400 to-orange-500',
    glow: 'group-hover:shadow-amber-500/20',
    wash: 'from-amber-50',
  },
] as const

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    const duration = 800
    const start = performance.now()

    let frame: number

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (to - from) * eased))

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <>{display}</>
}

export function StatsRow() {
  const t = useT()
  const [counts, setCounts] = useState({ comics: 0, colorings: 0, videos: 0, tools: 0 })

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        // One source. Counting comics, colourings and a bucket listing
        // separately meant the dashboard could disagree with History, with My
        // Library and with the keep-limit all at once — and the video count
        // listed a bucket, so it included files nothing had a row for.
        const [libraryRes, profileRes] = await Promise.all([
          fetch('/api/library').then((r) => r.json()).catch(() => ({ quotas: {} })),
          fetch('/api/usage').then((r) => r.json()).catch(() => ({ unlocked: [] })),
        ])

        const quotas = (libraryRes as { quotas?: Record<string, { used: number }> })?.quotas ?? {}

        setCounts({
          comics: quotas.comic?.used ?? 0,
          colorings: quotas.coloring?.used ?? 0,
          videos: quotas.video?.used ?? 0,
          // Monthly allowances replaced the credit balance.
          tools: (profileRes as { unlocked?: string[] })?.unlocked?.length ?? 0,
        })
      } catch (error) {
        console.error('[v0] StatsRow fetch error:', error)
      }
    }

    fetchCounts()
  }, [])

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-[18px] h-[18px] text-indigo-600" />
        <h2 className="font-display text-lg font-semibold text-slate-900">{t('dash.overview')}</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statConfig.map((stat, index) => {
          const Icon = stat.icon

          return (
            <div
              key={stat.key}
              className={`group relative overflow-hidden bg-white rounded-2xl p-5 ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.18)] ${stat.glow} hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-both`}
              style={{ animationDelay: `${index * 90}ms`, animationDuration: '500ms' }}
            >
              {/* Corner wash */}
              <div
                className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${stat.wash} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
              />

              <div className="relative flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">
                  {t(stat.label)}
                </p>
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg shadow-slate-900/10 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300 shrink-0`}
                >
                  <Icon className="w-[18px] h-[18px] text-white" />
                </div>
              </div>

              <p className="font-display relative mt-4 text-[2rem] leading-none font-bold text-slate-900 tabular-nums">
                <AnimatedNumber value={counts[stat.key]} />
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
