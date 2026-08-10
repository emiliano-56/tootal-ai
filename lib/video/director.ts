import type { CameraMove } from '@/lib/video/composer'

/**
 * Turning a comic into a directed video rather than a slideshow.
 *
 * What was here before: the customer picked "Zoom In" from a dropdown for each
 * panel and typed a prompt by hand. Nothing read the comic, so nothing knew
 * that a quiet page wants to linger and a chase wants to cut — which is the
 * entire difference between a video and a slideshow with effects on it.
 *
 * The model now reads the panels and returns a shot list: how long each shot
 * holds, which way the camera moves and why, what the narrator says. This file
 * is the part that has to survive the model getting it wrong — a shot list is
 * used to drive a renderer, so every number is clamped and every enum is
 * checked before it reaches the canvas.
 *
 * Pure, so the awkward cases can be tested without an AI call.
 */

export const CAMERA_MOVES: CameraMove[] = [
  'zoom-in',
  'zoom-out',
  'pan-left',
  'pan-right',
  'pan-up',
  'pan-down',
]

/** Shortest and longest a shot may hold, in seconds. */
export const MIN_SHOT = 1.5
export const MAX_SHOT = 12

export interface DirectedShot {
  /** Index into the panels handed to the director. */
  panel: number
  seconds: number
  move: CameraMove
  /** Why this move — shown to the customer, and worth reading. */
  intent: string
  /** What the voice says over this shot. Empty for a silent beat. */
  narration: string
  /** 'cut' for a hard change, 'dissolve' for a soft one. */
  transition: 'cut' | 'dissolve'
}

export interface Direction {
  title: string
  /** One line on how the whole thing should feel. */
  treatment: string
  musicMood: string
  voiceStyle: string
  shots: DirectedShot[]
}

const clamp = (value: unknown, low: number, high: number, fallback: number): number => {
  const number = Number(value)

  if (!Number.isFinite(number)) return fallback

  return Math.min(high, Math.max(low, number))
}

const text = (value: unknown, max = 400): string =>
  value === null || value === undefined || typeof value === 'object'
    ? ''
    : String(value).trim().slice(0, max)

/**
 * A move that suits the shot, when the model did not give a usable one.
 *
 * Alternating rather than random: two identical moves in a row read as a
 * mistake, and a repeating cycle reads as rhythm.
 */
export function fallbackMove(index: number): CameraMove {
  return CAMERA_MOVES[index % CAMERA_MOVES.length]
}

/**
 * Make a model's answer safe to render.
 *
 * Everything is clamped, every enum is checked, and a shot pointing at a panel
 * that does not exist is dropped rather than silently rendered as black. The
 * renderer is a canvas loop with no error handling of its own, so anything odd
 * that gets past here becomes a broken video.
 */
export function normaliseDirection(raw: unknown, panelCount: number): Direction | null {
  if (!raw || typeof raw !== 'object' || panelCount <= 0) return null

  const record = raw as Record<string, unknown>
  const rawShots = Array.isArray(record.shots) ? record.shots : []

  const entries = rawShots.filter(
    (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object'
  )

  /**
   * Models count panels from 1 about as often as from 0.
   *
   * Decided once for the whole list rather than per shot: guessing shot by
   * shot produces a mapping that is 0-based for some and 1-based for others,
   * which silently reorders the video and is worse than picking either
   * convention and applying it consistently.
   *
   * A list is read as 1-based only when nothing in it is 0 and something in
   * it is exactly `panelCount` — which is out of range 0-based and in range
   * 1-based, so it can only have meant the latter.
   */
  const given = entries
    .map((entry) => Number(entry.panel))
    .filter((value) => Number.isFinite(value))

  const oneBased =
    given.length > 0 && !given.includes(0) && given.some((value) => value === panelCount)

  const shots: DirectedShot[] = []

  for (const shot of entries) {
    const asGiven = Number(shot.panel)
    const index = Number.isFinite(asGiven) ? (oneBased ? asGiven - 1 : asGiven) : shots.length

    if (!Number.isInteger(index) || index < 0 || index >= panelCount) continue

    const move = text(shot.move).toLowerCase() as CameraMove

    shots.push({
      panel: index,
      seconds: clamp(shot.seconds ?? shot.duration, MIN_SHOT, MAX_SHOT, 4),
      move: CAMERA_MOVES.includes(move) ? move : fallbackMove(shots.length),
      intent: text(shot.intent ?? shot.reason, 200),
      narration: text(shot.narration ?? shot.caption, 600),
      transition: text(shot.transition) === 'dissolve' ? 'dissolve' : 'cut',
    })
  }

  if (shots.length === 0) return null

  return {
    title: text(record.title, 200) || 'Untitled',
    treatment: text(record.treatment, 400),
    musicMood: text(record.music_mood ?? record.musicMood, 100) || 'gentle',
    voiceStyle: text(record.voice_style ?? record.voiceStyle, 100) || 'warm storyteller',
    shots,
  }
}

/**
 * A shot list when the model could not be reached.
 *
 * One shot per panel with an alternating move — which is exactly what the
 * feature did before, so the fallback is never worse than the old behaviour.
 */
export function fallbackDirection(
  panels: { caption?: string }[],
  title = 'Your comic'
): Direction {
  return {
    title,
    treatment: 'One shot per panel, with an alternating camera move.',
    musicMood: 'gentle',
    voiceStyle: 'warm storyteller',
    shots: panels.map((panel, index) => ({
      panel: index,
      seconds: 4,
      move: fallbackMove(index),
      intent: 'Even pacing',
      narration: panel.caption ?? '',
      transition: 'cut' as const,
    })),
  }
}

/** How long the finished video runs. */
export function totalSeconds(direction: Direction): number {
  return Math.round(direction.shots.reduce((sum, shot) => sum + shot.seconds, 0) * 10) / 10
}

/**
 * Fit the shot list to a target length.
 *
 * Every shot is scaled by the same factor and then re-clamped, so the shape of
 * the edit survives — a long establishing shot stays proportionally longer
 * than the quick cut after it.
 *
 * The clamping means the result may not hit the target exactly. That is the
 * right trade: a 0.2-second shot would be a flash, and a platform limit is a
 * ceiling rather than a length to fill precisely.
 */
export function fitToLength(direction: Direction, targetSeconds: number): Direction {
  const current = totalSeconds(direction)

  if (current <= 0 || targetSeconds <= 0) return direction

  const factor = targetSeconds / current

  return {
    ...direction,
    shots: direction.shots.map((shot) => ({
      ...shot,
      seconds: Math.round(clamp(shot.seconds * factor, MIN_SHOT, MAX_SHOT, shot.seconds) * 10) / 10,
    })),
  }
}

/** Narration for one shot, in reading order — used to build the voice track. */
export function narrationScript(direction: Direction): string {
  return direction.shots
    .map((shot) => shot.narration)
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Whether a shot list can actually be rendered.
 *
 * Called before the render button is enabled, so a customer is told what is
 * wrong rather than watching an export fail.
 */
export function checkDirection(
  direction: Direction,
  panelCount: number
): { ok: boolean; problems: string[] } {
  const problems: string[] = []

  if (direction.shots.length === 0) problems.push('The shot list is empty.')

  if (direction.shots.some((shot) => shot.panel >= panelCount)) {
    problems.push('A shot points at a panel that is no longer there.')
  }

  const used = new Set(direction.shots.map((shot) => shot.panel))
  const unused = panelCount - used.size

  // Not an error: a director may deliberately drop a panel. Worth saying.
  if (unused > 0) {
    problems.push(`${unused} panel${unused === 1 ? '' : 's'} not used in any shot.`)
  }

  return { ok: direction.shots.length > 0 && direction.shots.every((shot) => shot.panel < panelCount), problems }
}
