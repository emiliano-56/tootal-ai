/**
 * The languages a story can be written in.
 *
 * Nothing here translates the interface — that is a separate job. This is
 * about the *content*: the model can already write a comic in Hindi or
 * Spanish, it was simply never asked. So the whole feature is a language on
 * the request and a sentence in the prompt.
 *
 * `nativeName` matters more than it looks. A customer scanning for their own
 * language finds "हिन्दी" faster than "Hindi", and gets it right more often.
 */

export interface Language {
  code: string
  name: string
  nativeName: string
  /** Right-to-left scripts need the preview to flip. */
  rtl?: boolean
  /** BCP-47 tag for speech synthesis, where it differs from the code. */
  voice?: string
}

/**
 * Ordered by region rather than by speaker count.
 *
 * A picker is scanned, not searched — somebody looking for Slovak finds it
 * faster among its neighbours than at position 41 of a global popularity
 * ranking. English stays first because it is the fallback for everything.
 */
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', voice: 'en-US' },

  // ---- Western Europe ----
  { code: 'es', name: 'Spanish', nativeName: 'Español', voice: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', voice: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', voice: 'de-DE' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', voice: 'it-IT' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', voice: 'pt-BR' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', voice: 'nl-NL' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', voice: 'ca-ES' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego', voice: 'gl-ES' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara', voice: 'eu-ES' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge', voice: 'ga-IE' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', voice: 'cy-GB' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', voice: 'is-IS' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti', voice: 'mt-MT' },
  { code: 'lb', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch', voice: 'lb-LU' },

  // ---- Nordic ----
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', voice: 'sv-SE' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', voice: 'da-DK' },
  { code: 'nb', name: 'Norwegian', nativeName: 'Norsk bokmål', voice: 'nb-NO' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', voice: 'fi-FI' },

  // ---- Central & Eastern Europe ----
  { code: 'pl', name: 'Polish', nativeName: 'Polski', voice: 'pl-PL' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', voice: 'cs-CZ' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', voice: 'sk-SK' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', voice: 'hu-HU' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', voice: 'ro-RO' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', voice: 'bg-BG' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', voice: 'el-GR' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', voice: 'hr-HR' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', voice: 'sr-RS' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski', voice: 'bs-BA' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', voice: 'sl-SI' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски', voice: 'mk-MK' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip', voice: 'sq-AL' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', voice: 'lt-LT' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', voice: 'lv-LV' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', voice: 'et-EE' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', voice: 'ru-RU' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', voice: 'uk-UA' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская', voice: 'be-BY' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', voice: 'ka-GE' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', voice: 'hy-AM' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan', voice: 'az-AZ' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша', voice: 'kk-KZ' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha', voice: 'uz-UZ' },

  // ---- Middle East & North Africa ----
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', voice: 'tr-TR' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true, voice: 'ar-SA' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', rtl: true, voice: 'he-IL' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', rtl: true, voice: 'fa-IR' },
  { code: 'ku', name: 'Kurdish', nativeName: 'Kurdî', voice: 'ku-TR' },

  // ---- South Asia ----
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', voice: 'hi-IN' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', rtl: true, voice: 'ur-PK' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', voice: 'bn-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', voice: 'ta-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', voice: 'te-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', voice: 'mr-IN' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', voice: 'gu-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', voice: 'kn-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', voice: 'ml-IN' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', voice: 'pa-IN' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', voice: 'or-IN' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', voice: 'as-IN' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', voice: 'ne-NP' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', voice: 'si-LK' },

  // ---- South East & East Asia ----
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', voice: 'zh-CN' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', voice: 'zh-TW' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', voice: 'ja-JP' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', voice: 'ko-KR' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', voice: 'id-ID' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', voice: 'ms-MY' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', voice: 'vi-VN' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', voice: 'th-TH' },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', voice: 'km-KH' },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ', voice: 'lo-LA' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာ', voice: 'my-MM' },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino', voice: 'fil-PH' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол', voice: 'mn-MN' },

  // ---- Africa ----
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', voice: 'sw-KE' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', voice: 'am-ET' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', voice: 'ha-NG' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', voice: 'yo-NG' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', voice: 'ig-NG' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', voice: 'zu-ZA' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', voice: 'xh-ZA' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', voice: 'af-ZA' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', voice: 'so-SO' },
]

export const DEFAULT_LANGUAGE = 'en'

export function language(code: string | null | undefined): Language | undefined {
  if (!code) return undefined

  // Tolerates 'en-GB', 'HI' and 'zh_TW' — a browser locale is not a bare code.
  const wanted = code.toLowerCase().replace('_', '-')
  const base = wanted.split('-')[0]

  // Both sides lowercased. The catalogue holds 'zh-TW' with a capitalised
  // region, and comparing it against a lowercased input never matched — so
  // Traditional Chinese fell through to the base lookup and silently resolved
  // to Simplified, which is a different script and the wrong answer.
  return (
    LANGUAGES.find((entry) => entry.code.toLowerCase() === wanted) ??
    LANGUAGES.find((entry) => entry.code.toLowerCase() === base)
  )
}

export function languageName(code: string): string {
  return language(code)?.name ?? code
}

/**
 * Which languages an account may use.
 *
 * A plan holding an empty list means "no restriction", which is how every
 * tier above Front End is set. Holding several plans takes the union — and an
 * unrestricted one wins outright, because buying an upgrade must never take a
 * language away.
 */
export function allowedLanguages(planLanguages: (string[] | null | undefined)[]): string[] {
  const lists = planLanguages.filter((list): list is string[] => Array.isArray(list))

  if (lists.length === 0) return LANGUAGES.map((entry) => entry.code)

  // An empty list on any held plan lifts the cap.
  if (lists.some((list) => list.length === 0)) return LANGUAGES.map((entry) => entry.code)

  const union = new Set(lists.flat())

  // English is always available: a customer must never be locked out of the
  // one language every fallback and every seed prompt is written in.
  union.add(DEFAULT_LANGUAGE)

  // Catalogue order, so the picker does not reshuffle between accounts.
  return LANGUAGES.filter((entry) => union.has(entry.code)).map((entry) => entry.code)
}

export function canUseLanguage(code: string, allowed: string[]): boolean {
  return allowed.includes(language(code)?.code ?? code)
}

/**
 * What the picker should offer, given whatever came back from the server.
 *
 * Separated from the React hook so the failure cases can be tested, because
 * the failure cases are where this went wrong. The old hook defaulted to
 * `['en']`, so a request that was merely in flight — or that failed — showed
 * one language and captioned it "83 more are on the higher tiers". That reads
 * as a plan restriction and is indistinguishable from one.
 *
 * The rules:
 *
 *   - No answer yet, or a bad one: offer everything, claim nothing. Offering a
 *     language the plan does not cover is a far smaller problem than hiding
 *     eighty of them behind a false upsell.
 *   - A real answer: use it exactly, and only then say what is locked.
 *
 * An empty array counts as a bad answer rather than "nothing allowed". A tier
 * that permits no languages at all is not a thing the business sells, so an
 * empty list is far more likely to be a failed query than a real restriction.
 */
export function resolveAllowed(payload: unknown): { allowed: string[]; answered: boolean } {
  const all = LANGUAGES.map((entry) => entry.code)

  if (!payload || typeof payload !== 'object') return { allowed: all, answered: false }

  const list = (payload as { allowed?: unknown }).allowed

  if (!Array.isArray(list) || list.length === 0) return { allowed: all, answered: false }

  const codes = list.filter((code): code is string => typeof code === 'string' && code.length > 0)

  if (codes.length === 0) return { allowed: all, answered: false }

  return { allowed: codes, answered: true }
}

/** "a", "a and b", "a, b and c" — for reading aloud inside a prompt. */
function inWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''

  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * The sentence that goes into a generation prompt.
 *
 * Empty for English so the existing prompts are unchanged — every one of them
 * already produces English, and adding a redundant instruction is a way to
 * make a model second-guess itself.
 *
 * `keepEnglish` names the JSON fields that must NOT be translated. It exists
 * for one specific reason: several of these agents return a mix of prose the
 * reader sees and prompts that are fed straight to an image or video model.
 * Those models are trained overwhelmingly on English captions, so a Hindi or
 * Arabic prompt gets markedly worse art — or a blank frame. Translating the
 * whole response is therefore wrong in exactly the places it matters most, and
 * the failure is silent: the story reads perfectly and the pictures quietly
 * stop matching it.
 */
export function promptDirective(
  code: string | null | undefined,
  options: { keepEnglish?: string[] } = {}
): string {
  const entry = language(code)

  if (!entry || entry.code === DEFAULT_LANGUAGE) return ''

  const base = `\n\nWrite ALL text the reader sees — the title, the story, every caption and every line of dialogue — in ${entry.name} (${entry.nativeName}). Do not translate names of characters. Keep any JSON keys in English; only the values change.`

  const keep = (options.keepEnglish ?? []).filter(Boolean)

  if (keep.length === 0) return base

  const fields = inWords(keep.map((field) => `"${field}"`))
  const one = keep.length === 1

  // "Latin script only" and the transliteration instruction are both load
  // bearing. Without them the prose translates but the character names do
  // not — the model writes a Hindi story about छोटू and then drops छोटू into
  // an otherwise-English image prompt, where it is a token the image model has
  // no idea what to do with.
  return `${base}\n\nONE EXCEPTION: ${fields} must stay entirely in English, using Latin script only — transliterate any character name rather than writing it in another script. ${one ? 'It is' : 'They are'} fed to an image model rather than read by a person, and non-English text in ${one ? 'it' : 'them'} produces poor artwork.`
}

/** The tag speech synthesis wants, which is not always the language code. */
export function voiceTag(code: string | null | undefined): string {
  return language(code)?.voice ?? 'en-US'
}

export function isRtl(code: string | null | undefined): boolean {
  return Boolean(language(code)?.rtl)
}

/**
 * A sensible default from the browser's own locale.
 *
 * Only if that language is actually unlocked — offering someone their own
 * language and then refusing it would be worse than defaulting to English.
 */
export function preferredLanguage(locale: string | undefined, allowed: string[]): string {
  const guess = language(locale)?.code

  return guess && allowed.includes(guess) ? guess : DEFAULT_LANGUAGE
}
