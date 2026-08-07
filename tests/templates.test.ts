import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  extractPlaceholders,
  renderTemplate,
  htmlToText,
} from '@/lib/services/templates'

describe('placeholder extraction', () => {
  it('finds every unique placeholder, sorted', () => {
    expect(extractPlaceholders('Hi {{first_name}}, welcome to {{brand_name}}. {{first_name}}!'))
      .toEqual(['brand_name', 'first_name'])
  })

  it('tolerates whitespace inside the braces', () => {
    expect(extractPlaceholders('{{ first_name }}')).toEqual(['first_name'])
  })

  it('returns nothing for a template without placeholders', () => {
    expect(extractPlaceholders('Plain text')).toEqual([])
  })
})

describe('rendering', () => {
  it('substitutes values', () => {
    const { output } = renderTemplate('Hi {{name}}', { name: 'Alice' })

    expect(output).toBe('Hi Alice')
  })

  it('escapes HTML in values by default', () => {
    // A lead name from a CSV import ends up inside broadcast HTML.
    const { output } = renderTemplate('<p>{{name}}</p>', {
      name: '<script>alert(1)</script>',
    })

    expect(output).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
    expect(output).not.toContain('<script>')
  })

  it('can opt out of escaping for trusted HTML', () => {
    const { output } = renderTemplate('{{block}}', { block: '<b>bold</b>' }, { escape: false })

    expect(output).toBe('<b>bold</b>')
  })

  it('reports missing values and renders them as empty', () => {
    const { output, missing } = renderTemplate('Hi {{name}} from {{brand}}', { name: 'Alice' })

    expect(output).toBe('Hi Alice from ')
    expect(missing).toEqual(['brand'])
  })

  it('treats null, undefined and empty string as missing', () => {
    const { missing } = renderTemplate('{{a}}{{b}}{{c}}', { a: null, b: undefined, c: '' })

    expect(missing).toEqual(['a', 'b', 'c'])
  })

  it('renders numeric values', () => {
    expect(renderTemplate('{{credits}} left', { credits: 0 }).output).toBe('0 left')
  })

  it('leaves an unknown syntax untouched', () => {
    expect(renderTemplate('{single} and {{{weird}}}', {}).output).toContain('{single}')
  })
})

describe('escapeHtml', () => {
  it('escapes every dangerous character', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })

  it('escapes ampersands before entities, not after', () => {
    // Getting this order wrong yields &amp;lt;
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })
})

describe('htmlToText', () => {
  it('strips tags and keeps readable breaks', () => {
    expect(htmlToText('<p>Hello</p><p>World</p>')).toBe('Hello\n\nWorld')
  })

  it('drops script and style content entirely', () => {
    const text = htmlToText('<style>p{color:red}</style><script>alert(1)</script><p>Hi</p>')

    expect(text).toBe('Hi')
  })

  it('converts line breaks and decodes entities', () => {
    expect(htmlToText('a<br>b&amp;c')).toBe('a\nb&c')
  })
})
