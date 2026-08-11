'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Download } from 'lucide-react'
import { renderPdfToImages } from '@/lib/pdf/client'

/**
 * Reading a shared comic in the browser.
 *
 * A share page used to hand the PDF to an `<object>`, which means a grey
 * scrollbar and a browser's built-in reader — or, on most phones, a download
 * prompt. Somebody who followed a link from a friend to look at a comic gets
 * a file manager instead of a comic.
 *
 * This renders the pages and turns them. Nothing clever: one page at a time,
 * arrows, keyboard, swipe. The point is that it works on a phone, which is
 * where shared links are actually opened.
 *
 * Falls back to the original `<object>` when pdf.js cannot read the file —
 * a reader that shows nothing is worse than a scrollbar.
 */

export function Flipbook({
  url,
  title,
  downloadUrl,
}: {
  url: string
  title?: string
  downloadUrl?: string
}) {
  const [pages, setPages] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState('')

  const frameRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    renderPdfToImages(url, {
      // Enough to read on a retina phone without spending a minute decoding a
      // sixty-page book at print resolution.
      maxEdge: 1400,
      // A comic that overruns this is still readable to the cap, which beats
      // locking the tab up trying to decode all of it.
      maxPages: 60,
      onProgress: (done, total) => {
        if (!cancelled) setProgress(`${done} of ${total}`)
      },
    })
      .then((images) => {
        if (cancelled) return

        if (!images || images.length === 0) setFailed(true)
        else setPages(images)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => Math.min(pages.length - 1, Math.max(0, current + delta)))
    },
    [pages.length]
  )

  // Arrow keys, because a comic is read with one hand on the keyboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') go(1)
      if (event.key === 'ArrowLeft') go(-1)
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (loading) {
    return (
      <div className="p-16 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" />
        <p className="mt-3 text-sm text-slate-500">
          Opening{progress ? ` — page ${progress}` : '…'}
        </p>
      </div>
    )
  }

  // A reader that shows nothing is worse than a scrollbar.
  if (failed || pages.length === 0) {
    return (
      <object data={url} type="application/pdf" className="w-full h-[70vh]">
        <div className="p-16 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Your browser cannot show this here.
          </p>
          {downloadUrl && (
            <a
              href={downloadUrl}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
            >
              <Download className="w-4 h-4" />
              Download it instead
            </a>
          )}
        </div>
      </object>
    )
  }

  return (
    <div className="bg-slate-100 dark:bg-slate-950">
      <div
        ref={frameRef}
        className="relative select-none"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0].clientX
        }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return

          const delta = event.changedTouches[0].clientX - touchStart.current

          // 48px so a scroll is not read as a page turn.
          if (Math.abs(delta) > 48) go(delta < 0 ? 1 : -1)

          touchStart.current = null
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pages[index]}
          alt={`${title ?? 'Page'} — page ${index + 1}`}
          className="w-full max-h-[80vh] object-contain mx-auto"
        />

        {/* Tap targets over the outer thirds, which is how a phone is used.
            Hidden from assistive tech: the real buttons below do the same
            job and are labelled. */}
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-y-0 left-0 w-1/3 disabled:pointer-events-none"
        />
        <button
          onClick={() => go(1)}
          disabled={index === pages.length - 1}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-y-0 right-0 w-1/3 disabled:pointer-events-none"
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous page"
          className="h-9 w-9 grid place-items-center rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={pages.length - 1}
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
            aria-label="Page"
            className="w-full accent-indigo-600"
          />
          <p className="text-center text-[11px] text-slate-500 mt-0.5 tabular-nums">
            Page {index + 1} of {pages.length}
          </p>
        </div>

        <button
          onClick={() => frameRef.current?.requestFullscreen?.()}
          aria-label="Full screen"
          className="h-9 w-9 grid place-items-center rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-600 dark:text-slate-300"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => go(1)}
          disabled={index === pages.length - 1}
          aria-label="Next page"
          className="h-9 w-9 grid place-items-center rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
