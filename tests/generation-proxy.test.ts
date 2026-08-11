import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The proxy's allowlist has to cover what the app actually calls.
 *
 * These two live in different files and nothing links them: add a call to a
 * new backend endpoint, forget the allowlist, and it returns 404 — in
 * production, from a page that worked in development, with an error message
 * about a "generation endpoint" that means nothing to the customer.
 *
 * The old failure this replaced was worse and of the same shape: the browser
 * called the backend directly, which worked locally and was blocked by CORS
 * the moment it was deployed. Both are "works here, not there", which is the
 * class of bug worth spending a test on.
 */

const root = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue

    const full = join(dir, name)

    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(name)) out.push(full)
  }

  return out
}

/** The endpoints named in the proxy's allowlist. */
function allowlist(): Set<string> {
  const source = readFileSync(
    join(root, 'app', 'api', 'generate', '[...path]', 'route.ts'),
    'utf8'
  )

  const block = source.slice(source.indexOf('const ALLOWED'), source.indexOf('])'))

  return new Set([...block.matchAll(/'([a-z-]+\/[a-z-]+)'/g)].map((match) => match[1]))
}

/**
 * Endpoints the browser builds against the generation base.
 *
 * Matched on the shape every caller uses — a template string starting with the
 * API base — rather than on a list kept by hand, which would need the same
 * maintenance the allowlist does and defeat the point.
 */
function calledEndpoints(): { endpoint: string; file: string }[] {
  const found: { endpoint: string; file: string }[] = []

  for (const file of [...walk(join(root, 'app')), ...walk(join(root, 'components'))]) {
    // The proxy itself names them all, and would match everything.
    if (file.includes(join('api', 'generate'))) continue

    const source = readFileSync(file, 'utf8')

    for (const match of source.matchAll(
      /\$\{(?:API|API_BASE|GENERATION_API_URL|base)\}\/([a-z-]+\/[a-z-]+)/g
    )) {
      found.push({ endpoint: match[1], file: file.replace(root, '') })
    }

    for (const match of source.matchAll(/generationUrl\(\s*["']([a-z-]+\/[a-z-]+)["']/g)) {
      found.push({ endpoint: match[1], file: file.replace(root, '') })
    }
  }

  return found
}

describe('the generation proxy allowlist', () => {
  it('covers every endpoint the app calls', () => {
    const allowed = allowlist()
    const missing = calledEndpoints().filter((call) => !allowed.has(call.endpoint))

    expect(
      missing.map((call) => `${call.endpoint} (${call.file})`),
      'These are called but not in ALLOWED, so they would 404 in production'
    ).toEqual([])
  })

  it('finds the calls at all, so an empty pass is not mistaken for a pass', () => {
    // Without this, a change to how callers build their URLs would make the
    // test above vacuously true and hide the very thing it exists to catch.
    expect(calledEndpoints().length).toBeGreaterThan(3)
  })

  it('has an allowlist to check against', () => {
    expect(allowlist().size).toBeGreaterThan(3)
  })
})

describe('the browser never calls the backend directly', () => {
  it('no client component builds a URL from the backend host', () => {
    // This is the bug that broke every generator on deployment: a direct
    // cross-origin call the backend refuses to answer a preflight for.
    const offenders: string[] = []

    for (const file of [...walk(join(root, 'app')), ...walk(join(root, 'components'))]) {
      const source = readFileSync(file, 'utf8')

      if (!source.includes("'use client'") && !source.includes('"use client"')) continue

      // `process.env.` and a real URL, not the words appearing inside a
      // sentence — the console explains this setting to the platform owner,
      // and naming it there is not the same as calling it.
      if (/process\.env\.NEXT_PUBLIC_API_URL|https:\/\/zoop-a1-v2/.test(source)) {
        offenders.push(file.replace(root, ''))
      }
    }

    expect(offenders, 'These reach the backend directly and will hit CORS').toEqual([])
  })
})
