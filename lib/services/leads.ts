/**
 * Lead import, validation and de-duplication.
 *
 * CSV parsing is done here rather than with a dependency because the format
 * accepted is narrow and the failure modes matter: a quoted comma inside a
 * name must not shift every later column, and a duplicate must be reported
 * rather than silently dropped.
 */

export interface LeadInput {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  tags?: string[]
  source?: string
}

export interface LeadImportRow extends LeadInput {
  rowNumber: number
}

export interface LeadImportResult {
  valid: LeadImportRow[]
  duplicatesInFile: LeadImportRow[]
  invalid: { rowNumber: number; reason: string; raw: string }[]
}

// Deliberately permissive: rejecting unusual but legal addresses loses real
// leads, which is worse than letting the provider bounce one.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@,]+\.[^\s@,]{2,}$/

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim()

  if (trimmed.length === 0 || trimmed.length > 254) return false
  if (trimmed.includes('..')) return false

  return EMAIL_PATTERN.test(trimmed)
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Split one CSV line, honouring double-quoted fields and "" escapes.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current)

  return fields.map((field) => field.trim())
}

const HEADER_ALIASES: Record<string, keyof LeadInput> = {
  email: 'email',
  'email address': 'email',
  mail: 'email',
  first_name: 'firstName',
  'first name': 'firstName',
  firstname: 'firstName',
  name: 'firstName',
  last_name: 'lastName',
  'last name': 'lastName',
  lastname: 'lastName',
  surname: 'lastName',
  phone: 'phone',
  mobile: 'phone',
  tags: 'tags',
  source: 'source',
}

export function parseLeadsCsv(csv: string, defaultSource?: string): LeadImportResult {
  const result: LeadImportResult = { valid: [], duplicatesInFile: [], invalid: [] }

  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return result

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase())
  const emailIndex = headers.findIndex((header) => HEADER_ALIASES[header] === 'email')

  if (emailIndex === -1) {
    result.invalid.push({ rowNumber: 1, reason: 'No email column found', raw: lines[0] })
    return result
  }

  const seen = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1
    const fields = parseCsvLine(lines[i])
    const rawEmail = fields[emailIndex] ?? ''

    if (!isValidEmail(rawEmail)) {
      result.invalid.push({ rowNumber, reason: 'Invalid email address', raw: lines[i] })
      continue
    }

    const email = normaliseEmail(rawEmail)
    const row: LeadImportRow = { rowNumber, email, source: defaultSource }

    headers.forEach((header, index) => {
      const field = HEADER_ALIASES[header]
      if (!field || field === 'email') return

      const value = fields[index]
      if (!value) return

      if (field === 'tags') {
        row.tags = value
          .split(/[;|]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      } else {
        row[field] = value as never
      }
    })

    if (seen.has(email)) {
      result.duplicatesInFile.push(row)
      continue
    }

    seen.add(email)
    result.valid.push(row)
  }

  return result
}

/** Split an import against emails already stored for the tenant. */
export function partitionExisting(
  rows: LeadImportRow[],
  existingEmails: string[]
): { toInsert: LeadImportRow[]; alreadyPresent: LeadImportRow[] } {
  const existing = new Set(existingEmails.map(normaliseEmail))

  const toInsert: LeadImportRow[] = []
  const alreadyPresent: LeadImportRow[] = []

  for (const row of rows) {
    if (existing.has(normaliseEmail(row.email))) {
      alreadyPresent.push(row)
    } else {
      toInsert.push(row)
    }
  }

  return { toInsert, alreadyPresent }
}

export function toCsv(leads: LeadInput[]): string {
  const escape = (value: string | undefined) => {
    const text = value ?? ''

    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const header = 'email,first_name,last_name,phone,tags,source'

  const rows = leads.map((lead) =>
    [
      escape(lead.email),
      escape(lead.firstName),
      escape(lead.lastName),
      escape(lead.phone),
      escape(lead.tags?.join(';')),
      escape(lead.source),
    ].join(',')
  )

  return [header, ...rows].join('\n')
}
