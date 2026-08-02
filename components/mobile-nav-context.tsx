'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * Shared open/close state for the mobile sidebar drawer.
 *
 * Header holds the hamburger button and Sidebar holds the drawer, but they are
 * siblings in the shell layout — so the state lives here instead of in either one.
 */

interface MobileNavValue {
  isOpen: boolean
  open: () => void
  close: () => void
}

const MobileNavContext = createContext<MobileNavValue | null>(null)

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  // Stable identities — Sidebar depends on `close` inside an effect.
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])

  return (
    <MobileNavContext.Provider value={value}>
      {children}
    </MobileNavContext.Provider>
  )
}

export function useMobileNav() {
  const context = useContext(MobileNavContext)

  if (!context) {
    throw new Error('useMobileNav must be used inside MobileNavProvider')
  }

  return context
}
