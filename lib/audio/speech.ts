'use client'

import { voiceTag, languageName } from '@/lib/i18n/languages'

/**
 * Speaking the narration aloud, for free, in the customer's language.
 *
 * Web Speech is the only text-to-speech that costs nothing and needs no key,
 * and it is better than it sounds: it uses the voices already installed on the
 * customer's machine, which on Windows, macOS, Android and iOS are decent
 * neural voices in most of the catalogue's languages.
 *
 * Its one hard limit, which shapes everything here: `speechSynthesis` has no
 * audio output you can capture. It plays to the speakers and that is all —
 * there is no MediaStream, no blob, nothing to route into the WebAudio graph
 * that the video recorder mixes. So narration can be *heard* live but cannot
 * be baked into an exported file without a paid service.
 *
 * Rather than hide that, the studio uses this for preview and ships the words
 * as burned-in captions and a subtitle file. The customer hears exactly what
 * the video says, and gets a file they can voice properly if they want to.
 */

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Voices load asynchronously in Chrome, and the first call almost always
 * returns an empty list. Waiting for the event is the difference between
 * "your language is not available" and it simply not having arrived yet.
 */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) return Promise.resolve([])

  const existing = window.speechSynthesis.getVoices()

  if (existing.length > 0) return Promise.resolve(existing)

  return new Promise((resolve) => {
    let settled = false

    const finish = () => {
      if (settled) return

      settled = true
      window.speechSynthesis.onvoiceschanged = null
      resolve(window.speechSynthesis.getVoices())
    }

    window.speechSynthesis.onvoiceschanged = finish

    // Some browsers never fire the event when there are no voices at all.
    setTimeout(finish, timeoutMs)
  })
}

/**
 * The best installed voice for a language.
 *
 * Prefers an exact locale match (`hi-IN`), then any voice for the base
 * language (`hi`), then nothing — a missing voice is worth reporting rather
 * than silently reading Hindi text with an English voice, which is
 * unintelligible rather than merely accented.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  code: string
): SpeechSynthesisVoice | null {
  const tag = voiceTag(code).toLowerCase()
  const base = tag.split('-')[0]

  const exact = voices.find((voice) => voice.lang.toLowerCase() === tag)

  if (exact) return exact

  const sameLanguage = voices.filter((voice) => voice.lang.toLowerCase().startsWith(`${base}-`))

  // A local voice is lower latency and works offline; a remote one is often
  // better quality. Local wins because this is a preview, played repeatedly.
  return sameLanguage.find((voice) => voice.localService) ?? sameLanguage[0] ?? null
}

export interface SpeechCheck {
  supported: boolean
  voice: SpeechSynthesisVoice | null
  /** Said plainly, for the customer. */
  message?: string
}

export async function checkSpeech(code: string): Promise<SpeechCheck> {
  if (!isSpeechSupported()) {
    return {
      supported: false,
      voice: null,
      message: 'This browser cannot read text aloud. Try Chrome, Edge or Safari.',
    }
  }

  const voice = pickVoice(await loadVoices(), code)

  if (!voice) {
    return {
      supported: true,
      voice: null,
      message: `No ${languageName(code)} voice is installed on this device, so the preview would be unintelligible. The subtitles and the script still work.`,
    }
  }

  return { supported: true, voice }
}

export interface SpeakOptions {
  language: string
  /** 0.1–10; 1 is the voice's natural pace. */
  rate?: number
  pitch?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (message: string) => void
}

/**
 * Read one passage aloud.
 *
 * Cancels anything already speaking first. Two utterances at once is the most
 * common way this goes wrong — a customer presses play twice and hears the
 * narration read over itself.
 */
export async function speak(text: string, options: SpeakOptions): Promise<void> {
  if (!isSpeechSupported() || !text.trim()) return

  stopSpeaking()

  const voice = pickVoice(await loadVoices(), options.language)
  const utterance = new SpeechSynthesisUtterance(text)

  if (voice) utterance.voice = voice

  utterance.lang = voice?.lang ?? voiceTag(options.language)
  utterance.rate = options.rate ?? 1
  utterance.pitch = options.pitch ?? 1

  utterance.onstart = () => options.onStart?.()
  utterance.onend = () => options.onEnd?.()
  utterance.onerror = (event) => {
    // Cancelling is not a failure, and reporting it as one makes the stop
    // button look broken.
    if (event.error === 'canceled' || event.error === 'interrupted') return

    options.onError?.(event.error || 'The voice stopped unexpectedly.')
  }

  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return

  window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return isSpeechSupported() && window.speechSynthesis.speaking
}
