import { describe, it, expect } from 'vitest'
import {
  cuesFrom,
  timestamp,
  toSrt,
  toVtt,
  toScript,
  readingSeconds,
  overrunningShots,
  WORDS_PER_MINUTE,
} from '@/lib/video/narration'
import type { Direction, DirectedShot } from '@/lib/video/director'

const shot = (over: Partial<DirectedShot> = {}): DirectedShot => ({
  panel: 0,
  seconds: 4,
  move: 'zoom-in',
  intent: '',
  narration: '',
  transition: 'cut',
  ...over,
})

const direction = (shots: DirectedShot[]): Direction => ({
  title: 'A Snail Goes North',
  treatment: 'Slow and warm.',
  musicMood: 'gentle',
  voiceStyle: 'warm storyteller',
  shots,
})

describe('cues', () => {
  it('starts each cue where the one before ended', () => {
    const cues = cuesFrom(
      direction([
        shot({ seconds: 3, narration: 'One.' }),
        shot({ seconds: 5, narration: 'Two.' }),
      ])
    )

    expect(cues).toEqual([
      { index: 1, start: 0, end: 3, text: 'One.' },
      { index: 2, start: 3, end: 8, text: 'Two.' },
    ])
  })

  it('lets a silent shot advance the clock without producing a cue', () => {
    // A silent beat is part of the edit, not a gap to close. If it did not
    // advance the clock, every subtitle after it would run early.
    const cues = cuesFrom(
      direction([
        shot({ seconds: 3, narration: 'Before.' }),
        shot({ seconds: 6, narration: '   ' }),
        shot({ seconds: 2, narration: 'After.' }),
      ])
    )

    expect(cues).toHaveLength(2)
    expect(cues[1]).toEqual({ index: 2, start: 9, end: 11, text: 'After.' })
  })

  it('numbers cues consecutively, not by shot', () => {
    // SRT readers reject a numbering sequence with holes in it.
    const cues = cuesFrom(
      direction([
        shot({ narration: '' }),
        shot({ narration: 'First words.' }),
        shot({ narration: '' }),
        shot({ narration: 'Second words.' }),
      ])
    )

    expect(cues.map((cue) => cue.index)).toEqual([1, 2])
  })

  it('produces nothing when no shot says anything', () => {
    expect(cuesFrom(direction([shot(), shot()]))).toEqual([])
  })
})

describe('timestamps', () => {
  it('formats hours, minutes, seconds and milliseconds', () => {
    expect(timestamp(0)).toBe('00:00:00,000')
    expect(timestamp(3.5)).toBe('00:00:03,500')
    expect(timestamp(61.25)).toBe('00:01:01,250')
    expect(timestamp(3661.001)).toBe('01:01:01,001')
  })

  it('uses a dot for WebVTT', () => {
    expect(timestamp(3.5, '.')).toBe('00:00:03.500')
  })

  it('carries into the next second rather than writing 1000ms', () => {
    // ",1000" is not a valid timestamp and some players refuse the whole file.
    expect(timestamp(4.9999)).toBe('00:00:05,000')
  })

  it('never goes negative', () => {
    expect(timestamp(-3)).toBe('00:00:00,000')
  })
})

describe('subtitle files', () => {
  const sample = direction([
    shot({ seconds: 3, narration: 'The snail set out at dawn.' }),
    shot({ seconds: 4, narration: 'North was further than it looked.' }),
  ])

  it('writes SRT in the shape players expect', () => {
    expect(toSrt(sample)).toBe(
      '1\n' +
        '00:00:00,000 --> 00:00:03,000\n' +
        'The snail set out at dawn.\n' +
        '\n' +
        '2\n' +
        '00:00:03,000 --> 00:00:07,000\n' +
        'North was further than it looked.\n'
    )
  })

  it('puts the WEBVTT header on the VTT', () => {
    const vtt = toVtt(sample)

    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true)
    expect(vtt).toContain('00:00:03.000 --> 00:00:07.000')
  })

  it('writes an empty but valid VTT when there is no narration', () => {
    expect(toVtt(direction([shot()]))).toBe('WEBVTT\n\n')
  })
})

describe('the readable script', () => {
  it('carries the title, the treatment and timecodes', () => {
    const text = toScript(
      direction([shot({ seconds: 65, narration: 'Opening line.' }), shot({ narration: 'Next.' })])
    )

    expect(text).toContain('A Snail Goes North')
    expect(text).toContain('Slow and warm.')
    expect(text).toContain('warm storyteller')
    expect(text).toContain('[00:00] Opening line.')
    // The second cue starts at 65s, which is 01:05.
    expect(text).toContain('[01:05] Next.')
  })
})

describe('pacing', () => {
  it('measures reading time against a steady words-per-minute', () => {
    const words = Array.from({ length: WORDS_PER_MINUTE }, () => 'word').join(' ')

    expect(readingSeconds(words)).toBeCloseTo(60, 5)
  })

  it('treats empty text as taking no time', () => {
    expect(readingSeconds('   ')).toBe(0)
  })

  it('flags a shot whose narration cannot be read in time', () => {
    // Twenty words needs about 8 seconds; the shot holds for two.
    const long = Array.from({ length: 20 }, () => 'word').join(' ')

    const problems = overrunningShots(direction([shot({ seconds: 2, narration: long })]))

    expect(problems).toHaveLength(1)
    expect(problems[0].shot).toBe(0)
    expect(problems[0].has).toBe(2)
    expect(problems[0].needs).toBeGreaterThan(2)
  })

  it('allows a little over without complaining', () => {
    // Flagging every shot that is a fraction tight would make the warning
    // noise, and noise is ignored.
    const words = Array.from({ length: 10 }, () => 'word').join(' ')
    const needs = readingSeconds(words)

    expect(overrunningShots(direction([shot({ seconds: needs * 1.1, narration: words })]))).toEqual(
      []
    )
  })

  it('ignores silent shots however short', () => {
    expect(overrunningShots(direction([shot({ seconds: 1.5, narration: '' })]))).toEqual([])
  })
})
