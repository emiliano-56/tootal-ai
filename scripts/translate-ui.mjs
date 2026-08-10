/**
 * Fill the interface translations.
 *
 * Reads the English catalogue, asks DeepSeek for each language, and writes
 * `lib/i18n/ui/<code>.json`. Existing keys are kept, so re-running after adding
 * a string translates only the new one — this is cheap to run often and
 * expensive to run from scratch, and the whole point is that adding a string to
 * the catalogue is not a chore.
 *
 *   node scripts/translate-ui.mjs                 every language
 *   node scripts/translate-ui.mjs hi es fr        only these
 *   node scripts/translate-ui.mjs --force hi      redo ones already done
 *   node scripts/translate-ui.mjs --list          what is missing, no API calls
 *
 * The key is read from .env.local, the same one the agents use.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'lib', 'i18n', 'ui')

// ---------------------------------------------------------------------------
//  Inputs
// ---------------------------------------------------------------------------

function env(name) {
  const file = join(root, '.env.local')

  if (!existsSync(file)) return undefined

  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue

    const at = line.indexOf('=')

    if (at > 0 && line.slice(0, at).trim() === name) return line.slice(at + 1).trim()
  }

  return undefined
}

/**
 * The catalogue and the language list, read out of the TypeScript rather than
 * imported.
 *
 * A build step to run a translation script would be a build step somebody has
 * to remember. Both files are plain literals by design, and the regex is
 * checked against the parsed result — a silent partial parse would write
 * half-empty translation files, which is worse than failing.
 */
function readCatalog() {
  const source = readFileSync(join(root, 'lib', 'i18n', 'catalog.ts'), 'utf8')
  const body = source.slice(source.indexOf('export const CATALOG = {') + 24)

  const entries = [...body.matchAll(/'([\w.]+)':\s*\n?\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => [
    m[1],
    m[2].replace(/\\'/g, "'"),
  ])

  if (entries.length === 0) throw new Error('Could not read catalog.ts — has its shape changed?')

  return Object.fromEntries(entries)
}

function readLanguages() {
  const source = readFileSync(join(root, 'lib', 'i18n', 'languages.ts'), 'utf8')

  const entries = [
    ...source.matchAll(/\{ code: '([^']+)', name: '([^']+)', nativeName: '([^']+)'/g),
  ].map((m) => ({ code: m[1], name: m[2], nativeName: m[3] }))

  if (entries.length === 0) throw new Error('Could not read languages.ts')

  return entries
}

/** The `{name}` tokens in a string, sorted, as a comparable key. */
function placeholders(text) {
  return (text.match(/\{\w+\}/g) ?? []).sort().join(',')
}

// ---------------------------------------------------------------------------
//  DeepSeek
// ---------------------------------------------------------------------------

const SYSTEM = `You translate software interface strings.

You are given a JSON object of key/value pairs. Return a JSON object with THE SAME KEYS and the values translated.

Rules:
- Translate ONLY the values. Never translate, reorder or drop a key.
- Keep placeholders like {count}, {used}, {limit} EXACTLY as they are.
- These are buttons, menu items and headings. Keep them short — a translation
  twice the length of the English breaks the layout it sits in.
- Use the wording a native speaker expects in software, not a literal
  translation. "Dashboard" has a conventional rendering in most languages; use it.
- Do not translate: ComicTale AI, DFY, OTO, AI, PDF.
- Return only the JSON object. No markdown fence, no commentary.`

async function translate(key, language, strings) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Target language: ${language.name} (${language.nativeName})\n\n${JSON.stringify(strings, null, 2)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${(await response.text()).slice(0, 200)}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content

  if (!content) throw new Error('empty response')

  return JSON.parse(content)
}

// ---------------------------------------------------------------------------
//  Run
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const force = args.includes('--force')
const listOnly = args.includes('--list')
const wanted = args.filter((a) => !a.startsWith('--'))

const catalog = readCatalog()
const languages = readLanguages().filter((l) => l.code !== 'en')
const keys = Object.keys(catalog)

mkdirSync(outDir, { recursive: true })

const targets = wanted.length > 0 ? languages.filter((l) => wanted.includes(l.code)) : languages

console.log(`\n${keys.length} strings · ${targets.length} languages\n`)

if (listOnly) {
  const done = new Set(readdirSync(outDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)))

  for (const language of targets) {
    const file = join(outDir, `${language.code}.json`)
    const have = existsSync(file) ? Object.keys(JSON.parse(readFileSync(file, 'utf8'))).length : 0
    const pct = Math.round((have / keys.length) * 100)

    console.log(
      `  ${language.code.padEnd(6)} ${String(pct).padStart(3)}%  ${language.name}${done.has(language.code) ? '' : '  (no file)'}`
    )
  }

  console.log()
  process.exit(0)
}

const apiKey = env('DEEPSEEK_API_KEY')

if (!apiKey) {
  console.error('No DEEPSEEK_API_KEY in .env.local — nothing to translate with.\n')
  process.exit(1)
}

let translated = 0
let skipped = 0
let failed = 0

for (const language of targets) {
  const file = join(outDir, `${language.code}.json`)
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}

  // Only what is actually missing, unless asked to redo the lot.
  const todo = force
    ? catalog
    : Object.fromEntries(keys.filter((k) => !existing[k]).map((k) => [k, catalog[k]]))

  if (Object.keys(todo).length === 0) {
    skipped++
    console.log(`  ${language.code.padEnd(6)} up to date`)
    continue
  }

  process.stdout.write(`  ${language.code.padEnd(6)} ${Object.keys(todo).length} strings… `)

  try {
    const result = await translate(apiKey, language, todo)

    // Only keys we asked about, and only strings. A model that invents a key
    // or answers with an object would otherwise put junk in the catalogue.
    const clean = {}
    const dropped = []

    for (const key of Object.keys(todo)) {
      const value = typeof result[key] === 'string' ? result[key].trim() : ''

      if (!value) continue

      // A translation that loses "{count}" renders as a sentence with a hole
      // where the number should be, and it only shows up in a language nobody
      // on the team reads. Refused here and left in English, which is wrong but
      // not broken — and reported, so the English string can be reworded.
      if (placeholders(value) !== placeholders(todo[key])) {
        dropped.push(key)
        continue
      }

      clean[key] = value
    }

    const merged = { ...existing, ...clean }

    writeFileSync(file, `${JSON.stringify(merged, Object.keys(merged).sort(), 2)}\n`)

    const missing = keys.length - Object.keys(merged).length
    const notes = []

    if (dropped.length > 0) notes.push(`${dropped.length} kept in English: ${dropped.join(', ')}`)
    if (missing > 0) notes.push(`${missing} still missing`)

    console.log(`ok${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`)
    translated++
  } catch (error) {
    console.log(`FAILED — ${error.message}`)
    failed++
  }
}

console.log(
  `\n${translated} translated · ${skipped} already done${failed > 0 ? ` · ${failed} failed` : ''}\n`
)
