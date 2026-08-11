import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { checkCast, type Character } from '@/lib/characters/cast'

/**
 * Loading a cast the caller actually owns.
 *
 * The browser sends ids and nothing else. Everything a character contributes
 * to a job — the appearance text that goes into a prompt, the URL the
 * illustrator is told to fetch — is read here from the row, because both are
 * instructions and neither should be something the client can compose.
 *
 * Never throws. A cast that cannot be loaded means a comic without recurring
 * characters, which is what the product did before this existed; failing the
 * whole generation over it would be a worse answer than the old one.
 */

/** Sending more than this in one job is a mistake rather than a request. */
const MAX_CAST = 8

export async function loadCast(ids: unknown, userId?: string): Promise<Character[]> {
  const wanted = Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, MAX_CAST)
    : []

  if (wanted.length === 0) return []

  try {
    const owner = userId ?? (await getSessionContext())?.userId

    if (!owner) return []

    const { data, error } = await supabaseAdmin
      .from('characters')
      .select('id, name, role, appearance, personality, image_url, art_style')
      .eq('user_id', owner)
      .eq('archived', false)
      .in('id', wanted)

    if (error) {
      console.error('[characters] cast lookup failed:', error.message)
      return []
    }

    const rows = (data ?? []) as {
      id: string
      name: string
      role: string
      appearance: string
      personality: string
      image_url: string | null
      art_style: string
    }[]

    const { data: poseRows } = await supabaseAdmin
      .from('character_poses')
      .select('character_id, image_url, label, primary_ref')
      .in('character_id', rows.map((row) => row.id))

    const posesFor = (id: string) =>
      ((poseRows ?? []) as { character_id: string; image_url: string; label: string; primary_ref: boolean }[])
        .filter((pose) => pose.character_id === id)
        .map((pose) => ({ imageUrl: pose.image_url, label: pose.label, primary: pose.primary_ref }))

    // Returned in the order the caller asked for. The prompt lists them in
    // this order and so does the reference picking, so "the main character
    // first" is a thing the customer can actually control.
    const byId = new Map(rows.map((row) => [row.id, row]))

    const cast = wanted
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((row) => ({
        id: row!.id,
        name: row!.name,
        role: row!.role,
        appearance: row!.appearance,
        personality: row!.personality,
        imageUrl: row!.image_url,
        artStyle: row!.art_style,
        poses: posesFor(row!.id),
      }))

    // A stale or unreachable reference is dropped to words-only rather than
    // sent — the backend would fail the whole render on a URL it cannot
    // fetch, and losing the picture is much better than losing the panel.
    const { problems } = checkCast(cast)

    for (const problem of problems) {
      console.warn(`[characters] ${problem.name}: ${problem.reason}`)
    }

    return cast.map((character) => {
      const broken = problems.some((problem) => problem.name === character.name)

      return broken ? { ...character, imageUrl: null, poses: [] } : character
    })
  } catch (error) {
    console.error('[characters] cast lookup threw:', error)
    return []
  }
}

/** Record that these characters appeared in something, and bump their counters. */
export async function recordAppearance(
  userId: string,
  characterIds: string[],
  subject: { kind?: string; id?: string | null; title?: string }
): Promise<void> {
  if (characterIds.length === 0) return

  try {
    await supabaseAdmin.from('character_appearances').insert(
      characterIds.map((characterId) => ({
        character_id: characterId,
        user_id: userId,
        subject_kind: subject.kind ?? 'library_item',
        subject_id: subject.id ?? null,
        title: (subject.title ?? '').slice(0, 300),
      }))
    )

    // One statement rather than a read-modify-write per character, so two
    // jobs finishing at once cannot lose a count between them.
    await supabaseAdmin.rpc('bump_character_usage', { ids: characterIds }).then(
      () => undefined,
      async () => {
        // No function on this schema yet. The counter is a nicety, so a
        // per-row update is an acceptable fallback rather than a failure.
        for (const id of characterIds) {
          const { data } = await supabaseAdmin
            .from('characters')
            .select('times_used')
            .eq('id', id)
            .maybeSingle()

          await supabaseAdmin
            .from('characters')
            .update({
              times_used: ((data as { times_used: number } | null)?.times_used ?? 0) + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq('id', id)
        }
      }
    )
  } catch (error) {
    // History, not a rule. Never fail a finished comic over it.
    console.error('[characters] could not record appearance:', error)
  }
}
