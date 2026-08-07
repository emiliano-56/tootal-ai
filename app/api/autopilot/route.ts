import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireFeature } from '@/lib/plans/gate'
import { nextRunAt, FREQUENCIES, type Frequency } from '@/lib/autopilot/schedule'
import { runCampaign, refillIdeas, type Campaign } from '@/lib/autopilot/engine'
import { tenantSiteUrl } from '@/lib/settings/site-url.server'

/**
 * Autopilot campaigns.
 *
 * Behind OTO 3. Every write re-reads the campaign and checks it belongs to the
 * caller: this route holds the service-role client, which RLS does not apply
 * to, so ownership has to be proved here rather than assumed.
 */

const FREQUENCY_VALUES = FREQUENCIES.map((entry) => entry.value)

/**
 * Narrow a list of connection ids to the ones this account actually owns.
 *
 * A campaign posts through whatever is in this column, so accepting it from
 * the request unchecked would let anyone publish to a stranger's Facebook Page
 * by pasting its id.
 */
async function ownedConnectionIds(userId: string, requested: unknown): Promise<string[]> {
  if (!Array.isArray(requested) || requested.length === 0) return []

  const { data } = await supabaseAdmin
    .from('social_connections')
    .select('id')
    .eq('user_id', userId)
    .neq('status', 'revoked')
    .in('id', requested.map(String).slice(0, 12))

  return ((data ?? []) as { id: string }[]).map((row) => row.id)
}

async function ownedCampaign(id: string, userId: string, role: string) {
  const { data } = await supabaseAdmin
    .from('autopilot_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!data) return null

  const campaign = data as Campaign

  if (campaign.user_id !== userId && role !== 'superadmin') return null

  return campaign
}

export async function GET(request: NextRequest) {
  const gate = await requireFeature('autopilot')

  if ('error' in gate) return gate.error

  const campaignId = request.nextUrl.searchParams.get('campaign')

  if (campaignId) {
    const campaign = await ownedCampaign(campaignId, gate.session.userId, gate.session.role)

    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [{ data: runs }, { data: ideas }] = await Promise.all([
      supabaseAdmin
        .from('autopilot_runs')
        .select('id, title, status, scheduled_for, started_at, finished_at, delivered_to, error, project_id')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('autopilot_ideas')
        .select('id, title, hook, angle, score, status')
        .eq('campaign_id', campaignId)
        .eq('status', 'new')
        .order('score', { ascending: false })
        .limit(20),
    ])

    return NextResponse.json({ campaign, runs: runs ?? [], ideas: ideas ?? [] })
  }

  const { data: campaigns } = await supabaseAdmin
    .from('autopilot_campaigns')
    .select('*')
    .eq('user_id', gate.session.userId)
    .order('created_at', { ascending: false })

  const { data: recent } = await supabaseAdmin
    .from('autopilot_runs')
    .select('id, campaign_id, title, status, finished_at')
    .eq('user_id', gate.session.userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ campaigns: campaigns ?? [], recent: recent ?? [] })
}

export async function POST(request: NextRequest) {
  const gate = await requireFeature('autopilot')

  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)

  if (!body?.action) return NextResponse.json({ error: 'action is required' }, { status: 400 })

  // ---- create
  if (body.action === 'create') {
    const name = String(body.name ?? '').trim()
    const niche = String(body.niche ?? '').trim()

    if (!name || !niche) {
      return NextResponse.json({ error: 'A name and a niche are required' }, { status: 400 })
    }

    const frequency = (
      FREQUENCY_VALUES.includes(body.frequency) ? body.frequency : 'daily'
    ) as Frequency

    const timezone = String(body.timezone ?? 'UTC')
    const publishHour = Math.min(23, Math.max(0, Number(body.publishHour) || 9))

    const { data, error } = await supabaseAdmin
      .from('autopilot_campaigns')
      .insert({
        user_id: gate.session.userId,
        tenant_id: gate.session.tenantId,
        name: name.slice(0, 120),
        niche: niche.slice(0, 200),
        audience: String(body.audience ?? 'Children aged 4-8').slice(0, 200),
        art_style: String(body.artStyle ?? 'Pixar 3D').slice(0, 120),
        tone: String(body.tone ?? 'Warm and playful').slice(0, 120),
        // One episode per run. A run is a single serverless invocation and
        // writing several would risk timing out halfway, leaving a part-built
        // row. Accepting a larger number here would only make the "N a month"
        // figure on the campaign card untrue.
        episodes_per_run: 1,
        frequency,
        publish_hour: publishHour,
        timezone,
        platforms: Array.isArray(body.platforms) ? body.platforms.slice(0, 8) : [],
        connection_ids: await ownedConnectionIds(gate.session.userId, body.connectionIds),
        webhook_url: String(body.webhookUrl ?? '').trim() || null,
        deliver_email: String(body.deliverEmail ?? '').trim() || null,
        status: body.status === 'draft' ? 'draft' : 'active',
        next_run_at: nextRunAt({ frequency, publishHour, timezone }).toISOString(),
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, campaign: data })
  }

  const campaign = await ownedCampaign(
    String(body.id ?? ''),
    gate.session.userId,
    gate.session.role
  )

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ---- pause and resume
  if (body.action === 'pause' || body.action === 'resume') {
    const status = body.action === 'pause' ? 'paused' : 'active'

    await supabaseAdmin
      .from('autopilot_campaigns')
      .update({
        status,
        // Resuming schedules the next slot from now rather than firing every
        // slot missed while it was paused.
        next_run_at:
          status === 'active'
            ? nextRunAt({
                frequency: campaign.frequency,
                publishHour: campaign.publish_hour,
                timezone: campaign.timezone,
                startedAt: new Date(campaign.created_at),
              }).toISOString()
            : campaign.next_run_at,
      })
      .eq('id', campaign.id)

    return NextResponse.json({ ok: true, status })
  }

  // ---- edit
  if (body.action === 'update') {
    const patch: Record<string, unknown> = {}

    const text: [string, string, number][] = [
      ['name', 'name', 120],
      ['niche', 'niche', 200],
      ['audience', 'audience', 200],
      ['artStyle', 'art_style', 120],
      ['tone', 'tone', 120],
    ]

    for (const [from, column, max] of text) {
      if (typeof body[from] === 'string' && body[from].trim()) {
        patch[column] = body[from].trim().slice(0, max)
      }
    }

    if (FREQUENCY_VALUES.includes(body.frequency)) patch.frequency = body.frequency
    if (body.publishHour !== undefined) {
      patch.publish_hour = Math.min(23, Math.max(0, Number(body.publishHour) || 0))
    }
    if (typeof body.timezone === 'string' && body.timezone) patch.timezone = body.timezone
    if (Array.isArray(body.platforms)) patch.platforms = body.platforms.slice(0, 8)
    if (Array.isArray(body.connectionIds)) {
      patch.connection_ids = await ownedConnectionIds(gate.session.userId, body.connectionIds)
    }
    if (typeof body.webhookUrl === 'string') patch.webhook_url = body.webhookUrl.trim() || null
    if (typeof body.deliverEmail === 'string') patch.deliver_email = body.deliverEmail.trim() || null


    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
    }

    // Any change to the timing moves the next slot, or an edit would not take
    // effect until after one more run at the old time.
    if ('frequency' in patch || 'publish_hour' in patch || 'timezone' in patch) {
      patch.next_run_at = nextRunAt({
        frequency: (patch.frequency as Frequency) ?? campaign.frequency,
        publishHour: (patch.publish_hour as number) ?? campaign.publish_hour,
        timezone: (patch.timezone as string) ?? campaign.timezone,
        startedAt: new Date(campaign.created_at),
      }).toISOString()
    }

    const { error } = await supabaseAdmin
      .from('autopilot_campaigns')
      .update(patch)
      .eq('id', campaign.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  }

  // ---- run now
  if (body.action === 'run') {
    const result = await runCampaign(campaign, await tenantSiteUrl(campaign.tenant_id, request.nextUrl.origin))

    return NextResponse.json({ ok: result.status === 'done', result })
  }

  // ---- top up the idea queue
  if (body.action === 'ideas') {
    try {
      const added = await refillIdeas(campaign, Math.min(10, Number(body.count) || 6))

      return NextResponse.json({ ok: true, added })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Could not think of any' },
        { status: 502 }
      )
    }
  }

  // ---- dismiss one idea
  if (body.action === 'dismiss') {
    await supabaseAdmin
      .from('autopilot_ideas')
      .update({ status: 'dismissed' })
      .eq('id', body.ideaId)
      .eq('campaign_id', campaign.id)

    return NextResponse.json({ ok: true })
  }

  if (body.action === 'delete') {
    await supabaseAdmin.from('autopilot_campaigns').delete().eq('id', campaign.id)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export const dynamic = 'force-dynamic'

// A run writes an episode and draws its cover; the drawing alone measures
// 48-64 seconds against the live backend. The default function timeout would
// cut 'Run now' off partway and leave a half-written row.
export const maxDuration = 300
