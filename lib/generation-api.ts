/**
 * Base URL of the image/video generation backend.
 *
 * One definition instead of the seven copies this used to have — moving the
 * backend previously meant finding every hardcoded literal, and missing one
 * left a page silently pointed at the old host.
 *
 * This stays in the environment rather than the `api_credentials` table because
 * it is consumed by client components: a database lookup would cost a round
 * trip on every page, and the value is not a secret — a NEXT_PUBLIC_ variable
 * is shipped to the browser either way.
 */

export const GENERATION_API_URL = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || 'https://zoop-a1-v2.onrender.com'
).replace(/\/$/, '')

/** Join a path onto the backend URL without doubling or dropping the slash. */
export function generationUrl(path: string): string {
  return `${GENERATION_API_URL}/${path.replace(/^\//, '')}`
}
