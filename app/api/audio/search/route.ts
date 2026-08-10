import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { creditLine, checkTrack, rankTracks, type Track, type UseCase } from '@/lib/audio/licences'

/**
 * Finding music a customer can legally publish.
 *
 * Openverse is the default because it needs no key at all — the feature works
 * the day the migration runs, rather than after somebody registers for a
 * developer account. It also aggregates Jamendo, ccMixter, Wikimedia and
 * Freesound, so it covers a lot on its own. Jamendo direct is the better
 * catalogue and switches on when the platform owner adds a free client id.
 *
 * Pixabay used to be here and has been removed. Their public API documents
 * images and videos only — there is no music endpoint — so the search was
 * hitting `pixabay.com/api/`, the *image* endpoint, and would have listed
 * photographs as tracks with a JPEG as the audio URL. Pexels is the same:
 * photos and videos, no music. Neither can be fixed with a key, which is why
 * migration 021 deletes the row rather than disabling it.
 *
 * Every result carries its licence and, where one is required, the exact
 * credit line. Searching without that would be handing customers a copyright
 * strike with a search box attached.
 */

interface Provider {
  provider: string
  api_key: string | null
  enabled: boolean
}

/** Openverse needs no key, so it is the floor rather than a configured option. */
const OPENVERSE: Provider = { provider: 'openverse', api_key: null, enabled: true }

async function providers(): Promise<Provider[]> {
  const { data } = await supabaseAdmin
    .from('audio_providers')
    .select('provider, api_key, enabled')
    .eq('enabled', true)

  const rows = (data ?? []) as Provider[]

  // A missing table, a failed query or an owner who switched everything off
  // would otherwise leave the customer with a search box that finds nothing
  // and says nothing. Openverse costs no key, so there is no reason for the
  // feature to ever be completely dark.
  if (!rows.some((row) => row.provider === 'openverse')) return [...rows, OPENVERSE]

  return rows
}

const timeout = () => AbortSignal.timeout(15_000)

/** One page of Openverse audio, optionally narrowed to a category. */
async function openversePage(query: string, category?: string): Promise<Track[]> {
  const url = new URL('https://api.openverse.org/v1/audio/')

  url.searchParams.set('q', query)
  url.searchParams.set('page_size', '20')
  // Excluded here rather than filtered later: a no-derivatives track can
  // never be cut to length, so it is noise in these results.
  url.searchParams.set('license_type', 'commercial,modification')

  if (category) url.searchParams.set('category', category)

  const response = await fetch(url, {
    headers: { 'User-Agent': 'ComicAgentAI/1.0' },
    signal: timeout(),
  })

  if (!response.ok) return []

  const payload = (await response.json().catch(() => ({}))) as {
    results?: Record<string, unknown>[]
  }

  return (payload.results ?? [])
    .filter((row) => row.url)
    .map((row) => ({
      provider: 'openverse',
      externalId: String(row.id ?? ''),
      title: String(row.title ?? 'Untitled'),
      artist: String(row.creator ?? ''),
      url: String(row.url),
      duration: row.duration ? Math.round(Number(row.duration) / 1000) : undefined,
      licence: String(row.license ?? ''),
      licenceUrl: row.license_url ? String(row.license_url) : undefined,
      sourceUrl: row.foreign_landing_url ? String(row.foreign_landing_url) : undefined,
    }))
}

/**
 * Openverse — Creative Commons, no key required.
 *
 * Both searches are run and merged, rather than the obvious "filter to music,
 * fall back if empty". Measured against the live API, `category=music` for
 * "gentle piano" returns one track while the unfiltered search returns thirty,
 * most of them plainly music and better licensed. Openverse's category is
 * sparsely populated, so trusting it alone throws away nearly everything, and
 * falling back only on *zero* results is worse still — a single categorised
 * hit would suppress the other twenty-nine.
 *
 * So: categorised tracks first, because that label is a real signal when it is
 * there, then everything else behind them. `rankTracks` orders by licence
 * afterwards, which is what a customer actually cares about.
 */
async function searchOpenverse(query: string): Promise<Track[]> {
  const [music, everything] = await Promise.all([
    openversePage(query, 'music').catch(() => [] as Track[]),
    openversePage(query).catch(() => [] as Track[]),
  ])

  const seen = new Set(music.map((track) => track.externalId))

  return [...music, ...everything.filter((track) => !seen.has(track.externalId))]
}

/** Jamendo — needs a client id. */
async function searchJamendo(query: string, key: string): Promise<Track[]> {
  const url = new URL('https://api.jamendo.com/v3.0/tracks/')

  url.searchParams.set('client_id', key)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '20')
  url.searchParams.set('search', query)
  url.searchParams.set('include', 'licenses musicinfo')
  url.searchParams.set('audioformat', 'mp32')

  const response = await fetch(url, { signal: timeout() })

  if (!response.ok) return []

  const payload = (await response.json().catch(() => ({}))) as {
    results?: Record<string, unknown>[]
  }

  return (payload.results ?? [])
    .filter((row) => row.audio)
    .map((row) => {
      const licences = (row.licenses ?? {}) as Record<string, unknown>

      return {
        provider: 'jamendo',
        externalId: String(row.id ?? ''),
        title: String(row.name ?? 'Untitled'),
        artist: String(row.artist_name ?? ''),
        url: String(row.audio),
        duration: row.duration ? Number(row.duration) : undefined,
        // Jamendo reports the CC variant in the licence block; anything else
        // is their own commercial licensing, which is not free to use.
        licence: String(licences.ccurl ?? '').includes('by-nc')
          ? 'by-nc'
          : String(licences.ccurl ?? '').includes('by-sa')
            ? 'by-sa'
            : String(licences.ccurl ?? '').includes('by-nd')
              ? 'by-nd'
              : String(licences.ccurl ?? '')
                ? 'by'
                : '',
        licenceUrl: licences.ccurl ? String(licences.ccurl) : undefined,
        sourceUrl: row.shareurl ? String(row.shareurl) : undefined,
      }
    })
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const query = (request.nextUrl.searchParams.get('q') ?? '').trim()
  const useCase = (request.nextUrl.searchParams.get('use') ?? 'commercial') as UseCase

  if (!query) return NextResponse.json({ error: 'Search for something' }, { status: 400 })

  const enabled = await providers()

  // One slow provider must not hold up the others.
  const searches = enabled.map((entry) => {
    if (entry.provider === 'openverse') return searchOpenverse(query)
    if (entry.provider === 'jamendo' && entry.api_key) return searchJamendo(query, entry.api_key)

    // A provider row with no handler is a row that was added by hand or left
    // behind by an old migration. Ignored rather than guessed at.
    return Promise.resolve([] as Track[])
  })

  const settled = await Promise.allSettled(searches)

  const tracks = settled.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )

  const failed = settled.filter((result) => result.status === 'rejected').length

  // Usable first, and each carries what the customer has to do about it.
  const ranked = rankTracks(tracks, useCase).map((track) => {
    const verdict = checkTrack(track, useCase)

    return {
      ...track,
      usable: verdict.usable,
      warning: verdict.warning,
      reason: verdict.reason,
      credit: creditLine(track),
    }
  })

  return NextResponse.json({
    tracks: ranked,
    providers: enabled.map((entry) => entry.provider),
    // Said out loud rather than silently returning fewer results.
    partial: failed > 0 ? `${failed} source${failed === 1 ? '' : 's'} did not answer.` : null,
  })
}

/** Keep a chosen track, so its credit survives the search results going away. */
export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)

  if (!body?.url || !body?.title) {
    return NextResponse.json({ error: 'That track is missing its details' }, { status: 400 })
  }

  const track: Track = {
    provider: String(body.provider ?? 'openverse'),
    externalId: String(body.externalId ?? ''),
    title: String(body.title).slice(0, 200),
    artist: String(body.artist ?? '').slice(0, 200),
    url: String(body.url),
    duration: Number(body.duration) || undefined,
    licence: String(body.licence ?? ''),
    licenceUrl: body.licenceUrl ? String(body.licenceUrl) : undefined,
    sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
  }

  const verdict = checkTrack(track, (body.use as UseCase) ?? 'commercial')

  // Refused here as well as in the picker: this is what gets written into a
  // published video's description, so it is the last chance to stop it.
  if (!verdict.usable) {
    return NextResponse.json({ error: verdict.reason }, { status: 409 })
  }

  const { error } = await supabaseAdmin.from('audio_tracks').upsert(
    {
      user_id: session.userId,
      provider: track.provider,
      external_id: track.externalId,
      title: track.title,
      artist: track.artist,
      url: track.url,
      duration: track.duration ?? null,
      licence: track.licence,
      licence_url: track.licenceUrl ?? null,
      credit: creditLine(track),
    },
    { onConflict: 'user_id,provider,external_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, credit: creditLine(track), warning: verdict.warning })
}

export const dynamic = 'force-dynamic'
