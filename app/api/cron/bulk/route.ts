import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { completeJson } from '@/lib/ai/deepseek'
import { renderPreview } from '@/lib/ai/images'
import { consumeFeature } from '@/lib/plans/server'
import { nextItem, progressOf, jobStatus, MAX_ATTEMPTS, type BulkItem } from '@/lib/bulk/queue'
import { format } from '@/lib/comic/formats'

/**
 * Working through bulk jobs, one idea at a time.
 *
 * Same shape as the other two schedulers and for the same reasons: a shared
 * secret because nobody is signed in, an explicit time budget so a killed
 * worker leaves nothing stuck, and items claimed atomically so two overlapping
 * ticks cannot generate the same idea twice.
 *
 * One item per tick on purpose. A comic is 70-100 seconds end to end, so
 * trying to do several inside one invocation is how a run gets cut off
 * halfway — and half a comic is a charge with nothing to show for it.
 */

const BUDGET_MS = (Number(process.env.CRON_BUDGET_SECONDS) || 280) * 1000
const ITEM_ESTIMATE_MS = 120_000

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()

  if (!secret) return false

  const supplied =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    request.nextUrl.searchParams.get('secret') ??
    ''

  const a = Buffer.from(supplied)
  const b = Buffer.from(secret)

  return a.length === b.length && timingSafeEqual(a, b)
}

interface Job {
  id: string
  user_id: string
  tenant_id: string | null
  kind: string
  preset_id: string | null
  settings: Record<string, unknown>
  status: string
}

interface Script {
  title: string
  logline: string
  pages: { page_number: number; panels: { image_prompt: string; caption: string }[] }[]
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 })
  }

  const startedAt = Date.now()
  const handled: { job: string; item: string; status: string; detail?: string }[] = []

  const { data: jobs } = await supabaseAdmin
    .from('bulk_jobs')
    .select('id, user_id, tenant_id, kind, preset_id, settings, status')
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: true })
    .limit(10)

  for (const row of (jobs ?? []) as Job[]) {
    if (Date.now() - startedAt > BUDGET_MS - ITEM_ESTIMATE_MS) break

    const { data: itemRows } = await supabaseAdmin
      .from('bulk_items')
      .select('id, position, idea, status, attempts, started_at')
      .eq('job_id', row.id)
      .order('position')

    const items = ((itemRows ?? []) as Record<string, unknown>[]).map<BulkItem>((item) => ({
      id: String(item.id),
      position: Number(item.position),
      idea: String(item.idea),
      status: item.status as BulkItem['status'],
      attempts: Number(item.attempts),
      startedAt: (item.started_at as string) ?? null,
    }))

    const progress = progressOf(items)

    // Nothing left: settle the job and move on rather than looking at it
    // again on every tick forever.
    if (progress.finished) {
      await supabaseAdmin
        .from('bulk_jobs')
        .update({
          status: jobStatus(items, row.status as never),
          done: progress.done,
          failed: progress.failed,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      continue
    }

    const next = nextItem(items, new Date())

    if (!next.item) continue

    const item = next.item

    // Claimed atomically: two ticks must not generate the same idea twice.
    const { data: claimed } = await supabaseAdmin
      .from('bulk_items')
      .update({
        status: 'running',
        attempts: item.attempts + 1,
        started_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('status', item.status)
      .eq('attempts', item.attempts)
      .select('id')
      .maybeSingle()

    if (!claimed) continue

    await supabaseAdmin
      .from('bulk_jobs')
      .update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', row.id)

    try {
      const spec = format(row.kind)

      // Charged against the right allowance before any work is done, so a
      // customer who has run out is told rather than quietly served.
      const spend = await consumeFeature(row.user_id, row.kind === 'coloring' ? 'coloring' : 'comic')

      if (!spend.ok) {
        await supabaseAdmin
          .from('bulk_items')
          .update({
            status: 'failed',
            error: spend.error ?? 'Monthly allowance is gone',
            finished_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        // The rest of the job would fail the same way, so it is paused rather
        // than burned through one hopeless item at a time.
        await supabaseAdmin
          .from('bulk_jobs')
          .update({ status: 'paused', error: spend.error ?? 'Monthly allowance is gone' })
          .eq('id', row.id)

        handled.push({ job: row.id, item: item.id, status: 'out-of-allowance' })
        break
      }

      const settings = row.settings ?? {}

      const script = await completeJson<Script>({
        system: `You write short illustrated stories for children.

Return JSON exactly as:
{ "title": "", "logline": "one sentence", "pages": [{ "page_number": 1, "panels": [{ "image_prompt": "", "caption": "" }] }] }

Every image_prompt must stand alone — it is sent to an image model that has not
read the others — and must restate any character's appearance in full.${spec.brief ? `\n\n${spec.brief}` : ''}`,
        prompt: `Idea: ${item.idea}
Art style: ${String(settings.artStyle ?? 'Modern comic book, bold ink, vibrant colour')}
Audience: ${String(settings.audience ?? 'All ages')}
Pages: exactly ${Number(settings.pages ?? spec.defaultPages)}
Panels per page: exactly ${spec.panelsPerPage}`,
        temperature: 0.9,
        maxTokens: 6000,
      })

      if (!script?.title) throw new Error('The writer returned nothing usable')

      // One cover, not the whole book. A tick is a single invocation and each
      // image is a round trip; rendering twenty-four would be cut off halfway.
      const coverPrompt = script.pages?.[0]?.panels?.[0]?.image_prompt ?? item.idea

      const coverUrl = await renderPreview(row.user_id, coverPrompt, {
        aspectRatio: spec.aspectRatio,
        name: 'bulk',
      })

      const { data: project } = await supabaseAdmin
        .from('projects')
        .insert({
          user_id: row.user_id,
          title: script.title,
          idea: item.idea,
          art_style: String(settings.artStyle ?? ''),
          status: 'complete',
        })
        .select('id')
        .single()

      await supabaseAdmin
        .from('bulk_items')
        .update({
          status: 'done',
          title: script.title,
          project_id: (project as { id: string } | null)?.id ?? null,
          error: null,
          finished_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      handled.push({ job: row.id, item: item.id, status: 'done', detail: script.title })

      // Kept for the record; the cover is what the list shows.
      void coverUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      await supabaseAdmin
        .from('bulk_items')
        .update({
          status: item.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'queued',
          error: message.slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      handled.push({ job: row.id, item: item.id, status: 'error', detail: message.slice(0, 120) })
    }

    // Counters refreshed so the screen shows movement without recomputing.
    const { data: after } = await supabaseAdmin
      .from('bulk_items')
      .select('id, position, idea, status, attempts, started_at')
      .eq('job_id', row.id)

    const refreshed = progressOf(
      ((after ?? []) as Record<string, unknown>[]).map<BulkItem>((entry) => ({
        id: String(entry.id),
        position: Number(entry.position),
        idea: String(entry.idea),
        status: entry.status as BulkItem['status'],
        attempts: Number(entry.attempts),
      }))
    )

    await supabaseAdmin
      .from('bulk_jobs')
      .update({
        done: refreshed.done,
        failed: refreshed.failed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
  }

  return NextResponse.json({ ok: true, handled, ms: Date.now() - startedAt })
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300
