'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Menu, X, LogOut, ArrowLeft, ChevronDown, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navFor } from '@/components/console/console-nav'
import { HOME_ROUTE, type Role } from '@/lib/auth/rbac'
import { signOut } from '@/lib/db'
import { ThemeToggle } from '@/components/theme-toggle'

const ROLE_LABEL: Record<Role, string> = {
  superadmin: 'Superadmin Console',
  reseller: 'Reseller Portal',
  white_label: 'White Label Portal',
  user: 'Dashboard',
}

export function ConsoleShell({
  role,
  email,
  tenantName,
  children,
}: {
  role: Role
  email: string | null
  tenantName?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const groups = navFor(role)

  // Close the drawer on navigation, or it stays open over the new page.
  useEffect(() => {
    setDrawerOpen(false)
    setMenuOpen(false)
  }, [pathname])

  // Dismiss the account menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!drawerOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen])

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.href = '/'
    } catch {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
        className={cn(
          'md:hidden fixed inset-0 z-[1090] bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300',
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-[1100] md:z-40 flex flex-col w-64 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-out md:translate-x-0',
          drawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        )}
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <img src="/nlogo2.png" alt="" className="w-9 h-9 rounded-lg object-cover" />

          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-slate-900 dark:text-white text-sm truncate">
              {tenantName || 'ComicTale AI'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {ROLE_LABEL[role]}
            </p>
          </div>

          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="md:hidden -mr-1 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {groups.map((group, index) => (
            <div key={group.heading ?? index} className="space-y-0.5">
              {group.heading && (
                <p className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {group.heading}
                </p>
              )}

              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium',
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <Link
            href={HOME_ROUTE.user}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
            Back to app
          </Link>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="fixed top-0 right-0 left-0 md:left-64 h-16 z-[1000] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="md:hidden p-1 -ml-1 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1" />

          <ThemeToggle compact />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors max-w-[60vw] sm:max-w-none"
            >
              <span className="hidden sm:block text-sm text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                {email}
              </span>
              <span className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {(email?.[0] ?? '?').toUpperCase()}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {email}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {ROLE_LABEL[role]}
                    {tenantName ? ` · ${tenantName}` : ''}
                  </p>
                </div>

                <Link
                  href={HOME_ROUTE.user}
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  Back to app
                </Link>

                <button
                  onClick={handleSignOut}
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border-t border-slate-100 dark:border-slate-800"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="pt-16 md:pl-64">
        <main className="p-4 sm:p-6 lg:p-7 max-w-[1400px]">{children}</main>
      </div>
    </div>
  )
}
