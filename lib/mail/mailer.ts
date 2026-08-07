import 'server-only'

import nodemailer, { type Transporter } from 'nodemailer'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { renderTemplate, htmlToText } from '@/lib/services/templates'

/**
 * Outbound mail.
 *
 * Servers come from `smtp_accounts`, managed in the console, so credentials
 * are rotated without a redeploy. The primary is tried first and a backup
 * takes over when it fails — a bounced password reset is worse than a slow one.
 *
 * Reads use the service-role client on purpose: RLS hides SMTP passwords from
 * everyone below superadmin, and sending happens on behalf of users who must
 * never see them.
 */

export interface SmtpAccount {
  id: string
  label: string
  host: string
  port: number
  username: string
  password: string
  from_email: string
  from_name: string | null
  secure: boolean
  is_primary: boolean
  is_backup: boolean
}

export interface SendResult {
  ok: boolean
  accountId?: string
  messageId?: string
  error?: string
}

export class MailError extends Error {}

/** Ordered list of servers to try for one send. */
export async function resolveSmtpAccounts(tenantId?: string | null): Promise<SmtpAccount[]> {
  let query = supabaseAdmin.from('smtp_accounts').select('*').eq('enabled', true)

  // A tenant's own server first; otherwise the platform default (null tenant).
  query = tenantId ? query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`) : query.is('tenant_id', null)

  const { data, error } = await query

  if (error) {
    console.error('[mail] smtp lookup failed:', error.message)
    return []
  }

  const accounts = (data as SmtpAccount[]) ?? []

  // Primary, then backup, then anything else. Stable inside each group.
  return accounts.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
}

function rank(account: SmtpAccount): number {
  if (account.is_primary) return 0
  if (account.is_backup) return 1

  return 2
}

function transportFor(account: SmtpAccount): Transporter {
  return nodemailer.createTransport({
    host: account.host,
    port: account.port,
    // Port 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: account.secure && account.port === 465,
    requireTLS: account.secure && account.port !== 465,
    auth: { user: account.username, pass: account.password },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
  })
}

export interface SendOptions {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  tenantId?: string | null
}

/** Send one message, falling through the server list on failure. */
export async function sendMail(options: SendOptions): Promise<SendResult> {
  const accounts = await resolveSmtpAccounts(options.tenantId)

  if (accounts.length === 0) {
    return { ok: false, error: 'No mail server configured. Add one under SMTP.' }
  }

  let lastError = 'Send failed'

  for (const account of accounts) {
    try {
      const info = await transportFor(account).sendMail({
        from: account.from_name
          ? `"${account.from_name}" <${account.from_email}>`
          : account.from_email,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text ?? htmlToText(options.html),
        replyTo: options.replyTo,
      })

      await supabaseAdmin
        .from('smtp_accounts')
        .update({ last_tested_at: new Date().toISOString(), last_test_ok: true, last_error: null })
        .eq('id', account.id)

      return { ok: true, accountId: account.id, messageId: info.messageId }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)

      await supabaseAdmin
        .from('smtp_accounts')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_ok: false,
          last_error: lastError.slice(0, 500),
        })
        .eq('id', account.id)
    }
  }

  return { ok: false, error: lastError }
}

/**
 * Send a stored template.
 *
 * Values are escaped by renderTemplate, so a name taken from a lead import
 * cannot inject markup into the message.
 */
export async function sendTemplate(
  key: string,
  to: string,
  context: Record<string, string | number | null | undefined>,
  tenantId?: string | null
): Promise<SendResult> {
  const { data } = await supabaseAdmin
    .from('email_templates')
    .select('subject, body_html, enabled')
    // The tenant's override wins over the platform default.
    .eq('key', key)
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .order('tenant_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { ok: false, error: `No template named "${key}".` }
  if (data.enabled === false) return { ok: false, error: `Template "${key}" is disabled.` }

  // Subject is plain text, so escaping it would show &amp; to the recipient.
  const subject = renderTemplate(data.subject as string, context, { escape: false })
  const body = renderTemplate(data.body_html as string, context)

  return sendMail({ to, subject: subject.output, html: body.output, tenantId })
}

/** Verify a server can actually connect and authenticate. */
export async function verifySmtp(accountId: string): Promise<SendResult> {
  const { data } = await supabaseAdmin
    .from('smtp_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle()

  if (!data) return { ok: false, error: 'Server not found.' }

  const account = data as SmtpAccount

  try {
    await transportFor(account).verify()

    await supabaseAdmin
      .from('smtp_accounts')
      .update({ last_tested_at: new Date().toISOString(), last_test_ok: true, last_error: null })
      .eq('id', accountId)

    return { ok: true, accountId }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await supabaseAdmin
      .from('smtp_accounts')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_ok: false,
        last_error: message.slice(0, 500),
      })
      .eq('id', accountId)

    return { ok: false, error: message }
  }
}
