/**
 * Image type detection from the file's own bytes.
 *
 * The declared MIME type comes from the browser and is trivially faked, and
 * the branding bucket is public — so an upload is checked against its actual
 * signature before it is stored under a name that will be served back.
 */

export type ImageKind = 'png' | 'jpeg' | 'gif' | 'webp' | 'svg' | 'ico' | null

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((byte, index) => bytes[offset + index] === byte)

export function detectImageKind(bytes: Uint8Array): ImageKind {
  if (bytes.length < 12) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'

  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'

  // GIF87a / GIF89a
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif'

  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp'
  }

  // ICO: 00 00 01 00
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return 'ico'

  // SVG is text, so sniff the first chunk for a root element.
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, 512))
    .trim()
    .toLowerCase()

  if (head.startsWith('<?xml') || head.startsWith('<svg')) {
    return head.includes('<svg') ? 'svg' : null
  }

  return null
}

export const EXTENSION: Record<Exclude<ImageKind, null>, string> = {
  png: 'png',
  jpeg: 'jpg',
  gif: 'gif',
  webp: 'webp',
  svg: 'svg',
  ico: 'ico',
}

export const CONTENT_TYPE: Record<Exclude<ImageKind, null>, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
}

/**
 * SVG can carry scripts, which would run on the platform's own origin when
 * the file is served back. Callers that cannot sanitise should refuse it.
 */
export function isScriptableImage(kind: ImageKind): boolean {
  return kind === 'svg'
}
