import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { can } from '@/lib/auth/rbac'
import { rateLimit } from '@/lib/security/guards'
import {
  detectImageKind,
  isScriptableImage,
  EXTENSION,
  CONTENT_TYPE,
} from '@/lib/storage/image-signature'

/**
 * Logo and favicon upload.
 *
 * Goes through the server rather than straight to storage so three things can
 * be enforced that a browser upload cannot: the caller may only write into
 * their own tenant's folder, the file is checked against its real signature
 * rather than the MIME type it claims, and the size cap is applied before
 * anything is stored.
 */

const BUCKET = 'branding'

const LIMITS: Record<string, number> = {
  logo: 2 * 1024 * 1024,
  favicon: 512 * 1024,
}

const COLUMN: Record<string, 'logo_url' | 'favicon_url'> = {
  logo: 'logo_url',
  favicon: 'favicon_url',
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  if (!can(session.role, 'branding.manage')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const limit = rateLimit(`branding-upload:${session.userId}`, { limit: 30, windowMs: 60 * 60 * 1000 })

  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many uploads. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.` },
      { status: 429 }
    )
  }

  const form = await request.formData().catch(() => null)

  if (!form) return NextResponse.json({ error: 'Expected a file upload' }, { status: 400 })

  const kindParam = String(form.get('kind') ?? '')
  const file = form.get('file')

  if (!COLUMN[kindParam]) {
    return NextResponse.json({ error: 'kind must be "logo" or "favicon"' }, { status: 400 })
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file received' }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'That file is empty.' }, { status: 400 })
  }

  if (file.size > LIMITS[kindParam]) {
    const mb = (LIMITS[kindParam] / (1024 * 1024)).toFixed(1)

    return NextResponse.json(
      { error: `Too large — the ${kindParam} must be under ${mb} MB.` },
      { status: 400 }
    )
  }

  // A superadmin may upload on a tenant's behalf; anyone else is fixed to
  // their own tenant regardless of what the form claims.
  const requestedTenant = String(form.get('tenantId') ?? '')
  const tenantId =
    session.role === 'superadmin' && requestedTenant ? requestedTenant : session.tenantId

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = detectImageKind(bytes)

  if (!kind) {
    return NextResponse.json(
      { error: 'That does not look like an image. Use PNG, JPG, WebP or ICO.' },
      { status: 400 }
    )
  }

  // Served from a public bucket on this origin — an SVG could carry a script.
  if (isScriptableImage(kind)) {
    return NextResponse.json(
      { error: 'SVG is not accepted because it can contain scripts. Use PNG or WebP.' },
      { status: 400 }
    )
  }

  // Timestamped name so a replacement is not masked by a cached old file.
  const path = `${tenantId}/${kindParam}-${Date.now()}.${EXTENSION[kind]}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: CONTENT_TYPE[kind], upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 })
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

  // Remember the old file so it can be deleted after the row points elsewhere.
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select(COLUMN[kindParam])
    .eq('id', tenantId)
    .maybeSingle()

  const previous = (tenant as Record<string, string | null> | null)?.[COLUMN[kindParam]] ?? null

  const { error: updateError } = await supabaseAdmin
    .from('tenants')
    .update({ [COLUMN[kindParam]]: publicUrl })
    .eq('id', tenantId)

  if (updateError) {
    // Do not leave an orphan behind if the row could not be pointed at it.
    await supabaseAdmin.storage.from(BUCKET).remove([path])

    return NextResponse.json(
      {
        error: updateError.message.includes('tenants_branding_not_reseller')
          ? 'Resellers cannot rebrand — they sell under Comic Tale AI branding.'
          : updateError.message,
      },
      { status: 400 }
    )
  }

  // Best effort: an old file left behind costs storage, not correctness.
  if (previous?.includes(`/${BUCKET}/`)) {
    const oldPath = previous.split(`/${BUCKET}/`)[1]

    if (oldPath) await supabaseAdmin.storage.from(BUCKET).remove([oldPath])
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: session.userId,
    actor_role: session.role,
    tenant_id: tenantId,
    action: `branding.${kindParam}_upload`,
    target_type: 'tenant',
    target_id: tenantId,
    metadata: { path, bytes: file.size, kind },
  })

  return NextResponse.json({ ok: true, url: publicUrl })
}

/** Clear a logo or favicon and delete the stored file. */
export async function DELETE(request: NextRequest) {
  const session = await getSessionContext()

  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  if (!can(session.role, 'branding.manage')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const params = new URL(request.url).searchParams
  const kindParam = params.get('kind') ?? ''

  if (!COLUMN[kindParam]) {
    return NextResponse.json({ error: 'kind must be "logo" or "favicon"' }, { status: 400 })
  }

  const requestedTenant = params.get('tenantId') ?? ''
  const tenantId =
    session.role === 'superadmin' && requestedTenant ? requestedTenant : session.tenantId

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select(COLUMN[kindParam])
    .eq('id', tenantId)
    .maybeSingle()

  const current = (tenant as Record<string, string | null> | null)?.[COLUMN[kindParam]] ?? null

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ [COLUMN[kindParam]]: null })
    .eq('id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (current?.includes(`/${BUCKET}/`)) {
    const path = current.split(`/${BUCKET}/`)[1]

    if (path) await supabaseAdmin.storage.from(BUCKET).remove([path])
  }

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
