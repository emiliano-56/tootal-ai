/**
 * Scheduling a post the customer made by hand.
 *
 * Autopilot already posts on a clock, but only what Autopilot generated.
 * Nothing could take a finished comic and put it out on Friday morning. The
 * connections, the publisher and the cron that drives them all exist — this
 * is the queue that was missing, and the rules about when a queued post is
 * due, which is the part worth getting exactly right.
 *
 * Pure, so the timing edges — a post scheduled in the past, a run that
 * overlaps the last one, a network that failed twice — can be tested without
 * waiting for a clock.
 */

export type PostStatus = 'scheduled' | 'posting' | 'posted' | 'failed' | 'cancelled'

export interface ScheduledPost {
  id: string
  caption: string
  hashtags: string[]
  imageUrl?: string | null
  linkUrl?: string | null
  connectionIds: string[]
  scheduledFor: string
  status: PostStatus
  attempts: number
  error?: string | null
}

/**
 * How long a run may take before another is allowed to pick the same post up.
 *
 * A post is marked `posting` while it goes out. If the worker dies halfway —
 * a serverless timeout, a deploy — the row would sit in `posting` forever and
 * never be retried. So `posting` is treated as stale after this, which is
 * comfortably longer than a real run and short enough that a stuck post goes
 * out the same day.
 */
export const STALE_POSTING_MS = 10 * 60 * 1000

/** Give up after this many tries. */
export const MAX_ATTEMPTS = 3

/**
 * The window a due post is picked up in.
 *
 * A post scheduled while the scheduler was down should still go out — a
 * customer who scheduled something for 9am does not want it silently skipped
 * because a cron tick was missed. But a post that is *days* late is no longer
 * the post they meant, so there is a limit past which it fails rather than
 * appearing at the wrong moment.
 */
export const MAX_LATENESS_MS = 6 * 60 * 60 * 1000

export interface DueCheck {
  due: boolean
  reason?: string
}

export function isDue(
  post: Pick<ScheduledPost, 'status' | 'scheduledFor' | 'attempts'> & { startedAt?: string | null },
  now: Date = new Date()
): DueCheck {
  const at = new Date(post.scheduledFor)

  if (Number.isNaN(at.getTime())) return { due: false, reason: 'Its time could not be read.' }

  if (post.status === 'cancelled') return { due: false, reason: 'Cancelled.' }
  if (post.status === 'posted') return { due: false, reason: 'Already posted.' }

  if (post.attempts >= MAX_ATTEMPTS) {
    return { due: false, reason: `Gave up after ${MAX_ATTEMPTS} attempts.` }
  }

  // A run that died halfway leaves the row here. Left alone it would never be
  // retried, so it is reclaimed once it is clearly not still running.
  if (post.status === 'posting') {
    const started = post.startedAt ? new Date(post.startedAt).getTime() : 0
    const stale = now.getTime() - started > STALE_POSTING_MS

    return stale
      ? { due: true }
      : { due: false, reason: 'Already going out.' }
  }

  if (at.getTime() > now.getTime()) return { due: false, reason: 'Not yet.' }

  const lateBy = now.getTime() - at.getTime()

  if (lateBy > MAX_LATENESS_MS) {
    return {
      due: false,
      reason: 'This was more than six hours late, so it was not posted at the wrong moment.',
    }
  }

  return { due: true }
}

/**
 * The caption as it will actually appear.
 *
 * Hashtags go on their own line at the end rather than inline: it is what
 * every network's own composer does, it keeps the readable sentence readable,
 * and a tag that has been folded into a sentence stops being clickable on
 * some clients.
 */
export function composeCaption(
  caption: string,
  hashtags: string[] = [],
  linkUrl?: string | null
): string {
  const body = String(caption ?? '').trim()

  const tags = hashtags
    .map((tag) => String(tag ?? '').trim().replace(/^#+/, ''))
    .filter(Boolean)
    // Duplicates are a fast way to get a post flagged as spam.
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .map((tag) => `#${tag}`)

  const link = String(linkUrl ?? '').trim()

  return [body, link, tags.join(' ')].filter(Boolean).join('\n\n')
}

/** Longest caption each network will take, so it can be checked before it is queued. */
export const CAPTION_LIMITS: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  telegram: 4096,
  pinterest: 500,
}

export interface CaptionProblem {
  platform: string
  limit: number
  over: number
}

/**
 * Which of the chosen networks would refuse this caption.
 *
 * Checked before it is queued rather than at posting time. A caption that is
 * twelve characters too long for one network should be found now, while the
 * customer is looking at it — not at 9am on Friday in a failure log.
 */
export function captionProblems(caption: string, platforms: string[]): CaptionProblem[] {
  const length = [...caption].length

  return platforms
    .map((platform) => {
      const limit = CAPTION_LIMITS[platform]

      if (!limit || length <= limit) return null

      return { platform, limit, over: length - limit }
    })
    .filter((problem): problem is CaptionProblem => problem !== null)
}

/**
 * Round a chosen time to the next whole five minutes.
 *
 * The scheduler ticks on a fixed interval, so a post asked for at 09:02
 * cannot go out at 09:02 anyway. Rounding it where the customer can see it is
 * more honest than accepting a time that will not be kept.
 */
export function roundToSlot(when: Date, minutes = 5): Date {
  const step = Math.max(1, minutes) * 60 * 1000
  const rounded = Math.ceil(when.getTime() / step) * step

  return new Date(rounded)
}

/** Posts grouped by calendar day, for the month view. */
export function groupByDay<T extends { scheduledFor: string }>(
  posts: T[]
): { day: string; posts: T[] }[] {
  const days = new Map<string, T[]>()

  for (const post of posts) {
    const at = new Date(post.scheduledFor)

    if (Number.isNaN(at.getTime())) continue

    const day = at.toISOString().slice(0, 10)
    const list = days.get(day) ?? []

    list.push(post)
    days.set(day, list)
  }

  return [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, list]) => ({
      day,
      posts: [...list].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    }))
}
