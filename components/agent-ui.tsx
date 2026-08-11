'use client'

import { useState, type ReactNode } from 'react'
import { Copy, Check, Loader2, Download } from 'lucide-react'

/** Shared building blocks so every agent page looks and behaves the same. */

export function AgentHeader({
  icon,
  title,
  subtitle,
  gradient = 'from-indigo-500 to-violet-600',
  action,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  gradient?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shadow-slate-900/15`}
        >
          {icon}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

export function Card({
  title,
  subtitle,
  icon,
  right,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  icon?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] p-6 ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center gap-2.5 mb-4">
          {icon}
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-[17px] font-semibold text-slate-900">{title}</h2>
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {right && <div className="ml-auto shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export const fieldLabel =
  'text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block'

export const inputClass =
  'w-full rounded-xl bg-slate-50 px-3.5 py-2.5 outline-none text-slate-900 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all placeholder:text-slate-400'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  /** Sits under the input. For the sentence that stops the field being guessed at. */
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className={fieldLabel}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400 leading-snug">{hint}</p>}
    </div>
  )
}

export function PrimaryButton({
  onClick,
  loading,
  disabled,
  children,
  gradient = 'from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700',
  shadow = 'shadow-indigo-500/25',
  className = '',
}: {
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
  children: ReactNode
  gradient?: string
  shadow?: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`font-display h-11 px-6 rounded-xl bg-gradient-to-r ${gradient} disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg ${shadow} disabled:shadow-none transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0 ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

/** Copy-to-clipboard button with transient confirmation. */
export function CopyButton({
  text,
  label = 'Copy',
  className = '',
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
      className={`h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {label}
        </>
      )}
    </button>
  )
}

/** Downloads a string as a file, client-side. */
export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function DownloadButton({
  filename,
  content,
  mime,
  label = 'Download',
}: {
  filename: string
  content: string
  mime?: string
  label?: string
}) {
  return (
    <button
      onClick={() => downloadText(filename, content, mime)}
      className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
    >
      <Download className="w-3 h-3" />
      {label}
    </button>
  )
}

/** Live step tracker used by the multi-step agents. */
export function StepProgress({
  steps,
  currentIndex,
  failedIndex,
}: {
  steps: { key: string; label: string }[]
  currentIndex: number
  failedIndex?: number
}) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        const failed = failedIndex === i

        return (
          <li key={step.key} className="flex items-center gap-3">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                failed
                  ? 'bg-rose-100 text-rose-600'
                  : done
                    ? 'bg-emerald-100 text-emerald-600'
                    : active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-400'
              }`}
            >
              {failed ? '!' : done ? <Check className="w-3 h-3" /> : active ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={`text-sm ${
                failed
                  ? 'text-rose-600 font-medium'
                  : done
                    ? 'text-slate-500'
                    : active
                      ? 'text-slate-900 font-medium'
                      : 'text-slate-400'
              }`}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-xl px-3.5 py-2.5">
      {message}
    </p>
  )
}
