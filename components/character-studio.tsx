'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Users,
  Plus,
  Sparkles,
  Loader2,
  Trash2,
  Upload,
  Archive,
  ArchiveRestore,
  Pencil,
  ImageIcon,
  AlertTriangle,
  Check,
} from 'lucide-react'
import { supabase } from '@/lib/db'
import { AgentHeader, Card, Field, inputClass, PrimaryButton, ErrorNote } from '@/components/agent-ui'
import { useLanguage, LanguagePicker } from '@/components/language-picker'
import { usableReference } from '@/lib/characters/cast'

/**
 * The cast a customer keeps between books.
 *
 * The reference image is the point of this screen, not decoration. The
 * backend accepts reference pictures and honours them, so a character with a
 * drawing attached comes out the same in every panel of every comic — which
 * a written description never managed, because a sentence is not a face.
 *
 * So the screen is built around getting one: a character without a reference
 * is shown as unfinished rather than as a valid state, and the button that
 * fixes it is the loudest thing on the card.
 */

interface Pose {
  id: string
  label: string
  image_url: string
  primary_ref: boolean
}

interface CharacterRow {
  id: string
  name: string
  role: string
  appearance: string
  personality: string
  image_url: string | null
  source: string
  art_style: string
  archived: boolean
  times_used: number
  poses: Pose[]
}

const ART_STYLES = [
  'Pixar 3D',
  'Modern comic book, bold ink',
  'Anime',
  'Watercolour storybook',
  'Flat vector cartoon',
  'Classic Disney',
]

export function CharacterStudio() {
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [poseKinds, setPoseKinds] = useState<{ key: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CharacterRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/characters${showArchived ? '?archived=1' : ''}`, {
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) setError(payload?.error ?? 'Could not load your cast')
      else {
        setCharacters(payload.characters ?? [])
        setPoseKinds(payload.poses ?? [])
        setError(null)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [showArchived])

  useEffect(() => {
    load()
  }, [load])

  const call = async (body: Record<string, unknown>, key: string, message?: string) => {
    setBusy(key)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.error ?? 'That did not work')
        return null
      }

      if (message) setNotice(message)
      await load()

      return payload
    } catch {
      setError('Network error — please try again')
      return null
    } finally {
      setBusy(null)
    }
  }

  const remove = async (character: CharacterRow) => {
    if (!window.confirm(`Delete ${character.name}? Their reference drawings go too.`)) return

    setBusy(character.id)

    await fetch(`/api/characters?id=${character.id}`, { method: 'DELETE' })
    await load()

    setBusy(null)
    setNotice(`${character.name} deleted.`)
  }

  const withoutReference = characters.filter((c) => !c.image_url && !c.archived).length

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<Users className="w-5 h-5 text-white" />}
        gradient="from-violet-500 to-indigo-600"
        title="Character Studio"
        subtitle="Draw a character once, and they look the same in every comic you make"
        action={
          <button
            onClick={() => setCreating(true)}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New character
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      {notice && (
        <p className="p-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      {/* The one thing worth nagging about: a character with no drawing is
          only a description, and a description drifts. */}
      {withoutReference > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 ring-1 ring-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            {withoutReference} character{withoutReference === 1 ? ' has' : 's have'} no reference
            drawing yet. Without one they are only a description, and a description comes out
            differently every time. Press <span className="font-semibold">Draw reference</span> on
            each.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${characters.length} character${characters.length === 1 ? '' : 's'}`}
        </p>

        <button
          onClick={() => setShowArchived(!showArchived)}
          className="text-xs font-semibold text-slate-500 hover:text-indigo-600"
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
      </div>

      {!loading && characters.length === 0 && (
        <Card>
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-900">No characters yet</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Describe someone once and let the AI draw them. From then on you can drop them into
              any comic and they will look the same every time.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 h-10 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Create your first
            </button>
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            poseKinds={poseKinds}
            busy={busy === character.id}
            onDraw={(artStyle) =>
              call(
                { action: 'reference', id: character.id, artStyle },
                character.id,
                `${character.name} drawn.`
              )
            }
            onPose={(pose) =>
              call({ action: 'pose', id: character.id, pose }, character.id, 'Pose added.')
            }
            onArchive={() =>
              call(
                { action: 'update', id: character.id, archived: !character.archived },
                character.id,
                character.archived ? 'Restored.' : 'Archived.'
              )
            }
            onEdit={() => setEditing(character)}
            onDelete={() => remove(character)}
          />
        ))}
      </div>

      {(creating || editing) && (
        <CharacterDialog
          existing={editing}
          busy={busy === 'save'}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={async (payload) => {
            const result = await call(
              editing
                ? { action: 'update', id: editing.id, ...payload }
                : { action: 'create', ...payload },
              'save',
              editing ? 'Saved.' : `${payload.name} created — now draw them.`
            )

            if (result) {
              setCreating(false)
              setEditing(null)
            }
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  One character
// ---------------------------------------------------------------------------

function CharacterCard({
  character,
  poseKinds,
  busy,
  onDraw,
  onPose,
  onArchive,
  onEdit,
  onDelete,
}: {
  character: CharacterRow
  poseKinds: { key: string; label: string }[]
  busy: boolean
  onDraw: (artStyle: string) => void
  onPose: (pose: string) => void
  onArchive: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [style, setStyle] = useState(character.art_style || ART_STYLES[0])
  const [showPoses, setShowPoses] = useState(false)

  return (
    <div
      className={`rounded-2xl bg-white ring-1 p-4 space-y-3 ${
        character.archived ? 'ring-slate-200 opacity-60' : 'ring-slate-200/70'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 shrink-0 rounded-xl bg-slate-100 overflow-hidden grid place-items-center">
          {character.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.image_url}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-slate-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 truncate">{character.name}</p>
          {character.role && (
            <p className="text-xs text-slate-500 truncate">{character.role}</p>
          )}
          <p className="text-[11px] text-slate-400 mt-1">
            {character.image_url ? (
              <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                <Check className="w-3 h-3" />
                Reference ready
              </span>
            ) : (
              <span className="text-amber-600 font-semibold">No reference yet</span>
            )}
            {character.times_used > 0 && ` · used ${character.times_used}×`}
          </p>
        </div>
      </div>

      {character.appearance && (
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {character.appearance}
        </p>
      )}

      {character.poses.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {character.poses.map((pose) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={pose.id}
              src={pose.image_url}
              alt={pose.label}
              title={pose.label}
              className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-200"
            />
          ))}
        </div>
      )}

      {!character.archived && (
        <>
          <div className="flex gap-2">
            <select
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className="flex-1 min-w-0 h-9 px-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-xs text-slate-700"
            >
              {ART_STYLES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>

            <button
              onClick={() => onDraw(style)}
              disabled={busy}
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {character.image_url ? 'Redraw' : 'Draw reference'}
            </button>
          </div>

          {/* Poses are drawn from the reference, so they are offered only
              once there is one to draw from. */}
          {character.image_url && (
            <div>
              <button
                onClick={() => setShowPoses(!showPoses)}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                {showPoses ? 'Hide poses' : 'Add a pose or expression'}
              </button>

              {showPoses && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {poseKinds.map((pose) => (
                    <button
                      key={pose.key}
                      onClick={() => onPose(pose.key)}
                      disabled={busy}
                      className="h-7 px-2.5 rounded-lg ring-1 ring-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {pose.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100">
        <IconBtn label="Edit" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" />
        </IconBtn>
        <IconBtn label={character.archived ? 'Restore' : 'Archive'} onClick={onArchive}>
          {character.archived ? (
            <ArchiveRestore className="w-3.5 h-3.5" />
          ) : (
            <Archive className="w-3.5 h-3.5" />
          )}
        </IconBtn>
        <IconBtn label="Delete" onClick={onDelete} tone="text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </IconBtn>
      </div>
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  tone = 'text-slate-400',
  children,
}: {
  label: string
  onClick: () => void
  tone?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-lg ${tone} hover:bg-slate-100 transition-colors`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
//  Create / edit
// ---------------------------------------------------------------------------

function CharacterDialog({
  existing,
  busy,
  onClose,
  onSave,
}: {
  existing: CharacterRow | null
  busy: boolean
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [role, setRole] = useState(existing?.role ?? '')
  const [appearance, setAppearance] = useState(existing?.appearance ?? '')
  const [personality, setPersonality] = useState(existing?.personality ?? '')
  const [artStyle, setArtStyle] = useState(existing?.art_style ?? ART_STYLES[0])
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  /**
   * Uploading your own picture.
   *
   * Straight to the public `characters` bucket from the browser: the storage
   * policy already restricts writes to a folder named after the caller's own
   * id, so routing it through the server would add a hop without adding a
   * check. Public because the illustrator fetches it over the internet.
   */
  const upload = async (file: File) => {
    setUploading(true)
    setUploadError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setUploadError('Your session expired. Sign in again.')
        return
      }

      if (file.size > 8 * 1024 * 1024) {
        setUploadError('That image is over 8MB — please use a smaller one.')
        return
      }

      const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${user.id}/${Date.now()}-upload.${extension}`

      const { error } = await supabase.storage
        .from('characters')
        .upload(path, file, { contentType: file.type || 'image/png' })

      if (error) {
        setUploadError(error.message)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('characters').getPublicUrl(path)

      const check = usableReference(publicUrl)

      if (!check.ok) {
        setUploadError(check.reason ?? 'That image cannot be used as a reference')
        return
      }

      setImageUrl(publicUrl)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg my-4 sm:my-8 bg-white rounded-2xl ring-1 ring-slate-200 shadow-2xl">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {existing ? `Edit ${existing.name}` : 'New character'}
          </h2>
          <p className="text-sm text-slate-500">
            Describe them once. The AI draws them, and that drawing keeps them consistent.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Name *" hint="What the story calls them">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Pip"
              className={inputClass}
            />
          </Field>

          <Field label="Who they are" hint="One line — shown to you, not drawn">
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="A shy hedgehog who has just moved house"
              className={inputClass}
            />
          </Field>

          <Field
            label="What they look like *"
            hint="Be specific and physical — this goes into every drawing. Colours, clothing, one memorable detail."
          >
            <textarea
              value={appearance}
              onChange={(event) => setAppearance(event.target.value)}
              placeholder="A small round hedgehog with warm brown spines, big amber eyes, a rainbow-striped scarf and one bent left ear"
              className={`${inputClass} h-24 resize-none py-2.5`}
            />
          </Field>

          <Field label="Personality" hint="Used when writing dialogue">
            <input
              value={personality}
              onChange={(event) => setPersonality(event.target.value)}
              placeholder="Curious, cautious, very loyal"
              className={inputClass}
            />
          </Field>

          <Field label="Art style">
            <select
              value={artStyle}
              onChange={(event) => setArtStyle(event.target.value)}
              className={inputClass}
            >
              {ART_STYLES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </Field>

          {!existing && (
            <div className="rounded-xl ring-1 ring-slate-200 p-3.5">
              <p className="text-[13px] font-semibold text-slate-700">
                Already have a picture?
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-2.5">
                Upload a drawing or photo and the AI will redraw them from it. Otherwise leave this
                and press Draw reference afterwards.
              </p>

              {imageUrl ? (
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Reference"
                    className="w-14 h-14 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                  <button
                    onClick={() => setImageUrl('')}
                    className="text-xs font-semibold text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="h-9 px-3 rounded-lg ring-1 ring-slate-200 text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  Upload a picture
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]

                  if (file) upload(file)
                  event.target.value = ''
                }}
              />

              {uploadError && <p className="mt-2 text-[11px] text-red-500">{uploadError}</p>}
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="h-10 px-4 rounded-xl ring-1 ring-slate-200 text-sm font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({ name, role, appearance, personality, artStyle, imageUrl: imageUrl || undefined })
            }
            disabled={busy || !name.trim() || !appearance.trim()}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
