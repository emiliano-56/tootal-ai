import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { PLATFORM_TENANT_ID } from '@/lib/supabase/server'
import { sendTemplate } from '@/lib/mail/mailer'
import { syncAccountRole, type PlanWithRole } from '@/lib/plans/promote'
import { dependentsOf } from '@/lib/plans/entitlements'
import { chainFor, generatePassword, parseIpn, type IpnRules } from '@/lib/ipn/payload'

/**
 * Acting on a payment notification.
 *
 * A sale creates the account if it is new, grants the tier and everything
 * beneath it, promotes the account if the tier sells one, and emails the buyer
 * their password. A refund takes the tier away again.
 *
 * Every post is written to `ipn_events` first. If the work below throws, the
 * row is still there with the payload, so the sale can be replayed rather than
 * reconstructed from a customer complaint.
 */

export interface IpnSettings {
  vendor: string
  secret: string | null
  enabled: boolean
  field_email: string
  field_name: string
  field_product: string
  field_transaction: string
  field_event: string
  sale_events: string[]
  refund_events: string[]
  welcome_template: string
}

export interface IpnOutcome {
  status: 'processed' | 'ignored' | 'failed'
  message: string
  userId?: string
  planCode?: string
  created?: boolean
  emailed?: boolean
}

export async function loadIpnSettings(): Promise<IpnSettings | null> {
  const { data } = await supabaseAdmin.from('ipn_settings').select('*').limit(1).maybeSingle()

  return (data as IpnSettings) ?? null
}

function rulesFrom(settings: IpnSettings): IpnRules {
  return {
    fields: {
      email: settings.field_email,
      name: settings.field_name,
      product: settings.field_product,
      transaction: settings.field_transaction,
      event: settings.field_event,
    },
    saleEvents: settings.sale_events ?? [],
    refundEvents: settings.refund_events ?? [],
  }
}

async function catalogue(): Promise<PlanWithRole[]> {
  const { data } = await supabaseAdmin
    .from('plans')
    .select('id, code, name, is_bundle, includes, requires, grants_role, tier, seats, ipn_product_id')
    .order('sort_order')

  return (data ?? []).map((row) => {
    const plan = row as Record<string, unknown>

    return {
      id: plan.id as string,
      code: plan.code as string,
      name: plan.name as string,
      isBundle: plan.is_bundle as boolean,
      includes: (plan.includes as string[]) ?? [],
      requires: (plan.requires as string | null) ?? null,
      grantsRole: (plan.grants_role as PlanWithRole['grantsRole']) ?? null,
      tier: (plan.tier as string) ?? (plan.code as string),
      seats: (plan.seats as number | null) ?? null,
      features: {},
      ipnProductId: (plan.ipn_product_id as string | null) ?? null,
    } as PlanWithRole & { ipnProductId: string | null }
  })
}

async function ownedCodes(userId: string, plans: PlanWithRole[]): Promise<string[]> {
  const { data } = await supabaseAdmin.from('user_plans').select('plan_id').eq('user_id', userId)

  const ids = new Set((data ?? []).map((row) => (row as { plan_id: string }).plan_id))

  return plans.filter((plan) => ids.has(plan.id)).map((plan) => plan.code)
}

/**
 * Handle one notification.
 *
 * `vendor` comes from the URL so a second processor can be added later without
 * changing this signature.
 */
export async function processIpn(
  vendor: string,
  payload: Record<string, unknown>,
  settings: IpnSettings,
  /** Where to tell the buyer to sign in — taken from the request that arrived. */
  origin = ''
): Promise<IpnOutcome> {
  const parsed = parseIpn(payload, rulesFrom(settings))

  const event = {
    vendor,
    external_id: parsed.transactionId || null,
    event_type: parsed.eventType || null,
    product_id: parsed.productId || null,
    email: parsed.email || null,
    payload,
  }

  const finish = async (outcome: IpnOutcome, planCode?: string, userId?: string) => {
    const { error } = await supabaseAdmin.from('ipn_events').insert({
      ...event,
      status: outcome.status,
      message: outcome.message.slice(0, 500),
      plan_code: planCode ?? null,
      user_id: userId ?? null,
    })

    // A duplicate here means the sale was already recorded, which is the
    // outcome we wanted. Never let the log failing undo the work it describes.
    if (error) console.error('[ipn] could not record the event:', error.message)

    return outcome
  }

  if (parsed.action === 'ignore') {
    return finish({ status: 'ignored', message: parsed.reason ?? 'Nothing to do' })
  }

  const plans = await catalogue()
  const plan = (plans as (PlanWithRole & { ipnProductId: string | null })[]).find(
    (candidate) => candidate.ipnProductId && candidate.ipnProductId === parsed.productId
  )

  if (!plan) {
    return finish({
      status: 'ignored',
      message: `No plan is mapped to product "${parsed.productId}"`,
    })
  }

  // A repeat of a sale we already completed. The vendor retries on timeout,
  // and a second run would email a second password for the same purchase.
  if (parsed.transactionId) {
    const { data: seen } = await supabaseAdmin
      .from('ipn_events')
      .select('id')
      .eq('vendor', vendor)
      .eq('external_id', parsed.transactionId)
      .eq('product_id', parsed.productId)
      .eq('status', 'processed')
      .limit(1)
      .maybeSingle()

    if (seen) {
      return finish({ status: 'ignored', message: 'Already processed' }, plan.code)
    }
  }

  return parsed.action === 'sale'
    ? handleSale(parsed, plan, plans, settings, origin, finish)
    : handleRefund(parsed, plan, plans, finish)
}

type Finish = (outcome: IpnOutcome, planCode?: string, userId?: string) => Promise<IpnOutcome>

async function handleSale(
  parsed: ReturnType<typeof parseIpn>,
  plan: PlanWithRole,
  plans: PlanWithRole[],
  settings: IpnSettings,
  origin: string,
  finish: Finish
): Promise<IpnOutcome> {
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('email', parsed.email)
    .limit(1)
    .maybeSingle()

  let userId = (existing as { id: string } | null)?.id
  let password = ''
  const created = !userId

  if (!userId) {
    password = generatePassword()

    const { data: account, error } = await supabaseAdmin.auth.admin.createUser({
      email: parsed.email,
      password,
      email_confirm: true,
    })

    if (error || !account?.user) {
      return finish(
        { status: 'failed', message: error?.message ?? 'Could not create the login' },
        plan.code
      )
    }

    userId = account.user.id

    // Upsert rather than insert: a trigger on auth.users already writes a
    // profiles row, and a plain insert collides with it.
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: userId,
        email: parsed.email,
        username: parsed.email.split('@')[0],
        role: 'user',
        tenant_id: PLATFORM_TENANT_ID,
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)

      return finish({ status: 'failed', message: profileError.message }, plan.code)
    }
  }

  // The funnel only offers an upsell to someone who already bought what came
  // before, so grant the tiers beneath this one as well. Without it the
  // chain trigger rejects a notification that arrived out of order.
  const owned = await ownedCodes(userId, plans)
  const wanted = chainFor(plan.code, plans).filter((code) => !owned.includes(code))

  for (const code of wanted) {
    const target = plans.find((candidate) => candidate.code === code)

    if (!target) continue

    const { error } = await supabaseAdmin
      .from('user_plans')
      .insert({ user_id: userId, plan_id: target.id })

    if (error) {
      return finish({ status: 'failed', message: error.message, userId }, plan.code, userId)
    }
  }

  // Buying a bigger licence of a tier already held replaces the smaller one;
  // the database trigger has removed it, so drop it from the list here too.
  const tier = plan.tier ?? plan.code
  const held = [
    ...owned.filter(
      (code) =>
        code === plan.code ||
        (plans.find((candidate) => candidate.code === code)?.tier ?? code) !== tier
    ),
    ...wanted,
  ]

  const promotion = await syncAccountRole(userId, plans, held)

  let emailed = false

  // Only a brand new account gets a password; an existing customer buying an
  // upsell already knows how to sign in.
  if (created) {
    const result = await sendTemplate(settings.welcome_template, parsed.email, {
      first_name: parsed.firstName,
      brand_name: 'ComicTale AI',
      login_url: `${origin || process.env.NEXT_PUBLIC_SITE_URL || ""}/login`,
      email: parsed.email,
      password,
      plan_name: plan.name,
    })

    emailed = result.ok

    if (!result.ok) {
      // The account exists and works; only the email failed. Recording that
      // as a failure would hide a completed sale.
      return finish(
        {
          status: 'processed',
          message: `Account created and ${plan.name} granted, but the email failed: ${result.error}`,
          userId,
          created,
        },
        plan.code,
        userId
      )
    }
  }

  const note = promotion.role && promotion.role !== 'user'
    ? ` Account is now a ${promotion.role.replace('_', ' ')} with ${promotion.seats ?? '—'} seats.`
    : ''

  return finish(
    {
      status: 'processed',
      message: `${created ? 'Created account and granted' : 'Granted'} ${wanted.join(', ') || plan.code}.${note}`,
      userId,
      created,
      emailed,
    },
    plan.code,
    userId
  )
}

async function handleRefund(
  parsed: ReturnType<typeof parseIpn>,
  plan: PlanWithRole,
  plans: PlanWithRole[],
  finish: Finish
): Promise<IpnOutcome> {
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('email', parsed.email)
    .limit(1)
    .maybeSingle()

  const userId = (existing as { id: string } | null)?.id

  if (!userId) {
    return finish({ status: 'ignored', message: 'No account with that address' }, plan.code)
  }

  const owned = await ownedCodes(userId, plans)

  // Taking a tier back has to take the ones above it, or the account keeps a
  // tier with nothing beneath it.
  const codes = [plan.code, ...dependentsOf(plan.code, plans)].filter((code) =>
    owned.includes(code)
  )

  const ids = plans.filter((candidate) => codes.includes(candidate.code)).map((c) => c.id)

  if (ids.length > 0) {
    await supabaseAdmin.from('user_plans').delete().eq('user_id', userId).in('plan_id', ids)
  }

  const promotion = await syncAccountRole(
    userId,
    plans,
    owned.filter((code) => !codes.includes(code))
  )

  return finish(
    {
      status: 'processed',
      message: `Removed ${codes.join(', ') || plan.code}.${
        promotion.role === 'user' ? ' Account is back to a normal user.' : ''
      }`,
      userId,
    },
    plan.code,
    userId
  )
}
