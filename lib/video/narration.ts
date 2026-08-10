import type { Direction } from '@/lib/video/director'

/**
 * Turning a shot list into narration the customer can actually use.
 *
 * The director already writes what the voice should say over each shot, and
 * the shot list already knows how long each shot holds — so the timings are
 * not guesswork, they are arithmetic. That is worth exploiting: subtitles cut
 * from real shot durations line up with the picture, and subtitles guessed
 * from word counts do not.
 *
 * Why subtitles at all, when the feature is called narration: the browser can
 * *speak* the script (Web Speech, free, every language in the catalogue) but it
 * cannot hand back an audio stream. There is no way to route `speechSynthesis`
 * into the WebAudio graph the recorder mixes, so spoken narration can be heard
 * live and cannot be baked into the exported file. Rather than pretend
 * otherwise, the export carries the words as burned-in captions and as a
 * subtitle file, and the customer can drop either onto the video anywhere.
 *
 * Pure, so the timing maths can be tested without a browser.
 */

export interface Cue {
  index: number
  /** Seconds from the start of the video. */
  start: number
  end: number
  text: string
}

/**
 * One cue per shot that actually says something.
 *
 * Silent shots still advance the clock — they are a beat in the edit, not a
 * gap to be closed — so the cue after one starts later, exactly as it will
 * when the video plays.
 */
export function cuesFrom(direction: Direction): Cue[] {
  const cues: Cue[] = []
  let at = 0

  for (const shot of direction.shots) {
    const text = shot.narration.trim()

    if (text) {
      cues.push({ index: cues.length + 1, start: at, end: at + shot.seconds, text })
    }

    at += shot.seconds
  }

  return cues
}

/** `01:23:45,678` for SRT, `01:23:45.678` for WebVTT. */
export function timestamp(seconds: number, separator: ',' | '.' = ','): string {
  const safe = Math.max(0, seconds)

  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = Math.floor(safe % 60)
  // Rounded rather than truncated: a cue that starts 1ms early is invisible,
  // and truncating drifts the same direction on every cue.
  const millis = Math.round((safe - Math.floor(safe)) * 1000)

  // Rounding 999.6ms up carries into the next second.
  const carried = millis === 1000

  const pad = (value: number, width = 2) => String(value).padStart(width, '0')

  return carried
    ? `${timestamp(Math.floor(safe) + 1, separator)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(secs)}${separator}${pad(millis, 3)}`
}

/** SubRip — what YouTube, Premiere and every phone editor accept. */
export function toSrt(direction: Direction): string {
  return cuesFrom(direction)
    .map(
      (cue) =>
        `${cue.index}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text}\n`
    )
    .join('\n')
}

/** WebVTT — what an HTML <track> element wants. */
export function toVtt(direction: Direction): string {
  const body = cuesFrom(direction)
    .map(
      (cue) =>
        `${cue.index}\n${timestamp(cue.start, '.')} --> ${timestamp(cue.end, '.')}\n${cue.text}\n`
    )
    .join('\n')

  return `WEBVTT\n\n${body}`
}

/**
 * The script as something a person can read aloud or paste elsewhere.
 *
 * Timecoded, because the most common use for it is handing the video to
 * someone — or some other tool — to record a real voice-over against.
 */
export function toScript(direction: Direction): string {
  const header = [
    direction.title,
    direction.treatment && `\n${direction.treatment}`,
    `\nVoice: ${direction.voiceStyle} · Music: ${direction.musicMood}`,
    '\n---\n',
  ]
    .filter(Boolean)
    .join('\n')

  const body = cuesFrom(direction)
    .map((cue) => `[${timestamp(cue.start).slice(3, 8)}] ${cue.text}`)
    .join('\n\n')

  return `${header}\n${body}\n`
}

/**
 * How long the narration would take to read, against how long the video runs.
 *
 * Worth showing. The director is told to keep narration short, but a model
 * asked for atmosphere will happily write two sentences over a two-second
 * shot, and the first the customer would otherwise know is when the voice is
 * still talking over the next scene.
 *
 * 150 words per minute is a measured average for narration read at a
 * comfortable pace — faster than audiobook, slower than conversation.
 */
export const WORDS_PER_MINUTE = 150

export function readingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length

  return (words / WORDS_PER_MINUTE) * 60
}

export interface PacingProblem {
  /** Index into `direction.shots`. */
  shot: number
  needs: number
  has: number
}

/** Shots whose narration cannot be read in the time the shot is on screen. */
export function overrunningShots(direction: Direction, tolerance = 1.15): PacingProblem[] {
  const problems: PacingProblem[] = []

  direction.shots.forEach((shot, index) => {
    if (!shot.narration.trim()) return

    const needs = readingSeconds(shot.narration)

    // A little over is fine — the voice can be read slightly faster, and
    // flagging every shot that is 0.2s tight would make the warning noise.
    if (needs > shot.seconds * tolerance) {
      problems.push({ shot: index, needs: Math.round(needs * 10) / 10, has: shot.seconds })
    }
  })

  return problems
}
