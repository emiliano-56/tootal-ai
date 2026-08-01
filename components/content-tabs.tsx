'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Download } from 'lucide-react'

const comicsData = [
  {
    id: 1,
    title: 'Monster School Madness',
    image: '/hero-comic.jpg',
  },
  {
    id: 2,
    title: 'Superhero Exam Day',
    image: '/hero-comic.jpg',
  },
  {
    id: 3,
    title: 'Teacher Turned Frog',
    image: '/hero-comic.jpg',
  },
  {
    id: 4,
    title: 'Magic School Adventure',
    image: '/hero-comic.jpg',
  },
]

const coloringData = [
  {
    id: 1,
    title: 'Cute Cat',
    image: '/coloring-1.jpg',
  },
  {
    id: 2,
    title: 'Butterfly Wings',
    image: '/coloring-2.jpg',
  },
  {
    id: 3,
    title: 'Happy Robot',
    image: '/coloring-3.jpg',
  },
  {
    id: 4,
    title: 'Magic Unicorn',
    image: '/coloring-4.jpg',
  },
]

export function ContentTabs() {
  const [activeTab, setActiveTab] = useState<'comics' | 'coloring'>('comics')

  const data = activeTab === 'comics' ? comicsData : coloringData

  return (
    <section className="mb-8 space-y-6">
      {/* Tabs */}
      <div className="flex gap-4">
        <button
          onClick={() => setActiveTab('comics')}
          className={`pb-2 font-semibold text-lg border-b-2 transition-colors ${
            activeTab === 'comics'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          Comics
        </button>
        <button
          onClick={() => setActiveTab('coloring')}
          className={`pb-2 font-semibold text-lg border-b-2 transition-colors ${
            activeTab === 'coloring'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          Coloring
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.map((item) => (
          <Card
            key={item.id}
            className="bg-secondary border-border overflow-hidden hover:border-primary transition-colors group cursor-pointer relative"
          >
            {/* Image */}
            <div className="h-48 relative overflow-hidden group-hover:scale-105 transition-transform">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Title and Download - Only visible on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 gap-3">
              <h3 className="font-semibold text-foreground text-center text-sm">
                {item.title}
              </h3>
              <Download className="w-5 h-5 text-primary" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
