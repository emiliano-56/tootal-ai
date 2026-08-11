/**
 * What kind of book the generator is making.
 *
 * Everything it produced was a comic — panels in a grid with speech bubbles —
 * because that is the only shape the prompts described. Two other shapes are
 * the same machinery pointed differently, and each is a product on its own:
 *
 *   STORYBOOK   one full-page illustration per spread, with the text set
 *               underneath rather than lettered into the picture. This is
 *               what a picture book for under-sevens actually is, and it is
 *               a bigger market than comics for that age.
 *
 *   STRIP       three or four panels sized for a social feed. Not a book at
 *               all — a post. Different aspect, far fewer panels, and a
 *               punchline instead of an arc.
 *
 * Pure: what changes is the brief, the panel count and the page shape, and
 * all three are data.
 */

export type ComicFormat = 'comic' | 'storybook' | 'strip'

export interface FormatSpec {
  key: ComicFormat
  label: string
  description: string
  /** Panels on a page. A storybook has one picture per page by definition. */
  panelsPerPage: number
  /** Sensible page count, and the range the UI offers. */
  defaultPages: number
  minPages: number
  maxPages: number
  /** What each panel is drawn at. */
  aspectRatio: string
  /** Whether dialogue is lettered into the art or set as text under it. */
  lettering: 'bubbles' | 'caption-below'
  /** Added to the script brief. */
  brief: string
}

export const FORMATS: FormatSpec[] = [
  {
    key: 'comic',
    label: 'Comic book',
    description: 'Panels on a page with speech bubbles. The classic.',
    panelsPerPage: 4,
    defaultPages: 3,
    minPages: 1,
    maxPages: 12,
    aspectRatio: '1:1',
    lettering: 'bubbles',
    brief: '',
  },
  {
    key: 'storybook',
    label: 'Picture storybook',
    description:
      'One big illustration per page with the words underneath. What a picture book for under-sevens is.',
    panelsPerPage: 1,
    defaultPages: 8,
    minPages: 4,
    maxPages: 24,
    // Landscape: a picture book opens wide, and a square illustration wastes
    // half the spread.
    aspectRatio: '4:3',
    lettering: 'caption-below',
    brief: `This is a PICTURE STORYBOOK, not a comic.

Each page is ONE full illustration with two or three sentences of story set
underneath it. There are no panels and no speech bubbles.

Write the text to be read aloud by an adult to a small child: short sentences,
concrete nouns, a rhythm. Put all of it in the panel's caption. Dialogue goes
in the caption as reported speech — "Pip said he was not scared" — rather than
as a line in a bubble.

The image_prompt describes the whole illustration for that page. It should
carry a full scene with a background, not a character on a plain colour.`,
  },
  {
    key: 'strip',
    label: 'Social strip',
    description: 'Three panels for a feed. A setup, a turn and a punchline.',
    panelsPerPage: 3,
    defaultPages: 1,
    minPages: 1,
    maxPages: 6,
    aspectRatio: '1:1',
    lettering: 'bubbles',
    brief: `This is a THREE-PANEL SOCIAL STRIP, not a book.

Three panels: a setup, a turn, and a punchline. It has to land in the third
panel — a strip that merely stops is not a strip.

Keep the dialogue very short. These are read on a phone at arm's length, so a
line longer than about eight words will not be readable once it is lettered.

No narration captions. Everything is said by a character or shown.`,
  },
]

export function format(key: string | null | undefined): FormatSpec {
  return FORMATS.find((entry) => entry.key === key) ?? FORMATS[0]
}

/**
 * How a finished piece should be laid out for its format.
 *
 * A strip is posted, not printed, so it wants the shape of the feed it is
 * going to. Square is the safe default — it is the one aspect every network
 * shows uncropped in a timeline.
 */
export const STRIP_SHAPES = [
  { key: 'square', label: 'Square 1:1', width: 1080, height: 1080, note: 'Safe everywhere' },
  { key: 'portrait', label: 'Portrait 4:5', width: 1080, height: 1350, note: 'Instagram feed' },
  { key: 'story', label: 'Story 9:16', width: 1080, height: 1920, note: 'Stories and Reels' },
] as const

export function stripShape(key: string) {
  return STRIP_SHAPES.find((entry) => entry.key === key) ?? STRIP_SHAPES[0]
}

/**
 * Panels stacked down a strip, as fractions of the canvas.
 *
 * Down rather than across for every shape: a three-across strip on a portrait
 * canvas gives panels too narrow to read, and vertical is how a phone is held
 * anyway.
 */
export function stripLayout(panels: number, gutter = 0.02): { x: number; y: number; w: number; h: number }[] {
  const count = Math.max(1, Math.min(6, Math.floor(panels)))
  const gap = Math.max(0, Math.min(0.08, gutter))
  const total = 1 - gap * (count - 1)
  const height = total / count

  return Array.from({ length: count }, (_, index) => ({
    x: 0,
    y: index * (height + gap),
    w: 1,
    h: height,
  }))
}

/** The number of pages the format's brief expects, clamped to its own range. */
export function clampPages(spec: FormatSpec, pages: number): number {
  const value = Math.floor(Number(pages) || spec.defaultPages)

  return Math.min(spec.maxPages, Math.max(spec.minPages, value))
}
