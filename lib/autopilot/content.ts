/**
 * What Autopilot posts, and where each day's idea comes from.
 *
 * Two decisions the campaign form never asked, and both of them matter more
 * than anything it did ask:
 *
 *   1. WHAT. Every campaign produced a comic episode, because that is what the
 *      engine was written to produce. A customer running a colouring-page
 *      channel got comics, and a customer who only wanted captions paid for
 *      artwork they threw away.
 *
 *   2. WHERE THE IDEA COMES FROM. The engine invents one. That is the right
 *      default and it is not always what is wanted — somebody running a
 *      thirty-day launch has the thirty ideas already written down, in order,
 *      and handing them to a model that will cheerfully invent a thirty-first
 *      is not automation, it is a loss of control.
 *
 * Pure, so the import parsing and the day arithmetic can be tested without a
 * database or a model.
 */

export type ContentKind = 'comic' | 'coloring' | 'post' | 'video'

export const CONTENT_KINDS: {
  kind: ContentKind
  label: string
  description: string
  /** The monthly allowance one run spends. */
  feature: string
  /** Whether a run draws anything. Text-only runs are far cheaper and faster. */
  draws: boolean
}[] = [
  {
    kind: 'comic',
    label: 'Comic episode',
    description: 'A short illustrated episode with a cover. The full thing.',
    feature: 'comic',
    draws: true,
  },
  {
    kind: 'coloring',
    label: 'Colouring pages',
    description: 'Line-art pages to print and colour in. No story panels.',
    feature: 'coloring',
    draws: true,
  },
  {
    kind: 'post',
    label: 'Social post only',
    description: 'Caption, hashtags and one image. Fastest and cheapest per run.',
    feature: 'marketing',
    draws: true,
  },
  {
    kind: 'video',
    label: 'Video script',
    description: 'A narrated shot list ready to record. No rendering.',
    feature: 'video',
    draws: false,
  },
]

export function contentKind(value: unknown): ContentKind {
  return CONTENT_KINDS.some((entry) => entry.kind === value) ? (value as ContentKind) : 'comic'
}

export function featureFor(kind: ContentKind): string {
  return CONTENT_KINDS.find((entry) => entry.kind === kind)?.feature ?? 'comic'
}

export function drawsArtwork(kind: ContentKind): boolean {
  return CONTENT_KINDS.find((entry) => entry.kind === kind)?.draws ?? true
}

// ---------------------------------------------------------------------------
//  Where the ideas come from
// ---------------------------------------------------------------------------

export type IdeaSource = 'ai' | 'planned'

export function ideaSource(value: unknown): IdeaSource {
  return value === 'planned' ? 'planned' : 'ai'
}

/**
 * What to do when a planned campaign runs out of days.
 *
 * Genuinely a choice rather than an oversight. A thirty-day launch should stop
 * on day thirty-one — carrying on would post something the customer never
 * approved under a campaign they thought had ended. A perpetual channel that
 * seeded the first month by hand wants the model to take over.
 */
export type WhenPlanEnds = 'stop' | 'continue_with_ai' | 'repeat'

export function whenPlanEnds(value: unknown): WhenPlanEnds {
  return value === 'continue_with_ai' || value === 'repeat' ? value : 'stop'
}

export interface PlanItem {
  /** 1-based. Day 1 is the first run, not necessarily tomorrow. */
  day: number
  title: string
  prompt: string
}

export interface ParsedPlan {
  items: PlanItem[]
  /** Lines that could not be read, with the reason and the original text. */
  problems: { line: number; text: string; reason: string }[]
}

const MAX_DAYS = 365
const MAX_TITLE = 200
const MAX_PROMPT = 2000

/**
 * Read a pasted or uploaded plan.
 *
 * Accepts the three shapes people actually have. A customer with a plan in a
 * spreadsheet should not have to reformat it:
 *
 *     1. Day one title | the prompt for day one      explicit day, piped
 *     Day 2: title | prompt                          "Day N" prefix
 *     just a prompt on its own line                   numbered by position
 *
 * A tab or a comma works as well as a pipe, because that is what a paste out
 * of Excel or a CSV actually contains.
 *
 * Blank lines are separators, not errors — people space their lists out.
 */
export function parsePlan(text: string): ParsedPlan {
  const items: PlanItem[] = []
  const problems: ParsedPlan['problems'] = []
  const claimed = new Set<number>()

  const lines = String(text ?? '').split(/\r?\n/)

  lines.forEach((raw, index) => {
    const line = raw.trim()

    if (!line) return

    // A comment, so a customer can annotate their own plan.
    if (line.startsWith('#') || line.startsWith('//')) return

    if (items.length >= MAX_DAYS) {
      problems.push({ line: index + 1, text: line, reason: `More than ${MAX_DAYS} days` })
      return
    }

    // "12." / "12)" / "Day 12:" / "Day 12 -" at the start names the day.
    const dayMatch = line.match(/^(?:day\s*)?(\d{1,3})\s*[.):\-–]\s*(.*)$/i)

    let day = 0
    let rest = line

    if (dayMatch) {
      day = Number(dayMatch[1])
      rest = dayMatch[2].trim()
    }

    // The separator is whichever of these appears first, so a prompt
    // containing a comma does not get cut at the comma when a pipe was used.
    const cut = ['|', '\t'].map((sep) => rest.indexOf(sep)).filter((at) => at >= 0)
    const at = cut.length > 0 ? Math.min(...cut) : -1

    let title = ''
    let prompt = ''

    if (at >= 0) {
      title = rest.slice(0, at).trim()
      prompt = rest.slice(at + 1).trim()
    } else {
      // No separator: the whole line is the prompt, and the title is the first
      // few words of it — a plan of bare prompts is a perfectly ordinary thing
      // to paste, and inventing a title beats refusing the line.
      prompt = rest
      title = rest.split(/\s+/).slice(0, 8).join(' ')
    }

    if (!prompt) {
      problems.push({ line: index + 1, text: line, reason: 'No prompt on this line' })
      return
    }

    // An explicit day that collides is reported rather than silently
    // overwriting — two ideas for day 4 means the customer miscounted, and
    // discovering that on day 4 is too late.
    if (day > 0 && claimed.has(day)) {
      problems.push({ line: index + 1, text: line, reason: `Day ${day} is already taken` })
      return
    }

    // Unnumbered lines fill the next free day, so a mixed list still works.
    if (day <= 0) {
      day = 1
      while (claimed.has(day)) day++
    }

    if (day > MAX_DAYS) {
      problems.push({ line: index + 1, text: line, reason: `Day ${day} is beyond ${MAX_DAYS}` })
      return
    }

    claimed.add(day)

    items.push({
      day,
      title: (title || prompt).slice(0, MAX_TITLE),
      prompt: prompt.slice(0, MAX_PROMPT),
    })
  })

  items.sort((a, b) => a.day - b.day)

  return { items, problems }
}

/** Renumber so the days run 1..n with no gaps, keeping the order. */
export function compactPlan(items: PlanItem[]): PlanItem[] {
  return [...items]
    .sort((a, b) => a.day - b.day)
    .map((item, index) => ({ ...item, day: index + 1 }))
}

export interface PlanProgress {
  total: number
  used: number
  remaining: number
  /** The day the next run will take. Null when the plan is finished. */
  nextDay: number | null
  finished: boolean
}

export function planProgress(items: { day: number; used: boolean }[]): PlanProgress {
  const sorted = [...items].sort((a, b) => a.day - b.day)
  const next = sorted.find((item) => !item.used)

  const used = sorted.filter((item) => item.used).length

  return {
    total: sorted.length,
    used,
    remaining: sorted.length - used,
    nextDay: next?.day ?? null,
    finished: sorted.length > 0 && !next,
  }
}

/**
 * What a run should do next, given the plan and the campaign's settings.
 *
 * Returning a decision rather than doing it, so the engine has one branch and
 * this file has all the reasoning.
 */
export type NextAction =
  | { action: 'use_planned'; day: number }
  | { action: 'use_ai' }
  | { action: 'stop'; reason: string }

export function decideNext(input: {
  source: IdeaSource
  plan: { day: number; used: boolean }[]
  whenEnds: WhenPlanEnds
}): NextAction {
  if (input.source === 'ai') return { action: 'use_ai' }

  const progress = planProgress(input.plan)

  if (progress.total === 0) {
    // A planned campaign with nothing in it is a setup mistake, and inventing
    // content would hide it. Said plainly instead.
    return { action: 'stop', reason: 'This campaign is set to follow a plan, but the plan is empty.' }
  }

  if (progress.nextDay !== null) return { action: 'use_planned', day: progress.nextDay }

  if (input.whenEnds === 'continue_with_ai') return { action: 'use_ai' }

  if (input.whenEnds === 'repeat') {
    // Back to day one. The caller resets the used flags.
    return { action: 'use_planned', day: Math.min(...input.plan.map((item) => item.day)) }
  }

  return { action: 'stop', reason: `The plan finished after ${progress.total} days.` }
}
