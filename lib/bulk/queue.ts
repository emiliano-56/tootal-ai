/**
 * Working through a list of ideas unattended.
 *
 * Autopilot already generates without anyone watching, but only on its own
 * schedule and only its own ideas. Somebody with twenty book ideas written
 * down had to sit and paste them in one at a time, waiting a minute each.
 *
 * The queue is the same shape as the posting queue and the autopilot runner,
 * for the same reasons: claimed atomically so two ticks cannot do the same
 * item twice, bounded by an explicit time budget so a killed worker leaves
 * nothing stuck, and given up on after a few tries rather than retried
 * forever.
 *
 * Pure, so the ordering and the stopping rules can be tested without a
 * database or a generation.
 */

export type JobStatus = 'queued' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled'
export type ItemStatus = 'queued' | 'running' | 'done' | 'failed' | 'skipped'

export interface BulkItem {
  id: string
  position: number
  idea: string
  status: ItemStatus
  attempts: number
  startedAt?: string | null
}

/** Give up after this many tries at one idea. */
export const MAX_ATTEMPTS = 2

/**
 * How long an item may sit in `running` before another worker may take it.
 *
 * One comic measures 70-100 seconds end to end. Fifteen minutes is far longer
 * than that and short enough that a killed worker's item is picked up on the
 * next tick rather than stranded until somebody notices.
 */
export const STALE_RUNNING_MS = 15 * 60 * 1000

/** How many ideas one job may hold. */
export const MAX_ITEMS = 100

export interface ParsedIdeas {
  ideas: string[]
  problems: { line: number; reason: string }[]
}

/**
 * Read a pasted list of ideas.
 *
 * One per line. Numbering is stripped because people paste numbered lists and
 * "1. A snail goes north" would otherwise generate a comic about the number
 * one — a small thing that looks like the AI is broken.
 */
export function parseIdeas(text: string): ParsedIdeas {
  const ideas: string[] = []
  const problems: { line: number; reason: string }[] = []
  const seen = new Set<string>()

  String(text ?? '')
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const line = raw.trim()

      if (!line || line.startsWith('#') || line.startsWith('//')) return

      // "1." / "1)" / "- " at the start is list formatting, not the idea.
      const idea = line.replace(/^\s*(?:\d{1,3}[.)]|[-*•])\s*/, '').trim()

      if (idea.length < 3) {
        problems.push({ line: index + 1, reason: 'Too short to generate from' })
        return
      }

      if (ideas.length >= MAX_ITEMS) {
        problems.push({ line: index + 1, reason: `More than ${MAX_ITEMS} ideas` })
        return
      }

      const key = idea.toLowerCase()

      if (seen.has(key)) {
        problems.push({ line: index + 1, reason: 'Already in the list' })
        return
      }

      seen.add(key)
      ideas.push(idea.slice(0, 1000))
    })

  return { ideas, problems }
}

export interface NextItem {
  item: BulkItem | null
  reason?: string
}

/**
 * The next idea to work on.
 *
 * In order, because a customer who wrote a list expects it done in the order
 * they wrote it — a series generated out of order is a series with the wrong
 * numbers on it.
 */
export function nextItem(items: BulkItem[], now: Date = new Date()): NextItem {
  const sorted = [...items].sort((a, b) => a.position - b.position)

  for (const item of sorted) {
    if (item.status === 'done' || item.status === 'skipped') continue

    if (item.status === 'failed') {
      if (item.attempts >= MAX_ATTEMPTS) continue

      return { item }
    }

    if (item.status === 'running') {
      const started = item.startedAt ? new Date(item.startedAt).getTime() : 0

      // A worker that died leaves this behind. Reclaimed rather than stranded.
      if (now.getTime() - started > STALE_RUNNING_MS) return { item }

      return { item: null, reason: 'One is already being generated.' }
    }

    return { item }
  }

  return { item: null, reason: 'Everything in this job is finished.' }
}

export interface Progress {
  total: number
  done: number
  failed: number
  remaining: number
  percent: number
  finished: boolean
}

export function progressOf(items: BulkItem[]): Progress {
  const total = items.length
  const done = items.filter((item) => item.status === 'done').length
  const failed = items.filter(
    (item) => item.status === 'failed' && item.attempts >= MAX_ATTEMPTS
  ).length
  const skipped = items.filter((item) => item.status === 'skipped').length

  const settled = done + failed + skipped

  return {
    total,
    done,
    failed,
    remaining: Math.max(0, total - settled),
    percent: total === 0 ? 0 : Math.round((settled / total) * 100),
    // A job of nothing is not a finished job — that reads as success for work
    // that was never set up.
    finished: total > 0 && settled === total,
  }
}

/** What the job's status should be, given where its items are. */
export function jobStatus(items: BulkItem[], current: JobStatus): JobStatus {
  if (current === 'cancelled' || current === 'paused') return current

  const progress = progressOf(items)

  if (!progress.finished) return items.some((item) => item.status === 'running') ? 'running' : 'queued'

  // Finished with nothing to show for it is a failure; finished with some
  // successes is a success that had failures, which the counts already say.
  return progress.done > 0 ? 'done' : 'failed'
}

/**
 * Roughly how long a job will take.
 *
 * Shown before it starts, because "twenty comics" sounds instant and is
 * closer to forty minutes — and a customer who did not know that will close
 * the tab and assume it broke.
 */
export const SECONDS_PER_ITEM = 110

export function estimateSeconds(remaining: number): number {
  return Math.max(0, Math.floor(remaining)) * SECONDS_PER_ITEM
}

export function describeEstimate(remaining: number): string {
  const seconds = estimateSeconds(remaining)

  if (seconds === 0) return 'Finished'
  if (seconds < 120) return 'About a minute'

  const minutes = Math.round(seconds / 60)

  if (minutes < 60) return `About ${minutes} minutes`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return rest === 0
    ? `About ${hours} hour${hours === 1 ? '' : 's'}`
    : `About ${hours}h ${rest}m`
}
