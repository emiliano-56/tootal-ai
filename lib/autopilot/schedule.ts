/**
 * When a campaign runs next.
 *
 * The whole promise of Autopilot is that it keeps going without anyone
 * watching, so this is the part that has to be right. Two mistakes are easy
 * and both are bad: drifting later every day until a "daily" campaign posts
 * weekly, and firing repeatedly after a gap because every missed slot is still
 * in the past.
 *
 * Pure, so every case can be tested without waiting a day for one.
 */

export type Frequency = 'daily' | 'every_2_days' | 'weekdays' | 'weekly'

export const FREQUENCIES: { value: Frequency; label: string; hint: string }[] = [
  { value: 'daily', label: 'Every day', hint: 'One run a day, seven days a week' },
  { value: 'weekdays', label: 'Weekdays', hint: 'Monday to Friday, nothing at weekends' },
  { value: 'every_2_days', label: 'Every other day', hint: 'Roughly fifteen runs a month' },
  { value: 'weekly', label: 'Once a week', hint: 'Same day each week' },
]

const DAY = 24 * 60 * 60 * 1000

/** Minutes to add to UTC for a zone, at a given instant. */
export function offsetMinutes(timezone: string, at: Date): number {
  try {
    // Intl gives the local wall clock for the zone; the difference from the
    // same instant read as UTC is the offset, DST included.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at)

    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)

    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second')
    )

    return Math.round((asUtc - at.getTime()) / 60000)
  } catch {
    // An unknown zone must not stop a campaign; treat it as UTC.
    return 0
  }
}

/** The instant at which it is `hour`:00 on the given local calendar day. */
function instantFor(year: number, month: number, day: number, hour: number, timezone: string): Date {
  const guess = new Date(Date.UTC(year, month, day, hour, 0, 0))

  // The offset has to be measured near the target, not now, or a run scheduled
  // across a DST boundary lands an hour out.
  const first = offsetMinutes(timezone, guess)
  const corrected = new Date(guess.getTime() - first * 60000)

  // One more pass, because the correction itself can cross the boundary.
  const second = offsetMinutes(timezone, corrected)

  return new Date(guess.getTime() - second * 60000)
}

/** The local calendar day of an instant, in the campaign's zone. */
function localParts(at: Date, timezone: string) {
  const shifted = new Date(at.getTime() + offsetMinutes(timezone, at) * 60000)

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
  }
}

export interface ScheduleInput {
  frequency: Frequency
  /** Local hour of day, 0-23. */
  publishHour: number
  timezone: string
  /** Anchors a weekly campaign to the day it started. */
  startedAt?: Date
}

/**
 * The next slot strictly after `from`.
 *
 * Always computed from the calendar rather than by adding an interval to the
 * last run: a run that finished late must not push tomorrow's later still.
 */
export function nextRunAt(input: ScheduleInput, from: Date = new Date()): Date {
  const hour = Math.min(23, Math.max(0, Math.round(input.publishHour)))
  const zone = input.timezone || 'UTC'
  const local = localParts(from, zone)

  // Start from today's slot and walk forward until it is both in the future
  // and on a day this frequency allows.
  let candidate = instantFor(local.year, local.month, local.day, hour, zone)

  const anchorDay = input.startedAt
    ? localParts(input.startedAt, zone).weekday
    : localParts(from, zone).weekday

  const startDay = input.startedAt
    ? Math.floor(instantFor(
        localParts(input.startedAt, zone).year,
        localParts(input.startedAt, zone).month,
        localParts(input.startedAt, zone).day,
        hour,
        zone
      ).getTime() / DAY)
    : null

  // A year of days is far more than any frequency needs; the bound only exists
  // so a bad timezone cannot spin here forever.
  for (let step = 0; step < 400; step += 1) {
    if (candidate.getTime() > from.getTime()) {
      const parts = localParts(candidate, zone)

      if (allows(input.frequency, parts.weekday, candidate, anchorDay, startDay)) {
        return candidate
      }
    }

    const next = new Date(candidate.getTime() + DAY)
    const nextLocal = localParts(next, zone)

    // Rebuild from the calendar so the local hour survives a DST change.
    candidate = instantFor(nextLocal.year, nextLocal.month, nextLocal.day, hour, zone)
  }

  return new Date(from.getTime() + DAY)
}

function allows(
  frequency: Frequency,
  weekday: number,
  candidate: Date,
  anchorDay: number,
  startDay: number | null
): boolean {
  if (frequency === 'daily') return true
  if (frequency === 'weekdays') return weekday >= 1 && weekday <= 5
  if (frequency === 'weekly') return weekday === anchorDay

  // Every other day, counted from the day the campaign started so the pattern
  // does not shift when a run is missed.
  const day = Math.floor(candidate.getTime() / DAY)

  return startDay === null || (day - startDay) % 2 === 0
}

/** Roughly how many runs a month, for the "this will produce N a month" line. */
export function runsPerMonth(frequency: Frequency, episodesPerRun = 1): number {
  const perMonth: Record<Frequency, number> = {
    daily: 30,
    weekdays: 22,
    every_2_days: 15,
    weekly: 4,
  }

  return perMonth[frequency] * Math.max(1, episodesPerRun)
}

/**
 * Whether a campaign is due.
 *
 * A campaign with no `nextRunAt` has never been scheduled, and is due now —
 * otherwise switching one on would do nothing until somebody edited it.
 */
export function isDue(
  campaign: { status: string; nextRunAt: Date | null },
  now: Date = new Date()
): boolean {
  if (campaign.status !== 'active') return false
  if (!campaign.nextRunAt) return true

  return campaign.nextRunAt.getTime() <= now.getTime()
}

/**
 * How far behind a campaign has fallen.
 *
 * Used to decide whether to catch up or skip. Producing eleven episodes at once
 * because the scheduler was down overnight would be worse than losing them, so
 * the caller runs once and moves the schedule on.
 */
export function missedSlots(input: ScheduleInput, since: Date, now: Date = new Date()): number {
  let cursor = since
  let count = 0

  while (count < 100) {
    const next = nextRunAt(input, cursor)

    if (next.getTime() > now.getTime()) break

    cursor = next
    count += 1
  }

  return count
}

/** "in 3 hours", "tomorrow at 09:00" — for the campaign card. */
export function describeNextRun(at: Date | null, now: Date = new Date()): string {
  if (!at) return 'Not scheduled'

  const minutes = Math.round((at.getTime() - now.getTime()) / 60000)

  if (minutes <= 0) return 'Due now'
  if (minutes < 60) return `in ${minutes} min`

  const hours = Math.round(minutes / 60)

  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`

  const days = Math.round(hours / 24)

  return `in ${days} day${days === 1 ? '' : 's'}`
}
