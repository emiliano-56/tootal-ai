'use client'

import { useId } from 'react'

/**
 * Original cartoon kids, drawn as inline SVG.
 *
 * Hand-authored here on purpose: no third-party artwork, no licensing to track,
 * no external request, and they stay crisp at any size. Chibi proportions (big
 * head, small body), bold ink outlines and flat fills keep them reading as
 * comic-book art rather than generic UI illustration.
 */

const INK = '#1f2937'

type CharacterProps = {
  className?: string
}

/** Shared face: big eyes with highlights, blush, smile. */
function Face({
  browColor,
  mouth = 'smile',
}: {
  browColor: string
  mouth?: 'smile' | 'open' | 'grin'
}) {
  return (
    <>
      {/* Eye whites */}
      <ellipse cx="40" cy="40" rx="7.5" ry="8.5" fill="#ffffff" stroke={INK} strokeWidth="2.4" />
      <ellipse cx="60" cy="40" rx="7.5" ry="8.5" fill="#ffffff" stroke={INK} strokeWidth="2.4" />

      {/* Irises */}
      <circle cx="40.5" cy="41" r="4.6" fill={INK} />
      <circle cx="60.5" cy="41" r="4.6" fill={INK} />

      {/* Catch lights */}
      <circle cx="42.3" cy="38.8" r="1.9" fill="#ffffff" />
      <circle cx="62.3" cy="38.8" r="1.9" fill="#ffffff" />
      <circle cx="38.6" cy="43.4" r="1" fill="#ffffff" opacity="0.7" />
      <circle cx="58.6" cy="43.4" r="1" fill="#ffffff" opacity="0.7" />

      {/* Brows */}
      <path d="M33 29q7-4 13-1" stroke={browColor} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M54 28q6-3 13 1" stroke={browColor} strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Nose */}
      <path d="M50 46q2 2 0 3.5" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Mouth */}
      {mouth === 'smile' && (
        <path d="M44 54q6 5 12 0" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      )}
      {mouth === 'grin' && (
        <path d="M43 53q7 8 14 0z" fill={INK} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      )}
      {mouth === 'open' && (
        <ellipse cx="50" cy="55" rx="5" ry="4" fill="#9f1239" stroke={INK} strokeWidth="2.4" />
      )}

      {/* Blush */}
      <ellipse cx="30" cy="50" rx="4.5" ry="3" fill="#fb7185" opacity="0.45" />
      <ellipse cx="70" cy="50" rx="4.5" ry="3" fill="#fb7185" opacity="0.45" />
    </>
  )
}

/** Aarav — the storyteller. Spiky black hair, red tee. */
export function KidStoryteller({ className }: CharacterProps) {
  const skin = '#d99a6c'

  return (
    <svg viewBox="0 0 100 120" className={className} role="img" aria-label="Boy character with spiky hair">
      {/* Legs */}
      <rect x="39" y="88" width="9" height="18" rx="4.5" fill={skin} stroke={INK} strokeWidth="2.6" />
      <rect x="52" y="88" width="9" height="18" rx="4.5" fill={skin} stroke={INK} strokeWidth="2.6" />

      {/* Shoes */}
      <path d="M36 104h13v6a2 2 0 01-2 2H38a2 2 0 01-2-2z" fill="#3b82f6" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M51 104h13v6a2 2 0 01-2 2H53a2 2 0 01-2-2z" fill="#3b82f6" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />

      {/* Shorts */}
      <path d="M34 80h32v10a2 2 0 01-2 2H36a2 2 0 01-2-2z" fill="#1e3a8a" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />

      {/* Arms */}
      <rect x="24" y="64" width="9" height="22" rx="4.5" fill="#ef4444" stroke={INK} strokeWidth="2.6" />
      <rect x="67" y="64" width="9" height="22" rx="4.5" fill="#ef4444" stroke={INK} strokeWidth="2.6" />
      <circle cx="28.5" cy="88" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />
      <circle cx="71.5" cy="88" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />

      {/* Torso */}
      <path d="M35 62h30a4 4 0 014 4v18H31V66a4 4 0 014-4z" fill="#ef4444" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M44 62q6 6 12 0" stroke={INK} strokeWidth="2.2" fill="none" />

      {/* Ears */}
      <circle cx="25" cy="40" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />
      <circle cx="75" cy="40" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />

      {/* Head */}
      <ellipse cx="50" cy="38" rx="25" ry="24" fill={skin} stroke={INK} strokeWidth="2.8" />

      <Face browColor="#1f2937" mouth="grin" />

      {/* Spiky hair */}
      <path
        d="M25 36c0-16 11-26 25-26s25 10 25 26c-3-7-7-9-11-7 1-7-4-11-7-8-3-4-9-3-11 3-3-5-9-6-12-1-4-2-8 3-9 13z"
        fill="#18181b"
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Mia — the artist. Brown bob, teal top with stars. */
export function KidArtist({ className }: CharacterProps) {
  const skin = '#f2c9a0'

  return (
    <svg viewBox="0 0 100 120" className={className} role="img" aria-label="Girl character with bob haircut">
      {/* Legs */}
      <rect x="39" y="88" width="9" height="18" rx="4.5" fill={skin} stroke={INK} strokeWidth="2.6" />
      <rect x="52" y="88" width="9" height="18" rx="4.5" fill={skin} stroke={INK} strokeWidth="2.6" />

      {/* Shoes */}
      <path d="M36 104h13v6a2 2 0 01-2 2H38a2 2 0 01-2-2z" fill="#f472b6" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M51 104h13v6a2 2 0 01-2 2H53a2 2 0 01-2-2z" fill="#f472b6" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />

      {/* Skirt */}
      <path d="M34 78l-4 14h40l-4-14z" fill="#0d9488" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />

      {/* Arms */}
      <rect x="24" y="64" width="9" height="22" rx="4.5" fill="#14b8a6" stroke={INK} strokeWidth="2.6" />
      <rect x="67" y="62" width="9" height="22" rx="4.5" fill="#14b8a6" stroke={INK} strokeWidth="2.6" transform="rotate(18 71.5 73)" />
      <circle cx="28.5" cy="88" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />
      <circle cx="76" cy="86" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />

      {/* Paintbrush in raised hand */}
      <path d="M79 84l7-11" stroke="#a16207" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M86 73l3-5" stroke="#f97316" strokeWidth="4.6" strokeLinecap="round" />

      {/* Torso */}
      <path d="M35 60h30a4 4 0 014 4v16H31V64a4 4 0 014-4z" fill="#14b8a6" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M41 68l1.4 2.8 3 .4-2.2 2.1.5 3-2.7-1.4-2.7 1.4.5-3-2.2-2.1 3-.4z" fill="#fde047" />
      <path d="M58 72l1.4 2.8 3 .4-2.2 2.1.5 3-2.7-1.4-2.7 1.4.5-3-2.2-2.1 3-.4z" fill="#fde047" />

      {/* Ears */}
      <circle cx="25" cy="40" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />
      <circle cx="75" cy="40" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />

      {/* Head */}
      <ellipse cx="50" cy="38" rx="25" ry="24" fill={skin} stroke={INK} strokeWidth="2.8" />

      <Face browColor="#7c2d12" mouth="smile" />

      {/* Bob hair */}
      <path
        d="M50 8C34 8 23 20 23 38v18c3-3 5-9 5-16 6 5 15 4 20-3 5 7 14 8 20 3 0 7 2 13 5 16V38C73 20 66 8 50 8z"
        fill="#8b4513"
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* Hair clip */}
      <path d="M64 22l7 3-7 3z" fill="#fde047" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

/** Rio — the explorer. Orange cap, scarf, green shorts. */
export function KidExplorer({ className }: CharacterProps) {
  const skin = '#f7d7b8'

  return (
    <svg viewBox="0 0 100 120" className={className} role="img" aria-label="Boy character wearing a cap">
      {/* Legs */}
      <rect x="39" y="88" width="9" height="18" rx="4.5" fill={skin} stroke={INK} strokeWidth="2.6" />
      <rect x="52" y="88" width="9" height="18" rx="4.5" fill={skin} stroke={INK} strokeWidth="2.6" />

      {/* Shoes */}
      <path d="M36 104h13v6a2 2 0 01-2 2H38a2 2 0 01-2-2z" fill="#a16207" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M51 104h13v6a2 2 0 01-2 2H53a2 2 0 01-2-2z" fill="#a16207" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />

      {/* Shorts */}
      <path d="M34 78h32v12a2 2 0 01-2 2H36a2 2 0 01-2-2z" fill="#16a34a" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M34 80h32" stroke={INK} strokeWidth="2.2" />

      {/* Arms */}
      <rect x="24" y="64" width="9" height="22" rx="4.5" fill="#fef3c7" stroke={INK} strokeWidth="2.6" />
      <rect x="67" y="64" width="9" height="22" rx="4.5" fill="#fef3c7" stroke={INK} strokeWidth="2.6" />
      <circle cx="28.5" cy="88" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />
      <circle cx="71.5" cy="88" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />

      {/* Torso */}
      <path d="M35 62h30a4 4 0 014 4v14H31V66a4 4 0 014-4z" fill="#fef3c7" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />

      {/* Belt */}
      <rect x="31" y="74" width="38" height="6" fill="#78350f" stroke={INK} strokeWidth="2.2" />
      <rect x="46" y="74" width="8" height="6" fill="#fbbf24" stroke={INK} strokeWidth="2" />

      {/* Scarf */}
      <path d="M38 60h24l-4 8H42z" fill="#f97316" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M58 66l6 12-8-4z" fill="#ea580c" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />

      {/* Ears */}
      <circle cx="25" cy="40" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />
      <circle cx="75" cy="40" r="5" fill={skin} stroke={INK} strokeWidth="2.6" />

      {/* Head */}
      <ellipse cx="50" cy="38" rx="25" ry="24" fill={skin} stroke={INK} strokeWidth="2.8" />

      <Face browColor="#78350f" mouth="smile" />

      {/* Hair peeking under the cap */}
      <path d="M26 32c2-10 10-16 24-16s22 6 24 16c-4-2-8 0-10 3-4-5-10-6-14-2-4-4-11-3-14 2-3-3-7-4-10-3z" fill="#7c3f00" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />

      {/* Cap crown */}
      <path d="M27 26c0-13 10-20 23-20s23 7 23 20z" fill="#f97316" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M50 6v20" stroke={INK} strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="6" r="3.4" fill="#fbbf24" stroke={INK} strokeWidth="2.4" />

      {/* Cap brim */}
      <path d="M25 26h50a5 5 0 010 8H25a4 4 0 010-8z" fill="#ea580c" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
    </svg>
  )
}

/** Comic starburst badge — for POW! / NEW! style callouts. */
export function BurstBadge({
  label,
  className,
  fill = '#fde047',
}: CharacterProps & { label: string; fill?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <path
          d="M60 3l9 17 18-11-2 21 21 2-14 16 17 12-20 7 8 20-21-4-3 21-13-16-14 16-3-21-21 4 8-20-20-7 17-12-14-16 21-2-2-21 18 11z"
          fill={fill}
          stroke="#1e1b4b"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <text
          x="60"
          y="60"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#1e1b4b"
          fontSize="24"
          fontWeight="800"
          fontFamily="var(--font-display), sans-serif"
        >
          {label}
        </text>
      </svg>
    </span>
  )
}

/** Halftone dot texture — the printed-comic paper feel. */
export function HalftoneDots({ className, color = '#ffffff' }: CharacterProps & { color?: string }) {
  // Rendered once per comic panel, so the pattern id has to be unique per instance.
  const patternId = `halftone-${useId()}`

  return (
    <svg className={className} aria-hidden="true">
      <defs>
        <pattern id={patternId} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill={color} />
          <circle cx="7" cy="7" r="1.6" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
