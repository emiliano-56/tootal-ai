/**
 * Keeping a character looking like themselves.
 *
 * Two mechanisms, and they are not alternatives — they work on different
 * parts of the pipeline and both are needed:
 *
 *   1. WORDS. The appearance is repeated verbatim into every image prompt.
 *      This is what the prompts already tried to do, and on its own it
 *      drifts: "a small snail with a rainbow shell" is a different snail
 *      every time, because a sentence does not pin down a face.
 *
 *   2. A PICTURE. The backend accepts `image_urls` and honours them —
 *      measured against the live API, a reference came back redrawn in a
 *      new style with the subject and markings intact. This is what
 *      actually holds a character steady.
 *
 * Words still matter with a picture attached: the reference fixes *who*,
 * the prompt says *what they are doing*. Dropping the description and
 * relying on the image alone produces the right character in the wrong pose.
 *
 * Pure, so prompt assembly and the reference rules can be tested without a
 * database or a generation call.
 */

export interface Character {
  id: string
  name: string
  role?: string
  appearance?: string
  personality?: string
  /** Public URL of the reference. Null when the character is words only. */
  imageUrl?: string | null
  artStyle?: string
  /** Extra poses, most useful first. */
  poses?: { imageUrl: string; label?: string; primary?: boolean }[]
}

/**
 * How many reference images to send with one request.
 *
 * More is not better past a point: each one costs upload and fetch time on
 * the backend, and a crowd of references pulls the result toward an average
 * of them rather than toward any one character. Three is enough for a two
 * or three-hander, which is what these comics are.
 */
export const MAX_REFERENCES = 3

/** Trimmed and length-capped, because these go into a prompt. */
const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''

/**
 * The reference images to send for a set of characters.
 *
 * The main reference of each character comes first, in the order the
 * characters were given, so a two-character scene sends one picture of each
 * rather than three of the first. Poses marked primary fill any space left.
 *
 * Deduplicated: the same URL twice tells the model nothing new and wastes a
 * slot that another character needed.
 */
export function referenceImages(cast: Character[], limit = MAX_REFERENCES): string[] {
  const seen = new Set<string>()
  const picked: string[] = []

  const add = (url: string | null | undefined) => {
    const value = typeof url === 'string' ? url.trim() : ''

    if (!value || seen.has(value) || picked.length >= limit) return

    seen.add(value)
    picked.push(value)
  }

  // One each, in order, before anyone gets a second.
  for (const character of cast) add(character.imageUrl)

  for (const character of cast) {
    for (const pose of character.poses ?? []) {
      if (pose.primary) add(pose.imageUrl)
    }
  }

  return picked
}

/**
 * The sentence that pins a character down, for the image prompt.
 *
 * Names are included because the script refers to them by name, and a
 * prompt that describes "a small snail" while the caption says "Pip" reads
 * as two different characters to anyone assembling the page.
 */
export function describeCharacter(character: Character): string {
  const name = clean(character.name, 80)
  const appearance = clean(character.appearance, 600)

  if (!name) return ''
  if (!appearance) return name

  return `${name}: ${appearance}`
}

/**
 * The block of text appended to a generation prompt.
 *
 * Empty for an empty cast, so a customer who never opens Character Studio
 * gets exactly the prompt they got before — no behaviour change, no
 * redundant instruction for a model to trip over.
 */
export function castDirective(cast: Character[], hasReferences = false): string {
  const described = cast.map(describeCharacter).filter(Boolean)

  if (described.length === 0) return ''

  const lines = [
    '',
    '',
    'RECURRING CAST — these characters must look exactly the same in every panel:',
    ...described.map((line) => `- ${line}`),
    '',
    'Restate the full appearance of each character in every single image prompt.',
    'Never write "the same character as before" — each prompt is sent to an image',
    'model on its own and it has not seen the others.',
  ]

  if (hasReferences) {
    // Said explicitly because the model writing the prompts is not the model
    // receiving the pictures, and it will otherwise describe a character the
    // reference already settles — sometimes contradicting it.
    lines.push(
      '',
      'Reference images of these characters are supplied to the illustrator.',
      'Describe what they are doing and where they are; do not invent new',
      'details about how they look.'
    )
  }

  return lines.join('\n')
}

/**
 * The prompt for one panel, with the cast pinned into it.
 *
 * The character description goes after the scene rather than before it.
 * Image models weight the beginning of a prompt most heavily, and the scene
 * is what changes panel to panel — leading with a paragraph of unchanging
 * appearance produces panels that are all portrait and no story.
 */
export function panelPrompt(scene: string, cast: Character[], artStyle = ''): string {
  const parts = [clean(scene, 1500)].filter(Boolean)

  const described = cast.map(describeCharacter).filter(Boolean)

  if (described.length > 0) parts.push(`Characters in this panel — ${described.join('. ')}.`)

  const style = clean(artStyle, 200)

  if (style) parts.push(`Art style: ${style}.`)

  return parts.join(' ')
}

/**
 * The prompt for a character's own reference portrait.
 *
 * Deliberately plain: neutral pose, plain background, whole body, no props
 * and no scene. Everything that makes a good illustration makes a bad
 * reference — a character mid-action against a sunset teaches the model the
 * sunset as much as the character.
 */
export function referencePrompt(character: Character, artStyle = ''): string {
  const parts = [
    'Full-body character reference sheet of a single character, standing in a neutral pose, facing forward, arms relaxed at their sides.',
    'Plain flat white background. No text, no logos, no props, no scenery, no other characters.',
    'Even, soft lighting with no dramatic shadows.',
  ]

  const described = describeCharacter(character)

  if (described) parts.push(`The character: ${described}.`)

  const style = clean(artStyle || character.artStyle || '', 200)

  if (style) parts.push(`Art style: ${style}.`)

  return parts.join(' ')
}

/** The angles a model sheet is drawn from, and how to ask for each. */
export const POSE_PRESETS: { key: string; label: string; instruction: string }[] = [
  { key: 'front', label: 'Front', instruction: 'standing facing directly forward' },
  { key: 'side', label: 'Side', instruction: 'standing in full profile, facing right' },
  { key: 'back', label: 'Back', instruction: 'standing seen from directly behind' },
  { key: 'happy', label: 'Happy', instruction: 'head and shoulders, smiling warmly' },
  { key: 'sad', label: 'Sad', instruction: 'head and shoulders, downcast and sad' },
  { key: 'surprised', label: 'Surprised', instruction: 'head and shoulders, eyes wide in surprise' },
  { key: 'action', label: 'Action', instruction: 'mid-stride, running energetically' },
]

export function posePrompt(character: Character, poseKey: string, artStyle = ''): string {
  const preset = POSE_PRESETS.find((entry) => entry.key === poseKey)

  const parts = [
    `Character reference of a single character, ${preset?.instruction ?? 'standing facing forward'}.`,
    'Plain flat white background. No text, no props, no scenery, no other characters.',
  ]

  const described = describeCharacter(character)

  if (described) parts.push(`The character: ${described}.`)

  const style = clean(artStyle || character.artStyle || '', 200)

  if (style) parts.push(`Art style: ${style}. Keep the design identical to the reference image.`)

  return parts.join(' ')
}

/**
 * Whether a URL can be used as a reference.
 *
 * The backend fetches it over the open internet, so it has to be public and
 * absolute. Two failures are worth catching before a job is spent:
 *
 *   - A relative or localhost URL, which the backend cannot reach at all.
 *   - The backend's own ephemeral output URL. Those expire, so storing one
 *     as a character's reference produces a character that silently loses
 *     its face weeks later — the worst kind of bug, because nothing fails
 *     at the time.
 */
export function usableReference(url: string | null | undefined): {
  ok: boolean
  reason?: string
} {
  const value = typeof url === 'string' ? url.trim() : ''

  if (!value) return { ok: false, reason: 'No image' }

  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    return { ok: false, reason: 'Not a full URL — the illustrator fetches it over the internet' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'Only http and https can be fetched' }
  }

  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(parsed.hostname)) {
    return { ok: false, reason: 'A local address is not reachable from the illustrator' }
  }

  if (parsed.hostname.includes('theapi.app') && parsed.pathname.includes('/ephemeral/')) {
    return {
      ok: false,
      reason: 'That link expires. Save the image to your library first.',
    }
  }

  return { ok: true }
}

/** Cast that is actually usable as visual references, and why any are not. */
export function checkCast(cast: Character[]): {
  withReference: Character[]
  wordsOnly: Character[]
  problems: { name: string; reason: string }[]
} {
  const withReference: Character[] = []
  const wordsOnly: Character[] = []
  const problems: { name: string; reason: string }[] = []

  for (const character of cast) {
    if (!character.imageUrl) {
      wordsOnly.push(character)
      continue
    }

    const check = usableReference(character.imageUrl)

    if (check.ok) withReference.push(character)
    else {
      wordsOnly.push(character)
      problems.push({ name: character.name, reason: check.reason ?? 'Unusable reference' })
    }
  }

  return { withReference, wordsOnly, problems }
}
