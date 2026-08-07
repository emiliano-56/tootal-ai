'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

/**
 * Light / dark / system switch.
 *
 * Renders a placeholder until mounted: the server has no idea which theme the
 * browser will resolve, and rendering the wrong icon first causes a hydration
 * mismatch and a visible flip.
 */

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className={cn('rounded-xl bg-slate-100 dark:bg-slate-800', compact ? 'w-9 h-9' : 'w-[108px] h-9')} />
  }

  if (compact) {
    // Cycles light → dark → system, for places with no room for three buttons.
    const order = ['light', 'dark', 'system']
    const next = order[(order.indexOf(theme ?? 'system') + 1) % order.length]
    const current = OPTIONS.find((o) => o.value === (theme ?? 'system')) ?? OPTIONS[2]

    return (
      <button
        onClick={() => setTheme(next)}
        aria-label={`Theme: ${current.label}. Switch to ${next}.`}
        title={`Theme: ${current.label}`}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <current.Icon className="w-[18px] h-[18px]" />
      </button>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = (theme ?? 'system') === value

        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              active
                ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        )
      })}
    </div>
  )
}
