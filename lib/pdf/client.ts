'use client'

/**
 * Client-side pdf.js helpers.
 *
 * The library is loaded lazily and shared across features (thumbnails,
 * comic-to-video page extraction) so it is only ever fetched once.
 */

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((lib) => {
      // Served from /public by scripts/copy-pdf-worker.js
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      return lib
    })
  }
  return pdfjsPromise
}

export type PdfSource = string | ArrayBuffer | Uint8Array

export interface RenderPagesOptions {
  /** Longest edge of each rendered page, in pixels. */
  maxEdge?: number
  /** Safety cap so a huge PDF cannot lock up the tab. */
  maxPages?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

/**
 * Renders every page of a PDF to JPEG data URLs.
 */
export async function renderPdfToImages(
  source: PdfSource,
  { maxEdge = 1400, maxPages = 40, onProgress, signal }: RenderPagesOptions = {}
): Promise<string[]> {
  const pdfjs = await loadPdfjs()

  const task =
    typeof source === 'string'
      ? pdfjs.getDocument({ url: source })
      : pdfjs.getDocument({ data: source as Uint8Array })

  const pdf = await task.promise

  try {
    const total = Math.min(pdf.numPages, maxPages)
    const images: string[] = []

    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
      if (signal?.aborted) throw new Error('Cancelled')

      const page = await pdf.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })

      // Scale so the longest edge lands on maxEdge, without upscaling small pages.
      const scale = Math.min(maxEdge / Math.max(base.width, base.height), 3)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas is not available in this browser.')

      // PDFs are usually transparent; flatten onto white so JPEG is not black.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvasContext: ctx, viewport }).promise

      images.push(canvas.toDataURL('image/jpeg', 0.92))
      page.cleanup()

      onProgress?.(pageNumber, total)
    }

    return images
  } finally {
    pdf.destroy()
  }
}

/** Reads a File into an ArrayBuffer. */
export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsArrayBuffer(file)
  })
}
