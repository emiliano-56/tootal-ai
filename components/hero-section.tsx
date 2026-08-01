'use client'

import { Button } from '@/components/ui/button'
import { Sparkles, Wand2, BookOpen, Palette, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'

const previewPages = [
  { src: '/hero-comic.jpg', label: 'Page 1', tone: 'from-blue-500 to-indigo-600' },
  { src: '/coloring-4.jpg', label: 'Page 2', tone: 'from-purple-500 to-fuchsia-600' },
  { src: '/coloring-1.jpg', label: 'Page 3', tone: 'from-pink-500 to-rose-600' },
]

export function HeroSection() {
  const router = useRouter()
  const [name, setName] = useState('Creator')

  useEffect(() => {
    const fetchName = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data } = await supabase
          .from('profiles')
          .select('username, email')
          .eq('id', user.id)
          .single()

        const label = data?.username || data?.email?.split('@')[0]

        if (label) {
          setName(label.charAt(0).toUpperCase() + label.slice(1))
        }
      } catch (error) {
        console.error('[v0] HeroSection name fetch error:', error)
      }
    }

    fetchName()
  }, [])

  return (
    <section className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <style>{`
        @keyframes hero-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-9px); }
        }
        @keyframes hero-float-alt {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-7px) rotate(-5deg); }
        }
        @keyframes hero-float-alt2 {
          0%, 100% { transform: translateY(0) rotate(5deg); }
          50% { transform: translateY(7px) rotate(5deg); }
        }
        @keyframes hero-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(20deg); }
        }
        @keyframes hero-glow-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(24px, -18px) scale(1.1); }
        }
        @keyframes mascot-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes mascot-wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-26deg); }
          75% { transform: rotate(8deg); }
        }
        @keyframes mascot-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
        }
        @keyframes bubble-pop {
          0%, 100% { transform: scale(1) rotate(-2deg); }
          50% { transform: scale(1.04) rotate(-2deg); }
        }
        @keyframes bar-fill {
          0% { width: 18%; }
          60%, 100% { width: 100%; }
        }
        @keyframes caret-blink {
          0%, 45% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .hero-float { animation: hero-float 5.5s ease-in-out infinite; }
        .hero-float-alt { animation: hero-float-alt 4.5s ease-in-out infinite; }
        .hero-float-alt2 { animation: hero-float-alt2 5.5s ease-in-out infinite; }
        .hero-twinkle { animation: hero-twinkle 2.6s ease-in-out infinite; }
        .hero-twinkle-delay { animation: hero-twinkle 2.6s ease-in-out infinite 1.3s; }
        .hero-glow-drift { animation: hero-glow-drift 10s ease-in-out infinite; }
        .mascot-bounce { animation: mascot-bounce 2.8s ease-in-out infinite; }
        .mascot-wave { animation: mascot-wave 1.9s ease-in-out infinite; transform-origin: top right; }
        .mascot-blink { animation: mascot-blink 4.5s ease-in-out infinite; }
        .bubble-pop { animation: bubble-pop 2.8s ease-in-out infinite; }
        .bar-fill { animation: bar-fill 4.5s ease-in-out infinite; }
        .caret-blink { animation: caret-blink 1.1s step-end infinite; }
      `}</style>

      <div
        className="relative overflow-hidden rounded-[32px] px-6 py-10 sm:px-12 sm:py-14 min-h-[400px]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 8% 12%, rgba(232,121,249,0.35), transparent 42%), radial-gradient(circle at 92% 88%, rgba(56,189,248,0.35), transparent 45%), linear-gradient(125deg, #312e81 0%, #4f46e5 42%, #7c3aed 72%, #a21caf 100%)',
          boxShadow:
            '0 24px 70px -18px rgba(79,70,229,0.55), inset 0 1px 0 rgba(255,255,255,0.16)',
        }}
      >
        {/* Soft drifting glows */}
        <div className="hero-glow-drift absolute -top-24 -right-16 w-96 h-96 bg-fuchsia-400/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -left-10 w-80 h-80 bg-sky-400/25 rounded-full blur-3xl pointer-events-none" />

        {/* Sparkle accents */}
        <Sparkles className="hero-twinkle absolute top-12 left-[42%] w-4 h-4 text-yellow-200 hidden xl:block" />
        <Sparkles className="hero-twinkle-delay absolute bottom-14 left-[36%] w-3 h-3 text-fuchsia-200 hidden xl:block" />
        <span className="hero-twinkle absolute top-20 right-[6%] w-1.5 h-1.5 bg-yellow-200 rounded-full hidden sm:block" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10 xl:gap-14">

          {/* LEFT CONTENT */}
          <div className="flex-1 w-full min-w-0">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/25 text-white text-xs font-semibold w-fit">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              AI Powered Comic Studio
            </div>

            <h1 className="font-display mt-5 text-[2rem] sm:text-[2.6rem] xl:text-[3.1rem] font-bold leading-[1.1] text-white tracking-tight">
              Welcome back, {name}
              <br />
              <span className="bg-gradient-to-r from-yellow-200 via-pink-200 to-sky-200 bg-clip-text text-transparent">
                Create comics, inspire minds
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-[15px] text-indigo-50/80 leading-7 max-w-lg">
              Describe a story idea, pick an art style, and let AI write, illustrate
              and turn it into a print-ready comic book or coloring page in minutes.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Button
                className="font-display bg-white text-indigo-700 hover:bg-yellow-50 h-12 px-7 text-[15px] font-semibold rounded-xl shadow-[0_10px_24px_-8px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 transition-all"
                onClick={() => router.push('/comic')}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Start Creating
              </Button>

              <Button
                variant="outline"
                className="font-display border-white/25 text-white bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:text-white h-12 px-7 text-[15px] font-semibold rounded-xl"
                onClick={() => router.push('/my-comics')}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                My Library
              </Button>
            </div>

            {/* Feature chips */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-8">
              {['One-click AI', 'Coloring books', 'Comic stories', 'Print ready'].map((chip) => (
                <span key={chip} className="flex items-center gap-1.5 text-xs font-medium text-indigo-50/80">
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT — PRODUCT PREVIEW showing what the tool actually does */}
          <div className="hidden lg:flex flex-1 max-w-[420px] relative h-[340px] items-center justify-center animate-in fade-in slide-in-from-right-8 duration-700 delay-150 fill-mode-both">

            {/* App window mock */}
            <div className="hero-float w-[370px] rounded-2xl overflow-hidden bg-white shadow-[0_28px_60px_-14px_rgba(0,0,0,0.55)] ring-1 ring-black/10">

              {/* Title bar */}
              <div className="h-9 bg-slate-100 flex items-center gap-2 px-3.5 border-b border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-[10px] font-semibold text-slate-500">
                  ComicTale AI · Comic Studio
                </span>
              </div>

              <div className="p-3.5 space-y-3">
                {/* Prompt row */}
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 px-2.5 py-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="text-[11px] text-slate-600 truncate">
                    A brave little astronaut visits a candy planet
                  </span>
                  <span className="caret-blink w-px h-3 bg-indigo-500 shrink-0" />
                </div>

                {/* Generated pages grid */}
                <div className="grid grid-cols-3 gap-2">
                  {previewPages.map((page) => (
                    <div key={page.label} className="relative rounded-lg overflow-hidden ring-1 ring-slate-200 bg-white">
                      <img
                        src={page.src}
                        alt={page.label}
                        className="w-full h-[86px] object-cover"
                      />
                      <div
                        className={`absolute bottom-0 inset-x-0 bg-gradient-to-r ${page.tone} px-1.5 py-0.5`}
                      >
                        <span className="text-[9px] font-semibold text-white">{page.label}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress row */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-slate-700">
                      Generating pages…
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-600">3 / 3</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="bar-fill h-full rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating chip — top left */}
            <div className="hero-float-alt absolute -top-3 -left-7 bg-white rounded-xl shadow-[0_10px_24px_-8px_rgba(0,0,0,0.45)] ring-1 ring-black/5 px-3 py-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
                <Palette className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-[11px] leading-tight">Coloring Book</p>
                <p className="text-[9px] text-slate-500">Print ready</p>
              </div>
            </div>

            {/* Floating chip — bottom right */}
            <div className="hero-float-alt2 absolute -bottom-4 -right-5 bg-white rounded-xl shadow-[0_10px_24px_-8px_rgba(0,0,0,0.45)] ring-1 ring-black/5 px-3 py-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-[11px] leading-tight">AI Comic Story</p>
                <p className="text-[9px] text-slate-500">Written &amp; drawn</p>
              </div>
            </div>

            {/* Mascot with speech bubble */}
            <div className="mascot-bounce absolute -bottom-6 -left-10 z-20">
              <div className="relative w-[58px] h-[58px] rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-[0_10px_22px_-6px_rgba(0,0,0,0.5)] ring-1 ring-white/40 flex items-center justify-center">
                {/* antenna */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-white/70" />
                <div className="hero-twinkle absolute -top-[18px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-yellow-300" />

                {/* face plate */}
                <div className="w-10 h-8 rounded-lg bg-white/95 relative flex items-center justify-center gap-1.5">
                  <div className="mascot-blink w-2 h-2 rounded-full bg-indigo-600" />
                  <div className="mascot-blink w-2 h-2 rounded-full bg-indigo-600" />
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-1.5 rounded-b-full border-b-2 border-indigo-500" />
                </div>

                {/* waving arm */}
                <div className="mascot-wave absolute -right-2.5 top-5 w-4 h-1.5 rounded-full bg-sky-300" />
              </div>

              {/* Speech bubble */}
              <div className="bubble-pop absolute -top-9 left-12 bg-white rounded-xl px-3 py-1.5 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.4)] ring-1 ring-black/5 whitespace-nowrap">
                <p className="text-[11px] font-semibold text-slate-800">Let&apos;s create magic! ✨</p>
                <div className="absolute -bottom-1 left-4 w-2.5 h-2.5 bg-white rotate-45" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
