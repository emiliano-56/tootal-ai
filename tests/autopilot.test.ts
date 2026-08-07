import { describe, it, expect } from 'vitest'
import {
  nextRunAt,
  isDue,
  runsPerMonth,
  missedSlots,
  describeNextRun,
  offsetMinutes,
  type ScheduleInput,
} from '@/lib/autopilot/schedule'

const at = (iso: string) => new Date(iso)

const daily: ScheduleInput = { frequency: 'daily', publishHour: 9, timezone: 'UTC' }

describe('the next slot', () => {
  it('is today when the hour has not passed', () => {
    expect(nextRunAt(daily, at('2026-03-10T06:00:00Z')).toISOString()).toBe('2026-03-10T09:00:00.000Z')
  })

  it('rolls to tomorrow once the hour has passed', () => {
    expect(nextRunAt(daily, at('2026-03-10T09:30:00Z')).toISOString()).toBe('2026-03-11T09:00:00.000Z')
  })

  it('is strictly in the future, never the instant asked about', () => {
    // Returning "now" would make the scheduler fire the same slot forever.
    const next = nextRunAt(daily, at('2026-03-10T09:00:00Z'))

    expect(next.toISOString()).toBe('2026-03-11T09:00:00.000Z')
  })

  it('does not drift when a run finishes late', () => {
    // A run that started at 09:00 and finished at 11:47 must still schedule
    // tomorrow at 09:00, not tomorrow at 11:47.
    const next = nextRunAt(daily, at('2026-03-10T11:47:00Z'))

    expect(next.toISOString()).toBe('2026-03-11T09:00:00.000Z')
  })

  it('catches up to the future after a long outage', () => {
    // Down for a week: the next slot is the next one from now, not the first
    // one that was missed.
    const next = nextRunAt(daily, at('2026-03-17T10:00:00Z'))

    expect(next.toISOString()).toBe('2026-03-18T09:00:00.000Z')
  })
})

describe('weekdays only', () => {
  const weekdays: ScheduleInput = { frequency: 'weekdays', publishHour: 9, timezone: 'UTC' }

  it('skips Saturday and Sunday', () => {
    // 2026-03-13 is a Friday.
    const next = nextRunAt(weekdays, at('2026-03-13T10:00:00Z'))

    expect(next.toISOString()).toBe('2026-03-16T09:00:00.000Z')
    expect(next.getUTCDay()).toBe(1)
  })

  it('runs on a normal weekday', () => {
    expect(nextRunAt(weekdays, at('2026-03-10T10:00:00Z')).toISOString()).toBe(
      '2026-03-11T09:00:00.000Z'
    )
  })

  it('never lands on a weekend, whatever day it is asked on', () => {
    for (let day = 9; day <= 22; day += 1) {
      const next = nextRunAt(weekdays, at(`2026-03-${String(day).padStart(2, '0')}T23:00:00Z`))

      expect(next.getUTCDay()).toBeGreaterThanOrEqual(1)
      expect(next.getUTCDay()).toBeLessThanOrEqual(5)
    }
  })
})

describe('weekly', () => {
  it('keeps the day the campaign started on', () => {
    const weekly: ScheduleInput = {
      frequency: 'weekly',
      publishHour: 9,
      timezone: 'UTC',
      // A Tuesday.
      startedAt: at('2026-03-10T09:00:00Z'),
    }

    const next = nextRunAt(weekly, at('2026-03-10T10:00:00Z'))

    expect(next.toISOString()).toBe('2026-03-17T09:00:00.000Z')
    expect(next.getUTCDay()).toBe(2)
  })
})

describe('every other day', () => {
  it('keeps the same parity after a missed run', () => {
    const alternate: ScheduleInput = {
      frequency: 'every_2_days',
      publishHour: 9,
      timezone: 'UTC',
      startedAt: at('2026-03-10T09:00:00Z'),
    }

    const first = nextRunAt(alternate, at('2026-03-10T10:00:00Z'))

    expect(first.toISOString()).toBe('2026-03-12T09:00:00.000Z')

    // Even after skipping several days the pattern is unchanged.
    const later = nextRunAt(alternate, at('2026-03-17T10:00:00Z'))

    expect(later.toISOString()).toBe('2026-03-18T09:00:00.000Z')
  })
})

describe('time zones', () => {
  it('fires at the local hour, not the server hour', () => {
    const kolkata: ScheduleInput = {
      frequency: 'daily',
      publishHour: 9,
      timezone: 'Asia/Kolkata',
    }

    // 09:00 in Kolkata is 03:30 UTC.
    expect(nextRunAt(kolkata, at('2026-03-10T00:00:00Z')).toISOString()).toBe(
      '2026-03-10T03:30:00.000Z'
    )
  })

  it('keeps the local hour across a daylight saving change', () => {
    // New York moves to DST on 8 March 2026. Both runs must be 09:00 local
    // even though the UTC offset changed between them.
    const newYork: ScheduleInput = { frequency: 'daily', publishHour: 9, timezone: 'America/New_York' }

    const before = nextRunAt(newYork, at('2026-03-06T20:00:00Z'))
    const after = nextRunAt(newYork, at('2026-03-10T20:00:00Z'))

    const localHour = (date: Date) =>
      Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          hour12: false,
        }).format(date)
      ) % 24

    expect(localHour(before)).toBe(9)
    expect(localHour(after)).toBe(9)
    // Proof the offset really did change between the two.
    expect(before.getUTCHours()).not.toBe(after.getUTCHours())
  })

  it('treats an unknown zone as UTC rather than failing', () => {
    const broken: ScheduleInput = { frequency: 'daily', publishHour: 9, timezone: 'Mars/Olympus' }

    expect(offsetMinutes('Mars/Olympus', new Date())).toBe(0)
    expect(nextRunAt(broken, at('2026-03-10T06:00:00Z')).toISOString()).toBe(
      '2026-03-10T09:00:00.000Z'
    )
  })

  it('handles midnight without rolling into the wrong day', () => {
    const midnight: ScheduleInput = { frequency: 'daily', publishHour: 0, timezone: 'UTC' }

    expect(nextRunAt(midnight, at('2026-03-10T00:30:00Z')).toISOString()).toBe(
      '2026-03-11T00:00:00.000Z'
    )
  })
})

describe('due', () => {
  it('is due when the slot has passed', () => {
    expect(isDue({ status: 'active', nextRunAt: at('2026-03-10T09:00:00Z') }, at('2026-03-10T09:01:00Z'))).toBe(true)
  })

  it('is not due before the slot', () => {
    expect(isDue({ status: 'active', nextRunAt: at('2026-03-10T09:00:00Z') }, at('2026-03-10T08:59:00Z'))).toBe(false)
  })

  it('is due immediately when it has never been scheduled', () => {
    // Otherwise switching a campaign on would do nothing until it was edited.
    expect(isDue({ status: 'active', nextRunAt: null })).toBe(true)
  })

  it('is never due while paused', () => {
    expect(isDue({ status: 'paused', nextRunAt: null })).toBe(false)
    expect(isDue({ status: 'draft', nextRunAt: at('2020-01-01T00:00:00Z') })).toBe(false)
  })
})

describe('missed slots', () => {
  it('counts the runs an outage cost', () => {
    expect(missedSlots(daily, at('2026-03-10T10:00:00Z'), at('2026-03-14T10:00:00Z'))).toBe(4)
  })

  it('is zero when nothing was missed', () => {
    expect(missedSlots(daily, at('2026-03-10T10:00:00Z'), at('2026-03-10T12:00:00Z'))).toBe(0)
  })

  it('stops counting rather than looping on a long gap', () => {
    expect(missedSlots(daily, at('2020-01-01T00:00:00Z'), at('2026-03-10T00:00:00Z'))).toBe(100)
  })
})

describe('monthly volume', () => {
  it('reflects the frequency', () => {
    expect(runsPerMonth('daily')).toBe(30)
    expect(runsPerMonth('weekdays')).toBe(22)
    expect(runsPerMonth('weekly')).toBe(4)
  })

  it('multiplies by the episodes each run makes', () => {
    expect(runsPerMonth('daily', 3)).toBe(90)
  })

  it('treats zero episodes as one', () => {
    expect(runsPerMonth('weekly', 0)).toBe(4)
  })
})

describe('describing the next run', () => {
  it('counts minutes, hours and days', () => {
    const now = at('2026-03-10T09:00:00Z')

    expect(describeNextRun(at('2026-03-10T09:30:00Z'), now)).toBe('in 30 min')
    expect(describeNextRun(at('2026-03-10T12:00:00Z'), now)).toBe('in 3 hours')
    expect(describeNextRun(at('2026-03-12T09:00:00Z'), now)).toBe('in 2 days')
  })

  it('says so when the slot has passed', () => {
    expect(describeNextRun(at('2026-03-10T08:00:00Z'), at('2026-03-10T09:00:00Z'))).toBe('Due now')
  })

  it('handles a campaign that has never run', () => {
    expect(describeNextRun(null)).toBe('Not scheduled')
  })

  it('uses the singular for one', () => {
    const now = at('2026-03-10T09:00:00Z')

    expect(describeNextRun(at('2026-03-10T10:00:00Z'), now)).toBe('in 1 hour')
    expect(describeNextRun(at('2026-03-11T09:00:00Z'), now)).toBe('in 1 day')
  })
})
