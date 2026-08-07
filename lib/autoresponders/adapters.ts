import {
  request,
  nameParts,
  type Adapter,
  type Connection,
  type ListSummary,
  type PushResult,
  type Subscriber,
} from '@/lib/autoresponders/types'

/**
 * The nine autoresponder adapters.
 *
 * Each one is small on purpose: authenticate, map the subscriber, interpret
 * the response. The differences that matter are noted inline — several of
 * these APIs report "already subscribed" as an error, and treating that as a
 * failure would make every re-import look broken.
 */

const json = { 'Content-Type': 'application/json' }

function alreadySubscribed(status: number, body: unknown): boolean {
  const text = JSON.stringify(body ?? '').toLowerCase()

  return (
    status === 409 ||
    text.includes('already subscribed') ||
    text.includes('already exists') ||
    text.includes('member exists') ||
    text.includes('duplicate')
  )
}

// ---------------------------------------------------------------------------
//  GetResponse — X-Auth-Token, campaign id
// ---------------------------------------------------------------------------

const getresponse: Adapter = {
  provider: 'getresponse',
  label: 'GetResponse',
  fields: {
    apiKey: { label: 'API key', hint: 'Menu → Integrations & API → API' },
    listId: { label: 'Campaign', hint: 'The list to add contacts to', required: true },
  },

  async verify(connection) {
    const res = await request('https://api.getresponse.com/v3/accounts', {
      headers: { 'X-Auth-Token': `api-key ${connection.apiKey}` },
    })

    return { ok: res.ok, status: res.status, error: res.error }
  },

  async lists(connection) {
    const res = await request('https://api.getresponse.com/v3/campaigns?perPage=100', {
      headers: { 'X-Auth-Token': `api-key ${connection.apiKey}` },
    })

    if (!res.ok) return { ok: false, error: res.error }

    const lists = (res.body as { campaignId: string; name: string }[]).map((c) => ({
      id: c.campaignId,
      name: c.name,
    }))

    return { ok: true, lists }
  },

  async push(connection, subscriber) {
    const { first, last } = nameParts(subscriber)

    const res = await request('https://api.getresponse.com/v3/contacts', {
      method: 'POST',
      headers: { ...json, 'X-Auth-Token': `api-key ${connection.apiKey}` },
      body: JSON.stringify({
        email: subscriber.email,
        name: [first, last].filter(Boolean).join(' ') || undefined,
        campaign: { campaignId: connection.listId },
        tags: subscriber.tags?.map((tag) => ({ tagId: tag })),
      }),
    })

    if (!res.ok && alreadySubscribed(res.status, res.body)) {
      return { ok: true, alreadySubscribed: true, status: res.status }
    }

    return { ok: res.ok, status: res.status, error: res.error }
  },
}

// ---------------------------------------------------------------------------
//  EmailOctopus — key in the body, list id in the path
// ---------------------------------------------------------------------------

const emailoctopus: Adapter = {
  provider: 'emailoctopus',
  label: 'EmailOctopus',
  fields: {
    apiKey: { label: 'API key', hint: 'Account settings → API' },
    listId: { label: 'List ID', required: true },
  },

  async verify(connection) {
    const res = await request(
      `https://emailoctopus.com/api/1.6/lists?api_key=${encodeURIComponent(connection.apiKey)}`
    )

    return { ok: res.ok, status: res.status, error: res.error }
  },

  async lists(connection) {
    const res = await request(
      `https://emailoctopus.com/api/1.6/lists?api_key=${encodeURIComponent(connection.apiKey)}&limit=100`
    )

    if (!res.ok) return { ok: false, error: res.error }

    const data = (res.body as { data?: { id: string; name: string }[] }).data ?? []

    return { ok: true, lists: data.map((l) => ({ id: l.id, name: l.name })) }
  },

  async push(connection, subscriber) {
    const { first, last } = nameParts(subscriber)

    const res = await request(
      `https://emailoctopus.com/api/1.6/lists/${connection.listId}/contacts`,
      {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          api_key: connection.apiKey,
          email_address: subscriber.email,
          fields: { FirstName: first, LastName: last, ...subscriber.fields },
          tags: subscriber.tags,
          status: 'SUBSCRIBED',
        }),
      }
    )

    // EmailOctopus uses a typed error code rather than a status for duplicates.
    const code = (res.body as { error?: { code?: string } })?.error?.code

    if (!res.ok && code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
      return { ok: true, alreadySubscribed: true, status: res.status }
    }

    return { ok: res.ok, status: res.status, error: res.error }
  },
}

// ---------------------------------------------------------------------------
//  AWeber — OAuth2 access token
// ---------------------------------------------------------------------------

const aweber: Adapter = {
  provider: 'aweber',
  label: 'AWeber',
  fields: {
    apiKey: { label: 'Access token', hint: 'OAuth2 access token from your AWeber app' },
    apiSecret: { label: 'Account ID', hint: 'Numeric account id' },
    listId: { label: 'List ID', required: true },
  },

  async verify(connection) {
    const res = await request('https://api.aweber.com/1.0/accounts', {
      headers: { Authorization: `Bearer ${connection.apiKey}` },
    })

    return { ok: res.ok, status: res.status, error: res.error }
  },

  async lists(connection) {
    const account = connection.apiSecret

    if (!account) return { ok: false, error: 'Account ID is required to list AWeber lists.' }

    const res = await request(`https://api.aweber.com/1.0/accounts/${account}/lists`, {
      headers: { Authorization: `Bearer ${connection.apiKey}` },
    })

    if (!res.ok) return { ok: false, error: res.error }

    const entries = (res.body as { entries?: { id: number; name: string }[] }).entries ?? []

    return { ok: true, lists: entries.map((l) => ({ id: String(l.id), name: l.name })) }
  },

  async push(connection, subscriber) {
    const { first, last } = nameParts(subscriber)

    const res = await request(
      `https://api.aweber.com/1.0/accounts/${connection.apiSecret}/lists/${connection.listId}/subscribers`,
      {
        method: 'POST',
        headers: { ...json, Authorization: `Bearer ${connection.apiKey}` },
        body: JSON.stringify({
          email: subscriber.email,
          name: [first, last].filter(Boolean).join(' ') || undefined,
          tags: subscriber.tags,
          custom_fields: subscriber.fields,
        }),
      }
    )

    if (!res.ok && alreadySubscribed(res.status, res.body)) {
      return { ok: true, alreadySubscribed: true, status: res.status }
    }

    return { ok: res.ok, status: res.status, error: res.error }
  },
}

// ---------------------------------------------------------------------------
//  Mailchimp — datacentre suffix inside the key, MD5 of the email as the id
// ---------------------------------------------------------------------------

function mailchimpBase(apiKey: string): string | null {
  const dc = apiKey.split('-')[1]

  return dc ? `https://${dc}.api.mailchimp.com/3.0` : null
}

/**
 * Mailchimp addresses a member by the MD5 of the lowercased email, so an
 * upsert is a PUT to that id. Implemented here rather than pulled in as a
 * dependency — it is only ever used for this identifier, never for security.
 */
function md5(input: string): string {
  // Minimal MD5. Deterministic identifier only.
  const rl = (n: number, c: number) => (n << c) | (n >>> (32 - c))
  const au = (a: number, b: number) => (((a >> 16) + (b >> 16) + (((a & 65535) + (b & 65535)) >> 16)) << 16) | (((a & 65535) + (b & 65535)) & 65535)
  const cmn = (q: number, a: number, b: number, x: number, s: number, t: number) => au(rl(au(au(a, q), au(x, t)), s), b)
  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn((b & c) | (~b & d), a, b, x, s, t)
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn((b & d) | (c & ~d), a, b, x, s, t)
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn(b ^ c ^ d, a, b, x, s, t)
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn(c ^ (b | ~d), a, b, x, s, t)

  const toBlocks = (s: string) => {
    const n = s.length
    const blocks: number[] = []
    for (let i = 0; i < n; i++) blocks[i >> 2] = (blocks[i >> 2] || 0) | (s.charCodeAt(i) << ((i % 4) * 8))
    blocks[n >> 2] = (blocks[n >> 2] || 0) | (0x80 << ((n % 4) * 8))
    blocks[(((n + 8) >> 6) * 16) + 14] = n * 8
    for (let i = 0; i < (((n + 8) >> 6) * 16) + 16; i++) blocks[i] = blocks[i] || 0
    return blocks
  }

  const x = toBlocks(input)
  let [a, b, c, d] = [1732584193, -271733879, -1732584194, 271733878]

  for (let i = 0; i < x.length; i += 16) {
    const [oa, ob, oc, od] = [a, b, c, d]
    a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586)
    c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330)
    a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426)
    c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983)
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417)
    c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162)
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101)
    c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329)
    a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632)
    c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302)
    a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083)
    c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848)
    a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690)
    c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501)
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784)
    c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734)
    a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463)
    c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556)
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353)
    c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640)
    a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222)
    c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189)
    a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835)
    c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651)
    a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415)
    c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055)
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606)
    c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799)
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744)
    c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649)
    a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379)
    c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551)
    a = au(a, oa); b = au(b, ob); c = au(c, oc); d = au(d, od)
  }

  const hex = (n: number) => {
    let s = ''
    for (let i = 0; i < 4; i++) s += ((n >> (i * 8 + 4)) & 15).toString(16) + ((n >> (i * 8)) & 15).toString(16)
    return s
  }

  return hex(a) + hex(b) + hex(c) + hex(d)
}

const mailchimp: Adapter = {
  provider: 'mailchimp',
  label: 'Mailchimp',
  fields: {
    apiKey: { label: 'API key', hint: 'Ends with a datacentre suffix, e.g. -us21' },
    listId: { label: 'Audience ID', required: true },
  },

  async verify(connection) {
    const base = mailchimpBase(connection.apiKey)

    if (!base) return { ok: false, error: 'Key is missing its datacentre suffix (e.g. -us21).' }

    const res = await request(`${base}/ping`, {
      headers: { Authorization: `Basic ${btoa(`any:${connection.apiKey}`)}` },
    })

    return { ok: res.ok, status: res.status, error: res.error }
  },

  async lists(connection) {
    const base = mailchimpBase(connection.apiKey)

    if (!base) return { ok: false, error: 'Key is missing its datacentre suffix.' }

    const res = await request(`${base}/lists?count=100`, {
      headers: { Authorization: `Basic ${btoa(`any:${connection.apiKey}`)}` },
    })

    if (!res.ok) return { ok: false, error: res.error }

    const lists = (res.body as { lists?: { id: string; name: string }[] }).lists ?? []

    return { ok: true, lists: lists.map((l) => ({ id: l.id, name: l.name })) }
  },

  async push(connection, subscriber) {
    const base = mailchimpBase(connection.apiKey)

    if (!base) return { ok: false, error: 'Key is missing its datacentre suffix.' }

    const { first, last } = nameParts(subscriber)
    const id = md5(subscriber.email.toLowerCase())

    // PUT upserts, so a re-import updates rather than erroring.
    const res = await request(`${base}/lists/${connection.listId}/members/${id}`, {
      method: 'PUT',
      headers: { ...json, Authorization: `Basic ${btoa(`any:${connection.apiKey}`)}` },
      body: JSON.stringify({
        email_address: subscriber.email,
        status_if_new: 'subscribed',
        merge_fields: { FNAME: first, LNAME: last, ...subscriber.fields },
        tags: subscriber.tags,
      }),
    })

    return { ok: res.ok, status: res.status, error: res.error, providerId: id }
  },
}

// ---------------------------------------------------------------------------
//  Brevo (formerly Sendinblue) — api-key header
// ---------------------------------------------------------------------------

const brevo: Adapter = {
  provider: 'brevo',
  label: 'Brevo',
  fields: {
    apiKey: { label: 'API key', hint: 'SMTP & API → API keys' },
    listId: { label: 'List ID', hint: 'Numeric', required: false },
  },

  async verify(connection) {
    const res = await request('https://api.brevo.com/v3/account', {
      headers: { 'api-key': connection.apiKey },
    })

    return { ok: res.ok, status: res.status, error: res.error }
  },

  async lists(connection) {
    const res = await request('https://api.brevo.com/v3/contacts/lists?limit=50', {
      headers: { 'api-key': connection.apiKey },
    })

    if (!res.ok) return { ok: false, error: res.error }

    const lists = (res.body as { lists?: { id: number; name: string }[] }).lists ?? []

    return { ok: true, lists: lists.map((l) => ({ id: String(l.id), name: l.name })) }
  },

  async push(connection, subscriber) {
    const { first, last } = nameParts(subscriber)

    const res = await request('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { ...json, 'api-key': connection.apiKey },
      body: JSON.stringify({
        email: subscriber.email,
        attributes: { FIRSTNAME: first, LASTNAME: last, SMS: subscriber.phone, ...subscriber.fields },
        listIds: connection.listId ? [Number(connection.listId)] : undefined,
        updateEnabled: true,
      }),
    })

    if (!res.ok && alreadySubscribed(res.status, res.body)) {
      return { ok: true, alreadySubscribed: true, status: res.status }
    }

    return { ok: res.ok, status: res.status, error: res.error }
  },
}

// ---------------------------------------------------------------------------
//  ConvertKit — api_secret in the body, form id as the list
// ---------------------------------------------------------------------------

const convertkit: Adapter = {
  provider: 'convertkit',
  label: 'ConvertKit',
  fields: {
    apiKey: { label: 'API key', hint: 'Settings → Advanced → API' },
    apiSecret: { label: 'API secret' },
    listId: { label: 'Form ID', hint: 'Subscribers are added to this form', required: true },
  },

  async verify(connection) {
    const res = await request(
      `https://api.convertkit.com/v3/account?api_secret=${encodeURIComponent(connection.apiSecret ?? '')}`
    )

    return { ok: res.ok, status: res.status, error: res.error }
  },

  async lists(connection) {
    const res = await request(
      `https://api.convertkit.com/v3/forms?api_key=${encodeURIComponent(connection.apiKey)}`
    )

    if (!res.ok) return { ok: false, error: res.error }

    const forms = (res.body as { forms?: { id: number; name: string }[] }).forms ?? []

    return { ok: true, lists: forms.map((f) => ({ id: String(f.id), name: f.name })) }
  },

  async push(connection, subscriber) {
    const { first } = nameParts(subscriber)

    const res = await request(
      `https://api.convertkit.com/v3/forms/${connection.listId}/subscribe`,
      {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          api_key: connection.apiKey,
          email: subscriber.email,
          first_name: first || undefined,
          tags: subscriber.tags,
          fields: subscriber.fields,
        }),
      }
    )

    return { ok: res.ok, status: res.status, error: res.error }
  },
}

// ---------------------------------------------------------------------------
//  MailerLite — bearer token
// ---------------------------------------------------------------------------

const mailerlite: Adapter = {
  provider: 'mailerlite',
  label: 'MailerLite',
  fields: {
    apiKey: { label: 'API token', hint: 'Integrations → MailerLite API' },
    listId: { label: 'Group ID', required: false },
  },

  async verify(connection) {
    const res = await request('https://connect.mailerlite.com/api/groups?limit=1', {
      headers: { Authorization: `Bearer ${connection.apiKey}`, Accept: 'application/json' },
    })

    return { ok: res.ok, status: res.status, error: res.error }
  },

  async lists(connection) {
    const res = await request('https://connect.mailerlite.com/api/groups?limit=100', {
      headers: { Authorization: `Bearer ${connection.apiKey}`, Accept: 'application/json' },
    })

    if (!res.ok) return { ok: false, error: res.error }

    const data = (res.body as { data?: { id: string; name: string }[] }).data ?? []

    return { ok: true, lists: data.map((g) => ({ id: g.id, name: g.name })) }
  },

  async push(connection, subscriber) {
    const { first, last } = nameParts(subscriber)

    // Upserts by email, so re-imports are safe.
    const res = await request('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: { ...json, Authorization: `Bearer ${connection.apiKey}`, Accept: 'application/json' },
      body: JSON.stringify({
        email: subscriber.email,
        fields: { name: first, last_name: last, phone: subscriber.phone, ...subscriber.fields },
        groups: connection.listId ? [connection.listId] : undefined,
      }),
    })

    return { ok: res.ok, status: res.status, error: res.error }
  },
}

// ---------------------------------------------------------------------------
//  Constant Contact — OAuth2 bearer token
// ---------------------------------------------------------------------------

const constantcontact: Adapter = {
  provider: 'constantcontact',
  label: 'Constant Contact',
  fields: {
    apiKey: { label: 'Access token', hint: 'OAuth2 access token' },
    listId: { label: 'List ID', required: true },
  },

  async verify(connection) {
    const res = await request('https://api.cc.email/v3/account/summary', {
      headers: { Authorization: `Bearer ${connection.apiKey}` },
    })

    return { ok: res.ok, status: res.status, error: res.error }
  },

  async lists(connection) {
    const res = await request('https://api.cc.email/v3/contact_lists?limit=100', {
      headers: { Authorization: `Bearer ${connection.apiKey}` },
    })

    if (!res.ok) return { ok: false, error: res.error }

    const lists = (res.body as { lists?: { list_id: string; name: string }[] }).lists ?? []

    return { ok: true, lists: lists.map((l) => ({ id: l.list_id, name: l.name })) }
  },

  async push(connection, subscriber) {
    const { first, last } = nameParts(subscriber)

    // sign_up_form is the documented upsert endpoint; it tolerates repeats.
    const res = await request('https://api.cc.email/v3/contacts/sign_up_form', {
      method: 'POST',
      headers: { ...json, Authorization: `Bearer ${connection.apiKey}` },
      body: JSON.stringify({
        email_address: subscriber.email,
        first_name: first || undefined,
        last_name: last || undefined,
        list_memberships: connection.listId ? [connection.listId] : undefined,
      }),
    })

    return { ok: res.ok, status: res.status, error: res.error }
  },
}

// ---------------------------------------------------------------------------
//  SendFox — bearer token
// ---------------------------------------------------------------------------

const sendfox: Adapter = {
  provider: 'sendfox',
  label: 'SendFox',
  fields: {
    apiKey: { label: 'Access token', hint: 'Account → API' },
    listId: { label: 'List ID', required: false },
  },

  async verify(connection) {
    const res = await request('https://api.sendfox.com/me', {
      headers: { Authorization: `Bearer ${connection.apiKey}` },
    })

    return { ok: res.ok, status: res.status, error: res.error }
  },

  async lists(connection) {
    const res = await request('https://api.sendfox.com/lists', {
      headers: { Authorization: `Bearer ${connection.apiKey}` },
    })

    if (!res.ok) return { ok: false, error: res.error }

    const data = (res.body as { data?: { id: number; name: string }[] }).data ?? []

    return { ok: true, lists: data.map((l) => ({ id: String(l.id), name: l.name })) }
  },

  async push(connection, subscriber) {
    const { first, last } = nameParts(subscriber)

    const res = await request('https://api.sendfox.com/contacts', {
      method: 'POST',
      headers: { ...json, Authorization: `Bearer ${connection.apiKey}` },
      body: JSON.stringify({
        email: subscriber.email,
        first_name: first || undefined,
        last_name: last || undefined,
        lists: connection.listId ? [Number(connection.listId)] : undefined,
      }),
    })

    if (!res.ok && alreadySubscribed(res.status, res.body)) {
      return { ok: true, alreadySubscribed: true, status: res.status }
    }

    return { ok: res.ok, status: res.status, error: res.error }
  },
}

// ---------------------------------------------------------------------------

export const ADAPTERS: Record<string, Adapter> = {
  getresponse,
  emailoctopus,
  aweber,
  mailchimp,
  brevo,
  convertkit,
  mailerlite,
  constantcontact,
  sendfox,
}

export function getAdapter(provider: string): Adapter | undefined {
  return ADAPTERS[provider]
}

export const ADAPTER_LIST = Object.values(ADAPTERS)

/** Fan one lead out to every enabled connection, reporting each separately. */
export async function pushToAll(
  connections: (Connection & { id: string })[],
  subscriber: Subscriber
): Promise<{ connectionId: string; result: PushResult }[]> {
  return Promise.all(
    connections.map(async (connection) => {
      const adapter = getAdapter(connection.provider)

      if (!adapter) {
        return {
          connectionId: connection.id,
          result: { ok: false, error: `No adapter for ${connection.provider}` },
        }
      }

      try {
        return { connectionId: connection.id, result: await adapter.push(connection, subscriber) }
      } catch (error) {
        // One provider failing must not stop the rest.
        return {
          connectionId: connection.id,
          result: { ok: false, error: error instanceof Error ? error.message : String(error) },
        }
      }
    })
  )
}

export type { ListSummary }
