'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Building2,
  Palette,
  Users,
  Smile,
  Grid,
  Paintbrush,
} from 'lucide-react'

const quickCreateItems = [
  {
    icon: Building2,
    label: 'School Type',
    value: 'Magic School',
    route: '/comic', // 👈 replace later
  },
  {
    icon: Palette,
    label: 'Art Style',
    value: 'Comic Cartoon',
    route: '/comic',
  },
  {
    icon: Users,
    label: 'Age Range',
    value: '7-10 Years',
    route: '/comic',
  },
  {
    icon: Smile,
    label: 'Humor Level',
    value: 'Medium',
    route: '/comic',
  },
  {
    icon: Grid,
    label: 'Number of Pages',
    value: '10 Pages',
    route: '/comic',
  },
  {
    icon: Paintbrush,
    label: 'Coloring',
    value: 'Full Color',
    route: '/coloring',
  },
]

export function QuickCreate() {
  const router = useRouter()

  return (
    <section className="mb-8 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-black">Quick Create</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {quickCreateItems.map((item, index) => {
          const Icon = item.icon

          return (
            <button
              key={index}
              onClick={() => router.push(item.route)}
              className="group flex flex-col items-center gap-3 p-4 rounded-lg bg-white border border-gray-200 hover:border-blue-600 transition-all hover:bg-gray-50"
            >
              <Icon className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" />

              <div className="text-center space-y-1">
                <p className="text-xs text-gray-500 font-medium">
                  {item.label}
                </p>
                <p className="text-sm font-semibold text-black group-hover:text-blue-600 transition-colors">
                  {item.value}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <Button
        onClick={() => router.push('/comic')}
        className="w-full bg-blue-600 text-white hover:bg-blue-700 font-semibold py-6 text-lg gap-2"
      >
        ✨ Generate Comic
      </Button>
    </section>
  )
}
