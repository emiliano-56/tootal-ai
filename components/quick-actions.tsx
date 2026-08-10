'use client'

import { useRouter } from 'next/navigation'
import { BookOpen, Palette, FolderOpen, ArrowRight, Zap } from 'lucide-react'
import { useT } from '@/components/locale-provider'

const actions = [
  {
    icon: BookOpen,
    title: 'dash.newComic.title',
    subtitle: 'dash.newComic.subtitle',
    href: '/comic',
    gradient: 'from-blue-500 to-indigo-600',
    ring: 'hover:ring-blue-300',
    arrowBg: 'group-hover:bg-blue-600',
  },
  {
    icon: Palette,
    title: 'dash.coloring.title',
    subtitle: 'dash.coloring.subtitle',
    href: '/coloring',
    gradient: 'from-purple-500 to-fuchsia-600',
    ring: 'hover:ring-purple-300',
    arrowBg: 'group-hover:bg-purple-600',
  },
  {
    icon: FolderOpen,
    title: 'dash.library.title',
    subtitle: 'dash.library.subtitle',
    href: '/my-comics',
    gradient: 'from-pink-500 to-rose-600',
    ring: 'hover:ring-pink-300',
    arrowBg: 'group-hover:bg-pink-600',
  },
]

export function QuickActions() {
  const router = useRouter()
  const t = useT()

  return (
    <section className="mb-8">
      <style>{`
        @keyframes shine-sweep {
          0% { transform: translateX(-130%) skewX(-18deg); }
          100% { transform: translateX(240%) skewX(-18deg); }
        }
        .group:hover .shine-sweep { animation: shine-sweep 850ms ease; }
      `}</style>

      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-[18px] h-[18px] text-indigo-600" />
        <h2 className="font-display text-lg font-semibold text-slate-900">
          {t('dash.quickActions')}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon

          return (
            <button
              key={action.title}
              onClick={() => router.push(action.href)}
              className={`group relative flex items-center gap-4 overflow-hidden bg-white rounded-2xl p-5 text-left ring-1 ring-slate-200/70 ${action.ring} shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-both`}
              style={{ animationDelay: `${index * 110}ms`, animationDuration: '500ms' }}
            >
              {/* Shine sweep */}
              <span className="shine-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

              <div
                className={`relative w-[52px] h-[52px] rounded-2xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shrink-0 shadow-lg shadow-slate-900/10 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>

              <div className="relative flex-1 min-w-0">
                <p className="font-display font-semibold text-slate-900 text-[15px]">
                  {t(action.title)}
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">{t(action.subtitle)}</p>
              </div>

              <div
                className={`relative w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 transition-colors ${action.arrowBg}`}
              >
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
