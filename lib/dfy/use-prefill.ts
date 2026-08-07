'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Seeding a tool from a `?prompt=` link.
 *
 * The DFY library promises "Open in Story to Comic" and means it — the prompt
 * travels in the query and lands in the box. Without this the button would drop
 * the customer on an empty form and make them paste it themselves, which is the
 * work the pack exists to remove.
 *
 * Applied once. Re-running on every render would fight the customer as soon as
 * they edited the field, and re-running on back-navigation would silently undo
 * their changes.
 */
export function usePromptPrefill(apply: (prompt: string) => void, max = 8000) {
  const params = useSearchParams()
  const done = useRef(false)
  // Kept in a ref so a caller that passes an inline arrow does not re-trigger.
  const latest = useRef(apply)

  latest.current = apply

  useEffect(() => {
    if (done.current) return

    const prompt = params.get('prompt')

    if (!prompt) return

    done.current = true

    // Bounded: the query string is user-controlled, and an enormous value would
    // lock the field up rather than fill it.
    latest.current(prompt.slice(0, max))
  }, [params, max])
}
