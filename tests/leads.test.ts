import { describe, it, expect } from 'vitest'
import {
  isValidEmail,
  normaliseEmail,
  parseCsvLine,
  parseLeadsCsv,
  partitionExisting,
  toCsv,
} from '@/lib/services/leads'

describe('email validation', () => {
  it('accepts ordinary and plus-tagged addresses', () => {
    expect(isValidEmail('someone@example.com')).toBe(true)
    expect(isValidEmail('some.one+tag@sub.example.co.uk')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('no-at-sign')).toBe(false)
    expect(isValidEmail('two@@example.com')).toBe(false)
    expect(isValidEmail('no@tld')).toBe(false)
    expect(isValidEmail('spaces in@example.com')).toBe(false)
    expect(isValidEmail('double..dot@example.com')).toBe(false)
  })

  it('rejects an address longer than the RFC limit', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })

  it('lowercases and trims when normalising', () => {
    expect(normaliseEmail('  SomeOne@Example.COM ')).toBe('someone@example.com')
  })
})

describe('CSV line parsing', () => {
  it('splits plain fields', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('keeps a quoted comma inside one field', () => {
    // The bug that silently shifts every later column.
    expect(parseCsvLine('"Doe, Jane",jane@example.com')).toEqual([
      'Doe, Jane',
      'jane@example.com',
    ])
  })

  it('unescapes a doubled quote', () => {
    expect(parseCsvLine('"She said ""hi""",x')).toEqual(['She said "hi"', 'x'])
  })

  it('preserves empty trailing fields', () => {
    expect(parseCsvLine('a,,')).toEqual(['a', '', ''])
  })
})

describe('lead import', () => {
  const csv = [
    'email,first_name,last_name,tags',
    'a@example.com,Alice,Adams,vip;beta',
    'b@example.com,Bob,Brown,',
    'not-an-email,Carol,Clark,',
    'A@EXAMPLE.COM,Alice Again,Adams,',
  ].join('\n')

  it('parses valid rows with fields and tags', () => {
    const result = parseLeadsCsv(csv)

    expect(result.valid).toHaveLength(2)
    expect(result.valid[0]).toMatchObject({
      email: 'a@example.com',
      firstName: 'Alice',
      lastName: 'Adams',
      tags: ['vip', 'beta'],
      rowNumber: 2,
    })
  })

  it('reports invalid rows instead of dropping them silently', () => {
    const result = parseLeadsCsv(csv)

    expect(result.invalid).toHaveLength(1)
    expect(result.invalid[0]).toMatchObject({ rowNumber: 4, reason: 'Invalid email address' })
  })

  it('catches case-insensitive duplicates within the file', () => {
    const result = parseLeadsCsv(csv)

    expect(result.duplicatesInFile).toHaveLength(1)
    expect(result.duplicatesInFile[0].email).toBe('a@example.com')
  })

  it('accepts alternative header names', () => {
    const result = parseLeadsCsv('Email Address,First Name\nx@example.com,Xena')

    expect(result.valid[0]).toMatchObject({ email: 'x@example.com', firstName: 'Xena' })
  })

  it('fails clearly when there is no email column', () => {
    const result = parseLeadsCsv('name,phone\nBob,12345')

    expect(result.valid).toHaveLength(0)
    expect(result.invalid[0].reason).toBe('No email column found')
  })

  it('handles an empty file and a header-only file', () => {
    expect(parseLeadsCsv('')).toMatchObject({ valid: [], invalid: [], duplicatesInFile: [] })
    expect(parseLeadsCsv('email\n').valid).toHaveLength(0)
  })

  it('applies the default source to every row', () => {
    const result = parseLeadsCsv('email\nz@example.com', 'webinar')

    expect(result.valid[0].source).toBe('webinar')
  })

  it('survives quoted commas in a real row', () => {
    const result = parseLeadsCsv('email,last_name\nq@example.com,"Doe, Jane"')

    expect(result.valid[0].lastName).toBe('Doe, Jane')
  })
})

describe('existing-lead partitioning', () => {
  it('separates rows already stored for the tenant, ignoring case', () => {
    const rows = parseLeadsCsv('email\nnew@example.com\nold@example.com').valid

    const { toInsert, alreadyPresent } = partitionExisting(rows, ['OLD@example.com'])

    expect(toInsert.map((r) => r.email)).toEqual(['new@example.com'])
    expect(alreadyPresent.map((r) => r.email)).toEqual(['old@example.com'])
  })

  it('inserts everything when the tenant has no leads yet', () => {
    const rows = parseLeadsCsv('email\na@example.com').valid

    expect(partitionExisting(rows, []).toInsert).toHaveLength(1)
  })
})

describe('CSV export', () => {
  it('round-trips a value containing a comma', () => {
    const csv = toCsv([{ email: 'a@example.com', lastName: 'Doe, Jane' }])
    const [, dataLine] = csv.split('\n')

    expect(parseCsvLine(dataLine)[2]).toBe('Doe, Jane')
  })

  it('escapes embedded quotes', () => {
    const csv = toCsv([{ email: 'a@example.com', firstName: 'He said "hi"' }])

    expect(csv).toContain('"He said ""hi"""')
  })

  it('joins tags with a semicolon so the comma stays the delimiter', () => {
    const csv = toCsv([{ email: 'a@example.com', tags: ['vip', 'beta'] }])

    expect(csv).toContain('vip;beta')
  })

  it('writes a header even with no leads', () => {
    expect(toCsv([])).toBe('email,first_name,last_name,phone,tags,source')
  })
})
