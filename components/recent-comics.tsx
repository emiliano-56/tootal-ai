'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MoreVertical, ChevronRight, Palette } from 'lucide-react'
import Link from 'next/link'

const coloringPages = [
  {
    id: 1,
    title: 'Cute Cat',
    pages: 1,
    createdAt: '2h ago',
    image: '/coloring-1.jpg',
  },
  {
    id: 2,
    title: 'Butterfly Wings',
    pages: 1,
    createdAt: '1d ago',
    image: '/coloring-2.jpg',
  },
  {
    id: 3,
    title: 'Happy Robot',
    pages: 1,
    createdAt: '2d ago',
    image: '/coloring-3.jpg',
  },
  {
    id: 4,
    title: 'Magic Unicorn',
    pages: 1,
    createdAt: '3d ago',
    image: '/coloring-4.jpg',
  },
]

export function RecentComics() {
  return (
    <section className="mb-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Palette className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Coloring</h2>
        </div>
        <Link href="#" className="text-primary hover:underline text-sm font-semibold flex items-center gap-1">
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {coloringPages.map((coloring) => (
          <Card key={coloring.id} className="bg-secondary border-border overflow-hidden hover:border-primary transition-colors group cursor-pointer">
            {/* Coloring Image */}
            <div className="h-48 relative overflow-hidden group-hover:scale-105 transition-transform">
              <img
                src={coloring.image}
                alt={coloring.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Coloring Info */}
            <div className="p-4 space-y-3">
              <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {coloring.title}
              </h3>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{coloring.pages} Page</span>
                <span>Created {coloring.createdAt}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-primary hover:bg-primary/10 font-medium"
              >
                Start Coloring
              </Button>
            </div>

            {/* Menu Button */}
            <button className="absolute top-3 right-3 p-2 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4" />
            </button>
          </Card>
        ))}
      </div>
    </section>
  )
}
