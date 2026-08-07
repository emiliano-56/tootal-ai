import { describe, it, expect } from 'vitest'
import {
  detectImageKind,
  isScriptableImage,
  EXTENSION,
  CONTENT_TYPE,
} from '@/lib/storage/image-signature'

/** Build a buffer that starts with the given signature bytes. */
function withSignature(signature: number[], length = 64): Uint8Array {
  const bytes = new Uint8Array(length)

  signature.forEach((byte, index) => (bytes[index] = byte))

  return bytes
}

describe('image signature detection', () => {
  it('detects PNG', () => {
    expect(detectImageKind(withSignature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png')
  })

  it('detects JPEG', () => {
    expect(detectImageKind(withSignature([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg')
  })

  it('detects GIF', () => {
    expect(detectImageKind(withSignature([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('gif')
  })

  it('detects WebP, which needs both RIFF and WEBP markers', () => {
    const bytes = withSignature([0x52, 0x49, 0x46, 0x46])

    // A RIFF container alone is not WebP — it could be a WAV file.
    expect(detectImageKind(bytes)).toBeNull()

    ;[0x57, 0x45, 0x42, 0x50].forEach((byte, i) => (bytes[8 + i] = byte))

    expect(detectImageKind(bytes)).toBe('webp')
  })

  it('detects ICO', () => {
    expect(detectImageKind(withSignature([0x00, 0x00, 0x01, 0x00]))).toBe('ico')
  })

  it('detects SVG from its text content', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

    expect(detectImageKind(svg)).toBe('svg')
  })

  it('detects SVG behind an XML declaration', () => {
    const svg = new TextEncoder().encode('<?xml version="1.0"?>\n<svg xmlns="x"></svg>')

    expect(detectImageKind(svg)).toBe('svg')
  })
})

describe('rejecting disguised files', () => {
  it('rejects an executable renamed as an image', () => {
    // MZ header — a Windows executable.
    expect(detectImageKind(withSignature([0x4d, 0x5a, 0x90, 0x00]))).toBeNull()
  })

  it('rejects a script renamed as an image', () => {
    const script = new TextEncoder().encode('<script>alert(1)</script>'.padEnd(64))

    expect(detectImageKind(script)).toBeNull()
  })

  it('rejects XML that is not SVG', () => {
    const xml = new TextEncoder().encode('<?xml version="1.0"?><rss><channel/></rss>')

    expect(detectImageKind(xml)).toBeNull()
  })

  it('rejects a buffer too short to identify', () => {
    expect(detectImageKind(new Uint8Array([0x89, 0x50]))).toBeNull()
    expect(detectImageKind(new Uint8Array())).toBeNull()
  })

  it('rejects plain text', () => {
    expect(detectImageKind(new TextEncoder().encode('just some text here, nothing more'))).toBeNull()
  })
})

describe('scriptable image policy', () => {
  it('treats SVG as scriptable and the raster formats as safe', () => {
    expect(isScriptableImage('svg')).toBe(true)

    for (const kind of ['png', 'jpeg', 'gif', 'webp', 'ico'] as const) {
      expect(isScriptableImage(kind)).toBe(false)
    }
  })
})

describe('extension and content type maps', () => {
  it('covers every detectable kind', () => {
    for (const kind of ['png', 'jpeg', 'gif', 'webp', 'svg', 'ico'] as const) {
      expect(EXTENSION[kind]).toBeTruthy()
      expect(CONTENT_TYPE[kind]).toMatch(/^image\//)
    }
  })

  it('writes .jpg rather than .jpeg', () => {
    expect(EXTENSION.jpeg).toBe('jpg')
  })
})
