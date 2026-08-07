/**
 * Email template rendering.
 *
 * Placeholders are `{{name}}`. Values are HTML-escaped before substitution:
 * a lead's name ends up inside broadcast HTML, so an unescaped `<script>` in
 * a CSV import would otherwise become script injection in every inbox that
 * renders it.
 */

export interface TemplateContext {
  [key: string]: string | number | null | undefined
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function extractPlaceholders(template: string): string[] {
  const found = new Set<string>()

  for (const match of template.matchAll(PLACEHOLDER)) {
    found.add(match[1])
  }

  return [...found].sort()
}

export interface RenderResult {
  output: string
  missing: string[]
}

export function renderTemplate(
  template: string,
  context: TemplateContext,
  options: { escape?: boolean } = {}
): RenderResult {
  const shouldEscape = options.escape ?? true
  const missing = new Set<string>()

  const output = template.replace(PLACEHOLDER, (_match, key: string) => {
    const value = context[key]

    if (value === undefined || value === null || value === '') {
      missing.add(key)
      return ''
    }

    const text = String(value)

    return shouldEscape ? escapeHtml(text) : text
  })

  return { output, missing: [...missing].sort() }
}

/** Plain-text fallback used when a template has no text body. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
