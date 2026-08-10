import { describe, it, expect } from 'vitest'
import {
  normaliseDirection,
  fallbackDirection,
  fallbackMove,
  totalSeconds,
  fitToLength,
  narrationScript,
  checkDirection,
  CAMERA_MOVES,
  MIN_SHOT,
  MAX_SHOT,
} from '@/lib/video/director'

/**
 * A shot list drives a canvas render loop that has no error handling of its
 * own, so anything odd that gets past normalisation becomes a broken video.
 */

const good = {
  title: 'The Night the Stars Went Quiet',
  treatment: 'Slow and hushed.',
  music_mood: 'lullaby',
  voice_style: 'soft narrator',
  shots: [
    { panel: 0, seconds: 5, move: 'zoom-in', intent: 'Settle in', narration: 'Once, the stars hummed.', transition: 'dissolve' },
    { panel: 1, seconds: 3, move: 'pan-right', intent: 'Follow Moss', narration: 'Moss set out.', transition: 'cut' },
  ],
}

describe('reading what the model returned', () => {
  it('keeps a well-formed shot list intact', () => {
    const direction = normaliseDirection(good, 2)!

    expect(direction.title).toBe('The Night the Stars Went Quiet')
    expect(direction.musicMood).toBe('lullaby')
    expect(direction.shots).toHaveLength(2)
    expect(direction.shots[0].move).toBe('zoom-in')
    expect(direction.shots[0].transition).toBe('dissolve')
  })

  it('accepts camelCase as well as snake_case', () => {
    const direction = normaliseDirection(
      { ...good, musicMood: 'tense', voiceStyle: 'urgent', music_mood: undefined, voice_style: undefined },
      2
    )!

    expect(direction.musicMood).toBe('tense')
    expect(direction.voiceStyle).toBe('urgent')
  })

  it('clamps a duration the renderer could not use', () => {
    // A 0.2-second shot is a flash; a 90-second one is a still image.
    const direction = normaliseDirection(
      { shots: [{ panel: 0, seconds: 0.2 }, { panel: 1, seconds: 90 }] },
      2
    )!

    expect(direction.shots[0].seconds).toBe(MIN_SHOT)
    expect(direction.shots[1].seconds).toBe(MAX_SHOT)
  })

  it('replaces a camera move it does not have', () => {
    const direction = normaliseDirection({ shots: [{ panel: 0, move: 'dolly-zoom-vertigo' }] }, 1)!

    expect(CAMERA_MOVES).toContain(direction.shots[0].move)
  })

  it('drops a shot pointing at a panel that does not exist', () => {
    // Rendering it would show black rather than fail loudly.
    const direction = normaliseDirection(
      { shots: [{ panel: 0 }, { panel: 47 }, { panel: -1 }] },
      2
    )!

    expect(direction.shots).toHaveLength(1)
  })

  it('handles a model that counted panels from one', () => {
    // Models do this about as often as counting from zero.
    const direction = normaliseDirection({ shots: [{ panel: 1 }, { panel: 2 }, { panel: 3 }] }, 3)!

    expect(direction.shots.map((shot) => shot.panel)).toEqual([0, 1, 2])
  })

  it('decides the counting base once for the whole list', () => {
    // Guessing per shot produced a mapping that was 0-based for some and
    // 1-based for others, silently reordering the video.
    const oneBased = normaliseDirection({ shots: [{ panel: 1 }, { panel: 2 }, { panel: 3 }] }, 3)!
    const zeroBased = normaliseDirection({ shots: [{ panel: 0 }, { panel: 1 }, { panel: 2 }] }, 3)!

    expect(oneBased.shots.map((s) => s.panel)).toEqual([0, 1, 2])
    expect(zeroBased.shots.map((s) => s.panel)).toEqual([0, 1, 2])
  })

  it('reads a partial list as zero-based when nothing forces otherwise', () => {
    // Panels 1 and 2 of a 5-panel comic are in range either way; changing
    // them would be a guess with no evidence behind it.
    const direction = normaliseDirection({ shots: [{ panel: 1 }, { panel: 2 }] }, 5)!

    expect(direction.shots.map((s) => s.panel)).toEqual([1, 2])
  })

  it('refuses anything with no usable shots at all', () => {
    expect(normaliseDirection({ shots: [] }, 3)).toBeNull()
    expect(normaliseDirection({ shots: [{ panel: 99 }] }, 3)).toBeNull()
    expect(normaliseDirection(null, 3)).toBeNull()
    expect(normaliseDirection('a string', 3)).toBeNull()
    expect(normaliseDirection(good, 0)).toBeNull()
  })

  it('ignores junk entries inside an otherwise good list', () => {
    const direction = normaliseDirection(
      { shots: [{ panel: 0 }, null, 'nonsense', { panel: 1 }] },
      2
    )!

    expect(direction.shots).toHaveLength(2)
  })

  it('never lets an object become a caption', () => {
    // String({}) is "[object Object]", which would be spoken aloud.
    const direction = normaliseDirection(
      { shots: [{ panel: 0, narration: { nested: true }, intent: ['a'] }] },
      1
    )!

    expect(direction.shots[0].narration).toBe('')
    expect(direction.shots[0].intent).toBe('')
  })

  it('defaults a missing transition to a cut', () => {
    const direction = normaliseDirection({ shots: [{ panel: 0 }] }, 1)!

    expect(direction.shots[0].transition).toBe('cut')
  })
})

describe('when the model cannot be reached', () => {
  it('falls back to one shot per panel', () => {
    const direction = fallbackDirection([{ caption: 'A' }, { caption: 'B' }, {}])

    expect(direction.shots).toHaveLength(3)
    expect(direction.shots[0].narration).toBe('A')
    expect(direction.shots[2].narration).toBe('')
  })

  it('alternates the camera move, so it never looks like a mistake', () => {
    const direction = fallbackDirection([{}, {}, {}])
    const moves = direction.shots.map((shot) => shot.move)

    expect(moves[0]).not.toBe(moves[1])
    expect(new Set(moves).size).toBe(3)
  })

  it('cycles rather than running out', () => {
    expect(fallbackMove(0)).toBe(fallbackMove(CAMERA_MOVES.length))
  })
})

describe('length', () => {
  it('adds the shots up', () => {
    expect(totalSeconds(normaliseDirection(good, 2)!)).toBe(8)
  })

  it('scales every shot to hit a target', () => {
    const fitted = fitToLength(normaliseDirection(good, 2)!, 16)

    expect(totalSeconds(fitted)).toBe(16)
  })

  it('keeps the shape of the edit when scaling', () => {
    // A long establishing shot should stay proportionally longer than the
    // quick cut after it.
    const fitted = fitToLength(normaliseDirection(good, 2)!, 16)

    expect(fitted.shots[0].seconds).toBeGreaterThan(fitted.shots[1].seconds)
  })

  it('respects the per-shot floor even when that misses the target', () => {
    // A platform limit is a ceiling, not a length to fill exactly, and a
    // 0.1-second shot would be a flash.
    const direction = normaliseDirection({ shots: [{ panel: 0, seconds: 10 }, { panel: 1, seconds: 10 }] }, 2)!
    const fitted = fitToLength(direction, 2)

    expect(fitted.shots.every((shot) => shot.seconds >= MIN_SHOT)).toBe(true)
  })

  it('does nothing when asked for a nonsensical target', () => {
    const direction = normaliseDirection(good, 2)!

    expect(fitToLength(direction, 0)).toBe(direction)
    expect(fitToLength(direction, -5)).toBe(direction)
  })
})

describe('the narration track', () => {
  it('joins the lines in reading order', () => {
    const script = narrationScript(normaliseDirection(good, 2)!)

    expect(script).toBe('Once, the stars hummed.\n\nMoss set out.')
  })

  it('skips silent beats rather than leaving gaps', () => {
    const direction = normaliseDirection(
      { shots: [{ panel: 0, narration: 'A' }, { panel: 1 }, { panel: 0, narration: 'B' }] },
      2
    )!

    expect(narrationScript(direction)).toBe('A\n\nB')
  })
})

describe('before the render button is enabled', () => {
  it('passes a shot list that matches the comic', () => {
    expect(checkDirection(normaliseDirection(good, 2)!, 2).ok).toBe(true)
  })

  it('says which panels were left out', () => {
    // Not an error — a director may drop a panel deliberately — but worth
    // telling the customer before they export.
    const check = checkDirection(normaliseDirection({ shots: [{ panel: 0 }] }, 5)!, 5)

    expect(check.ok).toBe(true)
    expect(check.problems[0]).toContain('4 panels not used')
  })

  it('fails when a panel has since been removed', () => {
    const direction = normaliseDirection(good, 2)!
    const check = checkDirection(direction, 1)

    expect(check.ok).toBe(false)
    expect(check.problems.join(' ')).toContain('no longer there')
  })

  it('uses the singular for one', () => {
    const check = checkDirection(normaliseDirection({ shots: [{ panel: 0 }] }, 2)!, 2)

    expect(check.problems[0]).toContain('1 panel not used')
  })
})
