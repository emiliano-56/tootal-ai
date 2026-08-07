import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireFeature } from '@/lib/plans/gate'

/**
 * The Done For You library.
 *
 * Everything here belongs to OTO 2, so the gate runs before a single row is
 * read. Without `?niche=` the response is the ten pack summaries; with it, the
 * full contents of one pack.
 *
 * Bodies are large — a website is 4 KB of HTML — so the index deliberately
 * leaves them out. Sending all ninety would be most of a megabyte to draw ten
 * cards.
 */

export async function GET(request: NextRequest) {
  const gate = await requireFeature('dfy-business')

  if ('error' in gate) return gate.error

  const slug = request.nextUrl.searchParams.get('niche')

  const { data: niches, error } = await supabaseAdmin
    .from('dfy_niches')
    .select('id, slug, name, tagline, description, audience, emoji, colour_from, colour_to, keywords')
    .eq('active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const list = (niches ?? []) as Record<string, unknown>[]

  const shaped = list.map((niche) => ({
    id: niche.id as string,
    slug: niche.slug as string,
    name: niche.name as string,
    tagline: niche.tagline as string,
    description: niche.description as string,
    audience: niche.audience as string,
    emoji: niche.emoji as string,
    colourFrom: niche.colour_from as string,
    colourTo: niche.colour_to as string,
    keywords: (niche.keywords as string[]) ?? [],
  }))

  // ---- one pack, in full
  if (slug) {
    const niche = shaped.find((entry) => entry.slug === slug)

    if (!niche) return NextResponse.json({ error: 'No such pack' }, { status: 404 })

    const { data: assets } = await supabaseAdmin
      .from('dfy_assets')
      .select('id, kind, title, summary, body, prompt, tool, meta, marketplaces, sort_order')
      .eq('niche_id', niche.id)
      .order('sort_order')

    return NextResponse.json({
      niche,
      assets: ((assets ?? []) as Record<string, unknown>[]).map((asset) => ({
        id: asset.id as string,
        kind: asset.kind as string,
        title: asset.title as string,
        summary: asset.summary as string,
        body: asset.body as string,
        prompt: (asset.prompt as string | null) ?? null,
        tool: (asset.tool as string | null) ?? null,
        meta: (asset.meta as Record<string, unknown>) ?? {},
        marketplaces: (asset.marketplaces as string[]) ?? [],
        sortOrder: (asset.sort_order as number) ?? 0,
      })),
    })
  }

  // ---- the index: counts only, so the page stays small
  const { data: counts } = await supabaseAdmin
    .from('dfy_assets')
    .select('niche_id, kind, marketplaces')

  const byNiche = new Map<string, { kinds: Set<string>; marketplaces: Set<string>; total: number }>()

  for (const row of ((counts ?? []) as { niche_id: string; kind: string; marketplaces: string[] }[])) {
    const entry = byNiche.get(row.niche_id) ?? {
      kinds: new Set<string>(),
      marketplaces: new Set<string>(),
      total: 0,
    }

    entry.kinds.add(row.kind)
    for (const id of row.marketplaces ?? []) entry.marketplaces.add(id)
    entry.total += 1

    byNiche.set(row.niche_id, entry)
  }

  return NextResponse.json({
    niches: shaped.map((niche) => {
      const entry = byNiche.get(niche.id)

      return {
        ...niche,
        assetCount: entry?.total ?? 0,
        kinds: [...(entry?.kinds ?? [])],
        marketplaces: [...(entry?.marketplaces ?? [])],
      }
    }),
  })
}

export const dynamic = 'force-dynamic'
