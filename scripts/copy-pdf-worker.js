/**
 * Copies the pdf.js worker into /public so it can be served locally.
 *
 * pdf.js refuses to run when the worker build and the API build differ, so this
 * runs on every install to keep the copy in lockstep with the installed
 * pdfjs-dist version instead of relying on a manually copied file.
 */
const fs = require('fs')
const path = require('path')

const WORKER = 'pdf.worker.min.mjs'

try {
  const pkgPath = require.resolve('pdfjs-dist/package.json')
  const src = path.join(path.dirname(pkgPath), 'build', WORKER)

  if (!fs.existsSync(src)) {
    console.warn(`[pdf-worker] Source not found at ${src} — skipping.`)
    process.exit(0)
  }

  const destDir = path.join(__dirname, '..', 'public')
  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(src, path.join(destDir, WORKER))

  const { version } = require('pdfjs-dist/package.json')
  console.log(`[pdf-worker] Copied ${WORKER} (pdfjs-dist ${version}) into /public`)
} catch (error) {
  // Never fail the install over this — the component degrades to a placeholder.
  console.warn('[pdf-worker] Skipped:', error.message)
}
