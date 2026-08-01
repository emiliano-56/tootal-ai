'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { loadPdfjs } from '@/lib/pdf/client'

interface PdfThumbnailProps {
  /** Signed URL of the PDF, or null while it is still being resolved. */
  url: string | null
  className?: string
  /** Accent colour used for the fallback state. */
  tone?: 'blue' | 'purple'
}

export function PdfThumbnail({ url, className = '', tone = 'blue' }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    if (!url) return

    let cancelled = false
    let task: { destroy: () => void } | null = null

    const render = async () => {
      try {
        setStatus('loading')

        const pdfjs = await loadPdfjs()
        if (cancelled) return

        const loadingTask = pdfjs.getDocument({ url })
        task = loadingTask

        const pdf = await loadingTask.promise
        if (cancelled) return

        const page = await pdf.getPage(1)
        if (cancelled) return

        const canvas = canvasRef.current
        if (!canvas) return

        // Scale the first page to fill the card width crisply on retina screens.
        const targetWidth = (canvas.parentElement?.clientWidth || 320) * (window.devicePixelRatio || 1)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: targetWidth / base.width })

        canvas.width = viewport.width
        canvas.height = viewport.height

        const context = canvas.getContext('2d')
        if (!context) return

        await page.render({ canvasContext: context, viewport }).promise
        if (cancelled) return

        setStatus('done')
      } catch (error) {
        if (!cancelled) {
          console.error('[v0] PDF thumbnail render error:', error)
          setStatus('error')
        }
      }
    }

    render()

    return () => {
      cancelled = true
      task?.destroy()
    }
  }, [url])

  const toneClasses =
    tone === 'purple'
      ? 'from-purple-50 to-fuchsia-50 text-purple-400'
      : 'from-blue-50 to-indigo-50 text-blue-400'

  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover object-top transition-opacity duration-300 ${
          status === 'done' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {status !== 'done' && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${toneClasses}`}
        >
          {status === 'loading' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <FileText className="w-7 h-7" />
              <span className="text-[10px] font-medium">Preview unavailable</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
