'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sparkles, PenLine, Palette, Download } from 'lucide-react'
import { useT } from '@/components/locale-provider'

const steps = [
  {
    icon: PenLine,
    title: 'start.step1.title',
    subtitle: 'start.step1.subtitle',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    icon: Palette,
    title: 'start.step2.title',
    subtitle: 'start.step2.subtitle',
    gradient: 'from-purple-500 to-fuchsia-600',
  },
  {
    icon: Download,
    title: 'start.step3.title',
    subtitle: 'start.step3.subtitle',
    gradient: 'from-pink-500 to-rose-600',
  },
]

export function GettingStarted() {
  const router = useRouter()
  const t = useT()

  return (
    <div className="relative overflow-hidden bg-white rounded-2xl p-6 h-full flex flex-col ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-gradient-to-br from-indigo-100 to-transparent opacity-60 pointer-events-none" />

      <div className="flex items-center gap-2.5 mb-6 relative z-10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-[18px] h-[18px] text-white" />
        </div>
        <h3 className="font-display font-semibold text-slate-900 text-[17px]">
          {t('start.heading')}
        </h3>
      </div>

      <div className="relative flex-1 z-10">
        {/* Connecting line */}
        <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-pink-200 rounded-full" />

        <div className="space-y-6">
          {steps.map((step, index) => {
            const Icon = step.icon

            return (
              <div key={step.title} className="group/step flex items-start gap-4 relative">
                <div
                  className={`font-display w-10 h-10 rounded-xl bg-gradient-to-br ${step.gradient} text-white flex items-center justify-center text-[15px] font-bold shrink-0 shadow-lg shadow-slate-900/10 z-10 group-hover/step:scale-110 transition-transform duration-300`}
                >
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0 pt-1.5">
                  <p className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    {t(step.title)}
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {t(step.subtitle)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Button
        onClick={() => router.push('/comic')}
        className="font-display w-full mt-6 h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-[15px] font-semibold shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 transition-all relative z-10"
      >
        {t('start.cta')}
      </Button>
    </div>
  )
}
