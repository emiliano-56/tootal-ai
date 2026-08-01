
'use client'

import {
  Home,
  Wand2,
  Film,
  BookOpen,
  Users,
  PaletteIcon,
  Coins,
  Layers,
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
} from 'lucide-react'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'

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
    items: [{ icon: Home, label: 'Dashboard', href: '/dashboard' }],
  },
  {
    heading: 'AI Agents',
    items: [
      { icon: Rocket, label: 'Business Agent', href: '/business-agent', badge: 'NEW' },
      { icon: Wand2, label: 'Story to Comic', href: '/comic-agent', badge: 'NEW' },
      { icon: Film, label: 'Comic to Video', href: '/comic-video', badge: 'NEW' },
      { icon: ImagePlus, label: 'Cover Designer', href: '/cover-designer', badge: 'NEW' },
      { icon: Globe, label: 'Landing Pages', href: '/landing-pages', badge: 'NEW' },
      { icon: Megaphone, label: 'Marketing', href: '/marketing', badge: 'NEW' },
      { icon: Sparkles, label: 'Prompt Studio', href: '/prompt-studio', badge: 'NEW' },
    ],
  },
  {
    heading: 'Create',
    items: [
      { icon: BookOpen, label: 'Comic Generator', href: '/comic' },
      { icon: PaletteIcon, label: 'Coloring Book', href: '/coloring' },
      { icon: Video, label: 'Video Generator', href: '/video' },
      { icon: ImagePlus, label: 'Book Cover', href: '/cover' },
      { icon: Users, label: 'Generate Prompt', href: '/chat' },
    ],
  },
  {
    heading: 'Library',
    items: [
      { icon: FolderOpen, label: 'My Comics', href: '/my-comics' },
      { icon: History, label: 'History', href: '/history', badge: 'NEW' },
      { icon: BarChart3, label: 'Analytics', href: '/analytics' },
      { icon: Layers, label: 'DFY Content Packs', href: '/dfy-prompts' },
    ],
  },
  {
    heading: 'Account',
    items: [
      { icon: Coins, label: 'My Credits', href: '/credits' },
      { icon: BadgeDollarSign, label: 'Reseller', href: '/reseller' },
      { icon: ShieldCheck, label: 'White Label', href: '/white-labels' },
      { icon: HelpCircle, label: 'Support', href: '/support' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  const [userPlan, setUserPlan] = useState('')

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
   <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 z-40">
  {/* Logo */}
  <div className="p-6 border-b border-gray-200 flex items-center gap-3">
    <img
      src="./nlogo2.png "
      alt="ComicTale AI Logo"
      className="w-10 h-10 rounded-full object-cover"
    />

    <div>
      <h1 className="font-bold text-black text-sm">ComicTale AI</h1>
      <p className="text-xs text-gray-500">
        Create, Launch, Inspire.
      </p>
    </div>
  </div>

  {/* Menu */}
  <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
    {menuGroups.map((group, gi) => (
      <div key={gi} className="space-y-0.5">
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
              prefetch={true}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium',
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />

              <span className="flex-1 text-left truncate">{item.label}</span>

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
  )
}

