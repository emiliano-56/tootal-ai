'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Check, ImageIcon, AlertTriangle } from 'lucide-react'

/**
 * Choosing which saved characters appear in this comic.
 *
 * Order matters and is shown, because it is what the generator uses: the
 * first character listed gets their reference sent first, and with a cap of
 * three references a five-character cast means the last two are words only.
 * Making that visible here is the difference between a deliberate choice and
 * a surprise on page four.
 *
 * A character without a reference drawing is still selectable — words alone
 * are how this worked before and they are better than nothing — but it is
 * labelled, because the customer should know which of their cast will hold
 * steady and which will drift.
 */

interface CharacterRow {
  id: string
  name: string
  role: string
  image_url: string | null
  poses: { id: string }[]
}

/** Mirrors MAX_REFERENCES in lib/characters/cast.ts. */
const REFERENCE_LIMIT = 3

export function CastPicker({
  selected,
  onChange,
  className,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  className?: string
}) {
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch('/api/characters', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) return

        setCharacters(Array.isArray(payload?.characters) ? payload.characters : [])
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id])

  // Nothing saved yet: point at the studio rather than showing an empty box
  // that looks broken.
  if (!loading && characters.length === 0) {
    return (
      <div className={className}>
        <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 mb-1.5">
          <Users className="w-3.5 h-3.5 text-violet-500" />
          Recurring cast
        </label>
        <p className="text-xs text-slate-400">
          No saved characters yet.{' '}
          <Link href="/characters" className="font-semibold text-indigo-600 hover:underline">
            Create one in Character Studio
          </Link>{' '}
          and they will look the same in every comic.
        </p>
      </div>
    )
  }

  const chosen = selected
    .map((id) => characters.find((character) => character.id === id))
    .filter(Boolean) as CharacterRow[]

  const withPicture = chosen.filter((character) => character.image_url)
  const overflow = Math.max(0, withPicture.length - REFERENCE_LIMIT)

  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 mb-1.5">
        <Users className="w-3.5 h-3.5 text-violet-500" />
        Recurring cast
        {selected.length > 0 && (
          <span className="font-normal text-slate-400">· {selected.length} chosen</span>
        )}
      </label>

      <div className="flex flex-wrap gap-2">
        {characters.map((character) => {
          const index = selected.indexOf(character.id)
          const active = index >= 0

          return (
            <button
              key={character.id}
              type="button"
              onClick={() => toggle(character.id)}
              className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl ring-1 transition-colors ${
                active
                  ? 'ring-violet-400 bg-violet-50'
                  : 'ring-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="relative w-8 h-8 shrink-0 rounded-lg bg-slate-100 overflow-hidden grid place-items-center">
                {character.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={character.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                )}

                {active && (
                  <span className="absolute inset-0 bg-violet-600/70 grid place-items-center text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                )}
              </span>

              <span className="min-w-0 text-left">
                <span
                  className={`block text-xs font-semibold truncate max-w-[8rem] ${
                    active ? 'text-violet-900' : 'text-slate-700'
                  }`}
                >
                  {character.name}
                </span>
                {!character.image_url && (
                  <span className="block text-[10px] text-amber-600">words only</span>
                )}
              </span>

              {active && <Check className="w-3.5 h-3.5 shrink-0 text-violet-600" />}
            </button>
          )
        })}
      </div>

      {/* The cap is real and its effect is invisible otherwise: the fourth
          character's picture is simply not sent, and their panels drift. */}
      {overflow > 0 && (
        <p className="mt-2 text-[11px] text-amber-700 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
          Only the first {REFERENCE_LIMIT} get their picture sent to the illustrator.{' '}
          {overflow === 1 ? 'The last one is' : `The last ${overflow} are`} described in words, so{' '}
          {overflow === 1 ? 'they' : 'they'} may drift. Reorder by unselecting and picking again.
        </p>
      )}

      {selected.length > 0 && withPicture.length === 0 && (
        <p className="mt-2 text-[11px] text-amber-700">
          None of these have a reference drawing yet, so they are only descriptions.{' '}
          <Link href="/characters" className="font-semibold text-indigo-600 hover:underline">
            Draw them
          </Link>{' '}
          to keep them consistent.
        </p>
      )}
    </div>
  )
}
