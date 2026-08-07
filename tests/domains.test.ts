import { describe, it, expect } from 'vitest'
import { hostname, isPlatformHost, platformHostsFromEnv } from '@/lib/domains/host'
import { normaliseHost, txtRecordName, isApexDomain, TXT_PREFIX } from '@/lib/domains/records'

describe('hostname normalisation', () => {
  it('strips the port', () => {
    expect(hostname('portal.example.com:443')).toBe('portal.example.com')
    expect(hostname('localhost:3000')).toBe('localhost')
  })

  it('lowercases and trims', () => {
    expect(hostname('  Portal.EXAMPLE.com ')).toBe('portal.example.com')
  })

  it('drops the trailing dot DNS allows', () => {
    expect(hostname('portal.example.com.')).toBe('portal.example.com')
  })

  it('handles missing input', () => {
    expect(hostname(null)).toBe('')
    expect(hostname(undefined)).toBe('')
  })
})

describe('platform host detection', () => {
  const platform = ['app.comictale.ai']

  it('treats the platform host and its subdomains as platform', () => {
    expect(isPlatformHost('app.comictale.ai', platform)).toBe(true)
    expect(isPlatformHost('staging.app.comictale.ai', platform)).toBe(true)
  })

  it('treats localhost and IPs as platform, never as a mapped domain', () => {
    // A row claiming "localhost" must not be able to hijack development.
    expect(isPlatformHost('localhost:3000', platform)).toBe(true)
    expect(isPlatformHost('127.0.0.1', platform)).toBe(true)
    expect(isPlatformHost('192.168.1.70:3000', platform)).toBe(true)
  })

  it('treats a customer domain as not the platform', () => {
    expect(isPlatformHost('portal.customer.com', platform)).toBe(false)
    expect(isPlatformHost('comics.someoneelse.io', platform)).toBe(false)
  })

  it('does not match on a suffix that is not a real subdomain', () => {
    // notcomictale.ai must not be mistaken for the platform.
    expect(isPlatformHost('notapp.comictale.ai.evil.com', platform)).toBe(false)
    expect(isPlatformHost('evilapp.comictale.ai.attacker.net', platform)).toBe(false)
  })

  it('falls back to treating an empty host as platform', () => {
    expect(isPlatformHost('', platform)).toBe(true)
  })

  it('reads platform hosts out of the environment', () => {
    const hosts = platformHostsFromEnv({
      NEXT_PUBLIC_SITE_URL: 'https://app.comictale.ai',
      VERCEL_URL: 'preview-abc.vercel.app',
    })

    expect(hosts).toEqual(['app.comictale.ai', 'preview-abc.vercel.app'])
  })
})

describe('DNS record helpers', () => {
  it('puts the TXT record on a dedicated sub-name', () => {
    expect(txtRecordName('portal.example.com')).toBe(`${TXT_PREFIX}.portal.example.com`)
  })

  it('normalises hosts the way DNS answers arrive', () => {
    expect(normaliseHost('Portal.Example.COM.')).toBe('portal.example.com')
  })
})

describe('apex domain detection', () => {
  it('flags plain root domains', () => {
    expect(isApexDomain('example.com')).toBe(true)
    expect(isApexDomain('comictale.ai')).toBe(true)
  })

  it('flags roots on two-part suffixes', () => {
    expect(isApexDomain('example.co.uk')).toBe(true)
    expect(isApexDomain('example.com.au')).toBe(true)
  })

  it('allows ordinary subdomains', () => {
    expect(isApexDomain('portal.example.com')).toBe(false)
    expect(isApexDomain('app.example.co.uk')).toBe(false)
  })

  it('is case and trailing-dot insensitive', () => {
    expect(isApexDomain('Example.COM.')).toBe(true)
  })
})
