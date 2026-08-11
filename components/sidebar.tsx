
'use client'

import {
  Home,
  Wand2,
  Film,
  BookOpen,
  Users,
  PaletteIcon,
  Coins,
  HelpCircle,
  ImagePlus,
  ArrowUpCircle,
  BadgeDollarSign,
  ShieldCheck,
  BarChart3,
  Sparkles,
  Rocket,
  Globe,
  Megaphone,
  Video,
  FolderOpen,
  History,
  X,
  Lock,
  Package,
  Bot,
  Share2,
  KeyRound,
  UsersRound,
  Puzzle,
  BookMarked,
  Layers3,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { FEATURE_KEYS } from '@/lib/plans/entitlements'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import { useMobileNav } from '@/components/mobile-nav-context'
import { useEntitlements } from '@/components/entitlements-context'
import { useT } from '@/components/locale-provider'

/**
 * `label` is a catalogue key rather than the text itself, so the nav
 * translates. The badges deliberately are not: "NEW" and "OTO 2" are the same
 * in every language, and "OTO 2" is a product name besides.
 */
interface MenuItem {
  icon: typeof Home
  label: string
  href: string
  badge?: string
}

interface MenuGroup {
  heading?: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    items: [{ icon: Home, label: 'nav.dashboard', href: '/dashboard' }],
  },
  {
    heading: 'nav.group.agents',
    items: [
      { icon: Rocket, label: 'nav.businessAgent', href: '/business-agent', badge: 'NEW' },
      { icon: Wand2, label: 'nav.storyToComic', href: '/comic-agent', badge: 'NEW' },
      { icon: Film, label: 'nav.comicToVideo', href: '/comic-video', badge: 'NEW' },
      { icon: ImagePlus, label: 'nav.coverDesigner', href: '/cover-designer', badge: 'NEW' },
      { icon: Globe, label: 'nav.landingPages', href: '/landing-pages', badge: 'NEW' },
      { icon: Megaphone, label: 'nav.marketing', href: '/marketing', badge: 'NEW' },
      { icon: Sparkles, label: 'nav.promptStudio', href: '/prompt-studio', badge: 'NEW' },
    ],
  },
  // What OTO 2 and OTO 3 buy. Given a heading of their own rather than being
  // filed under Library, because each is the whole reason its tier exists —
  // buried in a list they would look like another bonus.
  {
    heading: 'nav.group.dfy',
    items: [
      { icon: Package, label: 'nav.dfyBusinesses', href: '/dfy-business', badge: 'OTO 2' },
      { icon: Bot, label: 'nav.autopilot', href: '/autopilot', badge: 'OTO 3' },
      // Not gated: sharing by hand is for everyone, and only Autopilot needs
      // the connections to be automatic.
      { icon: Share2, label: 'nav.connections', href: '/connections' },
    ],
  },
  {
    heading: 'nav.group.create',
    items: [
      { icon: BookOpen, label: 'nav.comicGenerator', href: '/comic' },
      { icon: PaletteIcon, label: 'nav.coloringBook', href: '/coloring' },
      { icon: Video, label: 'nav.videoGenerator', href: '/video' },
      { icon: ImagePlus, label: 'nav.bookCover', href: '/cover' },
      { icon: Users, label: 'nav.generatePrompt', href: '/chat' },
      // Sits under Create rather than Library: a character is something you
      // make and then use, not something you file away.
      { icon: UsersRound, label: 'nav.characters', href: '/characters', badge: 'NEW' },
      // Costs no generations at all, which is worth it being visible rather
      // than buried inside the colouring book flow.
      { icon: Puzzle, label: 'nav.activities', href: '/activities', badge: 'NEW' },
    ],
  },
  {
    heading: 'nav.group.library',
    items: [
      { icon: FolderOpen, label: 'nav.myComics', href: '/my-comics' },
      { icon: History, label: 'nav.history', href: '/history', badge: 'NEW' },
      { icon: BarChart3, label: 'nav.analytics', href: '/analytics' },
      // Everything between a finished book and a listed one.
      { icon: BookMarked, label: 'nav.publish', href: '/publish', badge: 'NEW' },
      { icon: Layers3, label: 'nav.batch', href: '/batch', badge: 'NEW' },
    ],
  },
  {
    heading: 'nav.group.account',
    items: [
      { icon: Coins, label: 'nav.myPlan', href: '/credits' },
      { icon: BadgeDollarSign, label: 'nav.reseller', href: '/reseller-program' },
      { icon: ShieldCheck, label: 'nav.whiteLabel', href: '/white-labels' },
      { icon: HelpCircle, label: 'nav.support', href: '/support' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isOpen, close } = useMobileNav()
  const { limits, personalKeys } = useEntitlements()
  const t = useT()

  // Only when the platform owner has switched personal keys on. A screen that
  // says "nothing to set up" is worse than no screen: it invites a customer to
  // go looking for a setting that does not exist for them.
  const groups = personalKeys
    ? menuGroups.map((group) =>
        group.heading === 'nav.group.account'
          ? {
              ...group,
              items: [
                ...group.items.slice(0, 1),
                { icon: KeyRound, label: 'nav.myAiKeys', href: '/api-keys' },
                ...group.items.slice(1),
              ],
            }
          : group
      )
    : menuGroups

  const [userPlan, setUserPlan] = useState('')

  // Close the drawer whenever navigation lands on a new page.
  useEffect(() => {
    close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Escape closes the drawer, and the page behind it must not scroll while open.
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, close])

  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data, error } = await supabase
          .from('profiles')
          .select('plans')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('[v0] Plan fetch error:', error)
          return
        }

        if (data?.plans) {
          setUserPlan(data.plans)
        }
      } catch (error) {
        console.error('[v0] Sidebar error:', error)
      }
    }

    fetchUserPlan()
  }, [])

  const getUpgradeData = () => {
    switch (userPlan) {
      case 'ToonTale AI Studio':
        return {
          label: 'Upgrade to Page Booster',
          url: 'https://example.com/page-booster',
        }

      case 'ToonTale AI Page Booster':
        return {
          label: 'Upgrade to DFY Library',
          url: 'https://example.com/dfy-library',
        }

      case 'ToonTale AI DFY Story & Coloring Library':
        return {
          label: 'Upgrade to Mega Pack',
          url: 'https://example.com/mega-pack',
        }

      default:
        return null
    }
  }

  const upgradeData = getUpgradeData()

  return (
   <>
  {/* Mobile backdrop */}
  <div
    onClick={close}
    aria-hidden="true"
    className={cn(
      'md:hidden fixed inset-0 z-[1090] bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300',
      isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
    )}
  />

   <aside
     className={cn(
       // Logical properties, not physical: in Arabic, Hebrew, Urdu and Persian
       // the whole shell flips, and a sidebar pinned to `left` would sit on
       // top of the content instead of beside it. `border-e` and `start-0`
       // follow the writing direction; the closed transform has to be spelled
       // out per direction because translate-x has no logical form.
       'flex flex-col w-64 bg-white border-e border-gray-200 h-screen fixed start-0 top-0 z-[1100] md:z-40 transition-transform duration-300 ease-out md:translate-x-0',
       isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full rtl:translate-x-full'
     )}
   >
  {/* Logo */}
  <div className="p-6 border-b border-gray-200 flex items-center gap-3">
    <img
      src="/nlogo2.png"
      alt="ComicAgent AI Logo"
      className="w-10 h-10 rounded-full object-cover"
    />

    <div className="flex-1 min-w-0">
      <h1 className="font-bold text-black text-sm">ComicAgent AI</h1>
      <p className="text-xs text-gray-500">
        {t('nav.tagline')}
      </p>
    </div>

    {/* Close — mobile only */}
    <button
      type="button"
      onClick={close}
      aria-label={t('nav.closeMenu')}
      className="md:hidden -mr-2 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
    >
      <X className="w-5 h-5" />
    </button>
  </div>

  {/* Menu */}
  <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
    {groups.map((group, gi) => (
      <div key={gi} className="space-y-0.5">
        {group.heading && (
          <p className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {t(group.heading)}
          </p>
        )}

        {group.items.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          // A tool is locked when the plan does not grant it at all. Running
          // out for the month is a different thing and stays unlocked.
          const feature = item.href.replace(/^\//, '')
          const gated = FEATURE_KEYS.includes(feature as never)
          const locked = gated && !(feature in limits)

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium',
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />

              <span className="flex-1 text-left truncate">{t(item.label)}</span>

              {locked && (
                <Lock
                  className="w-3.5 h-3.5 shrink-0 opacity-60"
                  aria-label={t('nav.lockedHint')}
                />
              )}

              {item.badge && (
                <span
                  className={cn(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                    isActive ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-700'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    ))}
  </nav>

  {/* Upgrade Button */}
  {upgradeData && (
    <div className="p-4 border-t border-gray-200">
      <button
        onClick={() => window.open(upgradeData.url, '_blank')}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
      >
        <ArrowUpCircle className="w-5 h-5" />

        {upgradeData.label}
      </button>
    </div>
  )}
</aside>
   </>
  )
}

