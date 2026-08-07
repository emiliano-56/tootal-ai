'use client'

import { supabase } from '@/lib/db'

/**
 * Keeping a thumbnail of something the customer just saved.
 *
 * A comic is stored as a PDF, and no social network will render a PDF as a
 * link preview — a share came out as a plain text card. The page has already
 * been drawn to a canvas to build that PDF, so the first one is a free
 * thumbnail; it only has to be put somewhere public.
 *
 * Never throws. Failing to save a thumbnail must not fail the save that
 * produced it.
 */

const BUCKET = 'share-previews'

/** Turn a `data:` URL into bytes without a round trip through fetch(). */
function bytesFrom(dataUrl: string): { blob: Blob; extension: string } | null {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/)

  if (!match) return null

  const binary = atob(match[3])
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)

  return {
    blob: new Blob([bytes], { type: match[1] }),
    extension: match[2] === 'png' ? 'png' : match[2] === 'webp' ? 'webp' : 'jpg',
  }
}

/**
 * Upload a cover and return its permanent public address.
 *
 * The preview bucket is public, unlike everywhere else this project stores
 * work: a network fetching og:image has no session, and a signed URL would
 * expire long before people stop opening the link.
 */
export async function uploadCover(dataUrl: string, name = 'cover'): Promise<string | null> {
  try {
    const parsed = bytesFrom(dataUrl)

    if (!parsed) return null

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    // The user id leads: the storage policy keys write access on that folder.
    const path = `${user.id}/${Date.now()}-${name}.${parsed.extension}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, parsed.blob, { contentType: parsed.blob.type, upsert: false })

    if (error) {
      console.error('[cover] upload failed:', error.message)
      return null
    }

    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  } catch (error) {
    console.error('[cover] failed:', error)
    return null
  }
}
