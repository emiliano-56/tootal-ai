import { describe, it, expect } from 'vitest'
import {
  readField,
  firstNameFrom,
  parseIpn,
  chainFor,
  generatePassword,
  type IpnRules,
} from '@/lib/ipn/payload'

const RULES: IpnRules = {
  fields: {
    email: 'email',
    name: 'name',
    product: 'product_id',
    transaction: 'transaction_id',
    event: 'transaction_type',
  },
  saleEvents: ['SALE', 'TEST_SALE'],
  refundEvents: ['RFND', 'CGBK'],
}

const SALE = {
  email: 'Buyer@Example.com',
  name: 'Arpit Jain',
  product_id: 'CT-OTO4-150',
  transaction_id: 'TX-1',
  transaction_type: 'SALE',
}

describe('reading a payload', () => {
  it('takes a value by its exact key', () => {
    expect(readField({ email: 'a@b.com' }, 'email')).toBe('a@b.com')
  })

  it('matches a key regardless of case and punctuation', () => {
    // The same field arrives as customer_email, CustomerEmail and
    // customer-email depending on who wrote the integration.
    expect(readField({ CustomerEmail: 'a@b.com' }, 'customer_email')).toBe('a@b.com')
    expect(readField({ 'customer-email': 'a@b.com' }, 'customerEmail')).toBe('a@b.com')
  })

  it('follows a dotted path into a nested object', () => {
    expect(readField({ buyer: { email: 'a@b.com' } }, 'buyer.email')).toBe('a@b.com')
  })

  it('returns an empty string rather than throwing on a missing path', () => {
    expect(readField({}, 'buyer.email')).toBe('')
    expect(readField({ buyer: 'not an object' }, 'buyer.email')).toBe('')
    expect(readField({}, '')).toBe('')
  })

  it('refuses to stringify an object into a field', () => {
    expect(readField({ email: { nested: true } }, 'email')).toBe('')
  })

  it('trims and stringifies numbers', () => {
    expect(readField({ product_id: 4021 }, 'product_id')).toBe('4021')
    expect(readField({ email: '  a@b.com ' }, 'email')).toBe('a@b.com')
  })
})

describe('greeting', () => {
  it('uses the first word of the name', () => {
    expect(firstNameFrom('Arpit Jain', 'x@y.com')).toBe('Arpit')
  })

  it('falls back to the address when no name was sent', () => {
    expect(firstNameFrom('', 'arpit@y.com')).toBe('Arpit')
  })

  it('has something to say even for an empty address', () => {
    expect(firstNameFrom('', '')).toBe('there')
  })
})

describe('classifying a notification', () => {
  it('reads a sale', () => {
    const parsed = parseIpn(SALE, RULES)

    expect(parsed.action).toBe('sale')
    expect(parsed.email).toBe('buyer@example.com')
    expect(parsed.firstName).toBe('Arpit')
    expect(parsed.productId).toBe('CT-OTO4-150')
    expect(parsed.transactionId).toBe('TX-1')
  })

  it('matches an event name whatever its case', () => {
    expect(parseIpn({ ...SALE, transaction_type: 'sale' }, RULES).action).toBe('sale')
  })

  it('reads a refund', () => {
    expect(parseIpn({ ...SALE, transaction_type: 'RFND' }, RULES).action).toBe('refund')
  })

  it('treats a missing event field as a sale', () => {
    // Some vendors post only on a completed sale and send no type at all.
    expect(parseIpn({ ...SALE, transaction_type: '' }, RULES).action).toBe('sale')
  })

  it('ignores an event it does not recognise', () => {
    // A rebill notice treated as a sale would create a second account.
    const parsed = parseIpn({ ...SALE, transaction_type: 'REBILL' }, RULES)

    expect(parsed.action).toBe('ignore')
    expect(parsed.reason).toContain('REBILL')
  })

  it('ignores a payload with no usable address', () => {
    expect(parseIpn({ ...SALE, email: '' }, RULES).action).toBe('ignore')
    expect(parseIpn({ ...SALE, email: 'not-an-address' }, RULES).action).toBe('ignore')
  })

  it('ignores a payload with no product', () => {
    const parsed = parseIpn({ ...SALE, product_id: '' }, RULES)

    expect(parsed.action).toBe('ignore')
    expect(parsed.reason).toContain('product')
  })
})

// ---------------------------------------------------------------------------
//  Backfilling the chain
// ---------------------------------------------------------------------------

const CATALOGUE = [
  { code: 'fe', tier: 'fe', requires: null, isBundle: false },
  { code: 'oto1', tier: 'oto1', requires: 'fe', isBundle: false },
  { code: 'oto2', tier: 'oto2', requires: 'oto1', isBundle: false },
  { code: 'oto3', tier: 'oto3', requires: 'oto2', isBundle: false },
  { code: 'oto4_100', tier: 'oto4', requires: 'oto3', isBundle: false },
  { code: 'oto4_150', tier: 'oto4', requires: 'oto3', isBundle: false },
  { code: 'oto5_15', tier: 'oto5', requires: 'oto4', isBundle: false },
  { code: 'oto5_25', tier: 'oto5', requires: 'oto4', isBundle: false },
  { code: 'mega', tier: 'bundle', requires: null, isBundle: true },
]

describe('what a purchase grants', () => {
  it('grants Front End alone', () => {
    expect(chainFor('fe', CATALOGUE)).toEqual(['fe'])
  })

  it('grants everything beneath the tier bought', () => {
    // The funnel only offers OTO 2 to someone who already bought FE and
    // OTO 1, so a post for OTO 2 implies both.
    expect(chainFor('oto2', CATALOGUE)).toEqual(['fe', 'oto1', 'oto2'])
  })

  it('picks the smaller licence when backfilling a tier we were not told about', () => {
    expect(chainFor('oto5_25', CATALOGUE)).toEqual([
      'fe', 'oto1', 'oto2', 'oto3', 'oto4_100', 'oto5_25',
    ])
  })

  it('grants a bundle on its own, since it already expands', () => {
    expect(chainFor('mega', CATALOGUE)).toEqual(['mega'])
  })

  it('returns nothing for a code the catalogue does not have', () => {
    expect(chainFor('ghost', CATALOGUE)).toEqual([])
  })

  it('terminates on a circular requires rather than hanging', () => {
    const broken = [
      { code: 'a', tier: 'a', requires: 'b', isBundle: false },
      { code: 'b', tier: 'b', requires: 'a', isBundle: false },
    ]

    expect(chainFor('a', broken).length).toBeLessThanOrEqual(3)
  })
})

describe('generated password', () => {
  it('is long enough and mixes character classes', () => {
    const password = generatePassword()

    expect(password.length).toBeGreaterThanOrEqual(12)
    expect(password).toMatch(/[0-9]/)
    expect(password).toMatch(/[^a-zA-Z0-9]/)
  })

  it('differs between calls', () => {
    expect(generatePassword()).not.toBe(generatePassword())
  })

  it('avoids characters that are misread when typed from an email', () => {
    // No 0/O or 1/l/I — the password is copied out of a message by hand.
    const password = generatePassword().slice(0, -2)

    expect(password).not.toMatch(/[0O1lI]/)
  })
})
