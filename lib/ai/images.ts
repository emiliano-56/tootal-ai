import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveGenerationBackend } from '@/lib/ai/generation-backend'

/**
 * Drawing a picture from the server.
 *
 * Every other caller of the generation backend runs in the browser, for a good
 * reason: a comic is a dozen images and a dozen round trips would outlast any
 * serverless invocation. Autopilot has no browser, so it needs this — but the
 * same limit applies, which is why callers here render one or two images and
 * not a whole book.
 *
 * Everything returns null rather than throwing. A campaign that produced a
 * good episode should not be recorded as a failure because the picture did
 * not come back.
 */

export const PREVIEW_BUCKET = 'share-previews'

/**
 * Longest we will wait for one image.
 *
 * Measured against the live backend: 48-64 seconds for a 2048px render. Two
 * minutes leaves room for a slow day without holding the scheduler open on a
 * request that is never coming back.
 */
const IMAGE_TIMEOUT_MS = 120_000

export interface GeneratedImage {
  /** Either shape is fine: Supabase storage accepts both. */
  bytes: ArrayBuffer | Uint8Array
  contentType: string
}

/**
 * Ask the backend for one image.
 *
 * The backend answers with a URL rather than the bytes, so this is two
 * requests; both are bounded, because a hung fetch here would hold the whole
 * scheduler open.
 */
export interface ImageOptions {
  aspectRatio?: string
  /**
   * Reference pictures for the illustrator.
   *
   * The backend takes these on all three image endpoints and honours them
   * properly — measured against the live API, a reference came back redrawn
   * in the requested style with the subject, markings and pose intact. It is
   * what makes a character look like themselves twice.
   *
   * Each must be publicly fetchable: the backend loads them over the open
   * internet, so a signed or local URL simply fails.
   */
  imageUrls?: string[]
  /** Longer for an img2img job, which fetches before it draws. */
  timeoutMs?: number
}

export async function generateImage(
  prompt: string,
  options: string | ImageOptions = '1:1'
): Promise<GeneratedImage | null> {
  // The old signature took an aspect ratio string. Kept working because every
  // existing caller uses it and a silent change of meaning would be worse
  // than an overload.
  const settings: ImageOptions = typeof options === 'string' ? { aspectRatio: options } : options

  const aspectRatio = settings.aspectRatio ?? '1:1'
  const references = (settings.imageUrls ?? []).filter(Boolean).slice(0, 4)
  const timeout = settings.timeoutMs ?? (references.length > 0 ? 240_000 : IMAGE_TIMEOUT_MS)

  try {
    const { url } = await resolveGenerationBackend()

    const response = await fetch(`${url}/coloring/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.slice(0, 2000),
        aspect_ratio: aspectRatio,
        // Omitted entirely rather than sent as [] — the field is nullable and
        // an empty array is a different thing from "no references".
        ...(references.length > 0 ? { image_urls: references } : {}),
      }),
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      console.error('[images] backend refused:', response.status)
      return null
    }

    const payload = (await response.json().catch(() => ({}))) as { image_url?: string }

    if (!payload.image_url) {
      console.error('[images] backend returned no image_url')
      return null
    }

    const file = await fetch(payload.image_url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) })

    if (!file.ok) {
      console.error('[images] could not fetch the rendered image:', file.status)
      return null
    }

    return {
      bytes: await file.arrayBuffer(),
      contentType: file.headers.get('content-type') ?? 'image/png',
    }
  } catch (error) {
    console.error('[images] generation failed:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Convert to JPEG.
 *
 * Instagram's publishing API accepts JPEG and nothing else — a PNG is refused
 * outright, which would make every Instagram post fail for a reason nobody
 * could guess from the error. Everywhere else is happy with JPEG too, so the
 * conversion is unconditional.
 *
 * Imported lazily and allowed to fail: a deployment without sharp should post
 * a PNG that Facebook and Telegram accept, rather than posting nothing.
 */
async function toJpeg(image: GeneratedImage): Promise<GeneratedImage> {
  if (image.contentType.includes('jpeg')) return image

  try {
    const sharp = (await import('sharp')).default

    // Buffer.from needs a view, not a raw ArrayBuffer.
    const input =
      image.bytes instanceof Uint8Array ? image.bytes : new Uint8Array(image.bytes)

    const bytes = await sharp(input)
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer()

    return { bytes, contentType: 'image/jpeg' }
  } catch (error) {
    console.error('[images] JPEG conversion unavailable:', error instanceof Error ? error.message : error)
    return image
  }
}

/**
 * Put an image where the outside world can see it.
 *
 * The preview bucket is public on purpose: a network fetching og:image has no
 * session, and a signed URL would expire long before the post stops being
 * shared. Nothing goes in here that the customer has not chosen to publish.
 */
export async function storePreview(
  userId: string,
  original: GeneratedImage,
  name = 'cover'
): Promise<string | null> {
  const image = await toJpeg(original)
  const extension = image.contentType.includes('jpeg') ? 'jpg' : 'png'
  // The user id leads, because the storage policy keys write access on it.
  const path = `${userId}/${Date.now()}-${name}.${extension}`

  const { error } = await supabaseAdmin.storage
    .from(PREVIEW_BUCKET)
    .upload(path, image.bytes, { contentType: image.contentType, upsert: false })

  if (error) {
    console.error('[images] upload failed:', error.message)
    return null
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(PREVIEW_BUCKET).getPublicUrl(path)

  return publicUrl
}

/** Draw one image and publish it, in a single step. */
export async function renderPreview(
  userId: string,
  prompt: string,
  options: { aspectRatio?: string; name?: string; imageUrls?: string[] } = {}
): Promise<string | null> {
  const image = await generateImage(prompt, {
    aspectRatio: options.aspectRatio ?? '1:1',
    imageUrls: options.imageUrls,
  })

  if (!image) return null

  return storePreview(userId, image, options.name)
}

export const CHARACTER_BUCKET = 'characters'

/**
 * Keep a character reference where the illustrator can fetch it.
 *
 * Three differences from `storePreview`, each of which matters:
 *
 *   - No JPEG conversion. A reference is drawn on plain white and is about to
 *     be handed back to an image model; JPEG's ringing around hard edges is
 *     exactly the kind of artefact that model would faithfully reproduce.
 *   - The path comes back as well as the URL, because deleting a character
 *     has to delete the file and a public URL is not a handle for that.
 *   - Its own bucket, so a character reference is never swept up by whatever
 *     cleans out expired share previews.
 */
export async function storeCharacterImage(
  userId: string,
  image: GeneratedImage,
  name = 'reference'
): Promise<{ path: string; url: string } | null> {
  const extension = image.contentType.includes('jpeg') ? 'jpg' : 'png'
  const safe = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'reference'
  // The user id leads, because the storage policy keys write access on it.
  const path = `${userId}/${Date.now()}-${safe}.${extension}`

  const { error } = await supabaseAdmin.storage
    .from(CHARACTER_BUCKET)
    .upload(path, image.bytes, { contentType: image.contentType, upsert: false })

  if (error) {
    console.error('[images] character upload failed:', error.message)
    return null
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(CHARACTER_BUCKET).getPublicUrl(path)

  return { path, url: publicUrl }
}

/**
 * A cover prompt for an episode.
 *
 * Built from the first panel rather than the title alone: the panel prompt
 * already names the characters and restates their appearance, which is what
 * keeps a series looking like one series across weeks of episodes.
 */
export function coverPromptFor(
  title: string,
  firstPanelPrompt: string | undefined,
  artStyle: string
): string {
  const base = firstPanelPrompt?.trim()

  if (base) return `${base}. Art style: ${artStyle}. Bright, appealing cover composition.`

  return `Book cover illustration for a children's comic titled "${title}". Art style: ${artStyle}. Bright, appealing, no text.`
}
