'use client'

import { useState } from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'
import type { Block, Presented } from '@/lib/agents/present'

/**
 * Rendering a stored result the way it was made.
 *
 * The blocks come from lib/agents/present, which knows each agent's shape.
 * This only draws them — so adding an agent means teaching the presenter, not
 * editing this file.
 */

export function ResultView({ presented }: { presented: Presented }) {
  return (
    <div className="space-y-5">
      {presented.blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'text':
      return (
        <Section label={block.label}>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {block.value}
          </p>
        </Section>
      )

    case 'quote':
      return (
        <Section label={block.label}>
          <blockquote className="border-l-4 border-indigo-200 dark:border-indigo-500/40 pl-4 text-sm italic text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {block.value}
          </blockquote>
        </Section>
      )

    case 'list':
      return (
        <Section label={block.label}>
          <ul className="space-y-1.5">
            {block.items.map((item, index) => (
              <li
                key={index}
                className="flex gap-2 text-sm text-slate-700 dark:text-slate-300 group"
              >
                <span className="text-indigo-400 shrink-0">•</span>
                <span className="flex-1 whitespace-pre-wrap">{item}</span>
                <CopyBit value={item} />
              </li>
            ))}
          </ul>
        </Section>
      )

    case 'pairs':
      return (
        <Section label={block.label}>
          <div className="rounded-xl ring-1 ring-slate-200 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {block.items.map((item, index) => (
              <div key={index} className="p-3">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{item.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap mt-0.5">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )

    case 'gallery':
      return (
        <Section label={block.label}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {block.images.map((image, index) => (
              <figure key={index} className="rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.caption ?? ''} className="w-full" loading="lazy" />
                {image.caption && (
                  <figcaption className="p-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {image.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </Section>
      )

    case 'pages':
      return (
        <Section label={block.label}>
          <div className="space-y-3">
            {block.pages.map((page, index) => (
              <div
                key={index}
                className="rounded-xl ring-1 ring-slate-200 dark:ring-slate-800 p-3.5 bg-white dark:bg-slate-900"
              >
                <p className="text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                  {page.heading}
                </p>

                <div className="space-y-1">
                  {page.lines.map((line, lineIndex) => (
                    <p
                      key={lineIndex}
                      className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )

    case 'html':
      return <HtmlBlock block={block} />

    case 'raw':
      return (
        <Section label={block.label}>
          <details className="rounded-xl ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
              Show the raw result
            </summary>
            <pre className="p-3 text-[11px] overflow-auto max-h-80 text-slate-600 dark:text-slate-400">
              {block.value}
            </pre>
          </details>
        </Section>
      )

    default:
      return null
  }
}

/**
 * A generated landing page, shown as a page rather than as markup.
 *
 * Sandboxed with no permissions at all: the HTML came from a language model,
 * and rendering it inline would let anything it invented run on this origin
 * with the customer's session.
 */
function HtmlBlock({ block }: { block: Extract<Block, { type: 'html' }> }) {
  const [showSource, setShowSource] = useState(false)

  return (
    <Section label={block.label}>
      <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
        {showSource ? (
          <pre className="p-3 text-[11px] overflow-auto max-h-96 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900">
            {block.value}
          </pre>
        ) : (
          <iframe
            srcDoc={block.value}
            sandbox=""
            title="Generated page"
            className="w-full h-96 bg-white"
          />
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={() => setShowSource((current) => !current)}
          className="text-xs font-semibold text-indigo-600 hover:underline"
        >
          {showSource ? 'Show the page' : 'Show the code'}
        </button>

        <CopyBit value={block.value} label="Copy the HTML" />
      </div>
    </Section>
  )
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section>
      {label && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          {label}
        </p>
      )}
      {children}
    </section>
  )
}

function CopyBit({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      aria-label={label ?? 'Copy'}
      className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-indigo-600 ${
        label ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'
      }`}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      {label}
    </button>
  )
}

export { ChevronDown }
