import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { generateImage, storeCharacterImage, CHARACTER_BUCKET } from '@/lib/ai/images'
import {
  referencePrompt,
  posePrompt,
  usableReference,
  POSE_PRESETS,
  type Character,
} from '@/lib/characters/cast'

/**
 * The cast a customer keeps.
 *
 * Drawing happens here rather than in the browser, unlike every other
 * generation in the app. Two reasons, and both are about the reference
 * outliving the request: the backend's output URL expires within the hour, so
 * the bytes have to be copied into storage immediately; and the copy has to
 * land in a bucket the customer cannot write arbitrary paths into. Doing that
 * from the browser would mean trusting the client with both.
 *
 * This route holds the service-role client, so every read and write is scoped
 * to `session.userId` by hand — RLS does not apply to it.
 */

const MAX_CHARACTERS = 200

interface Row {
  id: string
  name: string
  role: string
  appearance: string
  personality: string
  image_path: string | null
  image_url: string | null
  source: string
  art_style: string
  archived: boolean
  times_used: number
  created_at: string
}

const SELECT =
  'id, name, role, appearance, personality, image_path, image_url, source, art_style, archived, times_used, created_at'

/** The row shape the pure helpers expect. */
function toCharacter(row: Row, poses: { image_url: string; label: string; primary_ref: boolean }[] = []): Character {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    appearance: row.appearance,
    personality: row.personality,
    imageUrl: row.image_url,
    artStyle: row.art_style,
    poses: poses.map((pose) => ({
      imageUrl: pose.image_url,
      label: pose.label,
      primary: pose.primary_ref,
    })),
  }
}

async function owned(id: string, userId: string): Promise<Row | null> {
  const { data } = await supabaseAdmin
    .from('characters')
    .select(SELECT)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  return (data as Row | null) ?? null
}

// ---------------------------------------------------------------------------
//  GET — the cast
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const includeArchived = request.nextUrl.searchParams.get('archived') === '1'

  let query = supabaseAdmin
    .from('characters')
    .select(SELECT)
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })

  if (!includeArchived) query = query.eq('archived', false)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const rows = (data ?? []) as Row[]

  // Poses in one query rather than one per character.
  const { data: poseRows } = await supabaseAdmin
    .from('character_poses')
    .select('id, character_id, label, image_url, image_path, primary_ref, created_at')
    .in('character_id', rows.length > 0 ? rows.map((row) => row.id) : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at')

  const byCharacter = new Map<string, typeof poseRows>()

  for (const pose of poseRows ?? []) {
    const entry = pose as { character_id: string }
    const list = byCharacter.get(entry.character_id) ?? []

    list.push(pose as never)
    byCharacter.set(entry.character_id, list)
  }

  return NextResponse.json(
    {
      characters: rows.map((row) => ({
        ...row,
        poses: byCharacter.get(row.id) ?? [],
      })),
      poses: POSE_PRESETS,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// ---------------------------------------------------------------------------
//  POST — create, edit, draw
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = String(body?.action ?? 'create')

  // ---- create -------------------------------------------------------------
  if (action === 'create') {
    const name = String(body?.name ?? '').trim()

    if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 })

    const { count } = await supabaseAdmin
      .from('characters')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .eq('archived', false)

    if ((count ?? 0) >= MAX_CHARACTERS) {
      return NextResponse.json(
        { error: `You can keep ${MAX_CHARACTERS} characters. Archive some first.` },
        { status: 400 }
      )
    }

    // An uploaded reference has to be reachable by the illustrator, so it is
    // checked here rather than discovered when a panel comes back wrong.
    const supplied = String(body?.imageUrl ?? '').trim()

    if (supplied) {
      const check = usableReference(supplied)

      if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('characters')
      .insert({
        user_id: session.userId,
        tenant_id: session.tenantId,
        name: name.slice(0, 120),
        role: String(body?.role ?? '').trim().slice(0, 200),
        appearance: String(body?.appearance ?? '').trim().slice(0, 2000),
        personality: String(body?.personality ?? '').trim().slice(0, 1000),
        art_style: String(body?.artStyle ?? '').trim().slice(0, 200),
        image_url: supplied || null,
        image_path: String(body?.imagePath ?? '').trim() || null,
        source: supplied ? 'uploaded' : 'generated',
      })
      .select(SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, character: data })
  }

  const character = await owned(String(body?.id ?? ''), session.userId)

  if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ---- edit ---------------------------------------------------------------
  if (action === 'update') {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    const fields: [string, string, number][] = [
      ['name', 'name', 120],
      ['role', 'role', 200],
      ['appearance', 'appearance', 2000],
      ['personality', 'personality', 1000],
      ['artStyle', 'art_style', 200],
    ]

    for (const [from, column, max] of fields) {
      if (typeof body[from] === 'string') patch[column] = body[from].trim().slice(0, max)
    }

    if (typeof body.archived === 'boolean') patch.archived = body.archived

    const { error } = await supabaseAdmin
      .from('characters')
      .update(patch)
      .eq('id', character.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  }

  // ---- draw the main reference -------------------------------------------
  if (action === 'reference') {
    const prompt = referencePrompt(toCharacter(character), String(body?.artStyle ?? character.art_style))

    const image = await generateImage(prompt, { aspectRatio: '1:1' })

    if (!image) {
      return NextResponse.json(
        { error: 'The illustrator did not answer. Try again in a moment.' },
        { status: 502 }
      )
    }

    const stored = await storeCharacterImage(session.userId, image, character.name)

    if (!stored) return NextResponse.json({ error: 'Could not save the drawing' }, { status: 500 })

    // The old file goes only after the new one is safely stored, so a failed
    // upload never leaves a character with no face at all.
    if (character.image_path) {
      await supabaseAdmin.storage.from(CHARACTER_BUCKET).remove([character.image_path])
    }

    const { error } = await supabaseAdmin
      .from('characters')
      .update({
        image_path: stored.path,
        image_url: stored.url,
        source: 'generated',
        art_style: String(body?.artStyle ?? character.art_style).slice(0, 200),
        updated_at: new Date().toISOString(),
      })
      .eq('id', character.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, imageUrl: stored.url })
  }

  // ---- draw one pose for the model sheet ----------------------------------
  if (action === 'pose') {
    const key = String(body?.pose ?? 'front')

    if (!character.image_url) {
      return NextResponse.json(
        { error: 'Draw the main reference first — a pose is drawn from it.' },
        { status: 400 }
      )
    }

    const prompt = posePrompt(toCharacter(character), key, character.art_style)

    // The main reference goes in as an image, which is the whole point: a pose
    // described in words is a different character in a different pose.
    const image = await generateImage(prompt, {
      aspectRatio: '1:1',
      imageUrls: [character.image_url],
    })

    if (!image) {
      return NextResponse.json({ error: 'The illustrator did not answer.' }, { status: 502 })
    }

    const stored = await storeCharacterImage(session.userId, image, `${character.name}-${key}`)

    if (!stored) return NextResponse.json({ error: 'Could not save the drawing' }, { status: 500 })

    const { data, error } = await supabaseAdmin
      .from('character_poses')
      .insert({
        character_id: character.id,
        label: POSE_PRESETS.find((entry) => entry.key === key)?.label ?? key,
        image_path: stored.path,
        image_url: stored.url,
        // The three turnaround angles steady a face; the expressions are for
        // the customer to look at, so only the angles ride along by default.
        primary_ref: ['side', 'back'].includes(key),
      })
      .select('id, label, image_url, primary_ref')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, pose: data })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ---------------------------------------------------------------------------
//  DELETE
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id') ?? ''
  const character = await owned(id, session.userId)

  if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Every file this character owns, so deleting one does not leave the bucket
  // holding drawings nothing points at.
  const { data: poses } = await supabaseAdmin
    .from('character_poses')
    .select('image_path')
    .eq('character_id', character.id)

  const paths = [
    character.image_path,
    ...((poses ?? []) as { image_path: string }[]).map((pose) => pose.image_path),
  ].filter((path): path is string => Boolean(path))

  if (paths.length > 0) {
    const { error } = await supabaseAdmin.storage.from(CHARACTER_BUCKET).remove(paths)

    // A stranded file is untidy; refusing the delete over it would be worse.
    if (error) console.error('[characters] could not remove files:', error.message)
  }

  // Poses and appearances cascade.
  await supabaseAdmin.from('characters').delete().eq('id', character.id)

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300
