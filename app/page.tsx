'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, Sparkles, Check, ArrowRight, AlertCircle } from 'lucide-react'
import { signIn } from '@/lib/db'
import { BurstBadge, HalftoneDots } from '@/components/comic-characters'

const comicPanels = [
  {
    src: '/characters/kid-portrait.jpg',
    alt: 'Cartoon boy smiling',
    caption: 'Page 1',
  },
  {
    src: '/characters/kid-adventure.jpg',
    alt: 'Cartoon character running through a jungle',
    caption: 'Page 2',
  },
  {
    src: '/characters/kid-explorer.jpg',
    alt: 'Cartoon boy in a red cap',
    caption: 'Page 3',
  },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await signIn(email, password)

      console.log('[v0] Sign in successful')

      // Navigate to dashboard
      window.location.href = '/dashboard'
    } catch (err: any) {
      console.error('[v0] Sign in error:', err)
      setError(err.message || 'Failed to sign in. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:p-4">
      <style>{`
        @keyframes auth-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-9px); }
        }
        @keyframes auth-float-alt {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-7px) rotate(-5deg); }
        }
        @keyframes auth-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(20deg); }
        }
        @keyframes auth-glow-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(24px, -18px) scale(1.1); }
        }
        @keyframes auth-float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes bubble-pop {
          0%, 100% { transform: scale(1) rotate(-2deg); }
          50% { transform: scale(1.04) rotate(-2deg); }
        }
        @keyframes caret-blink {
          0%, 45% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes auth-bar-fill {
          0% { width: 18%; }
          60%, 100% { width: 100%; }
        }
        @keyframes panel-pop {
          0% { opacity: 0; transform: scale(0.82) translateY(6px); }
          12%, 88% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.82) translateY(6px); }
        }
        .auth-float { animation: auth-float 5.5s ease-in-out infinite; }
        .auth-float-slow { animation: auth-float-slow 4.2s ease-in-out infinite; }
        .auth-float-alt { animation: auth-float-alt 4.5s ease-in-out infinite; }
        .auth-twinkle { animation: auth-twinkle 2.6s ease-in-out infinite; }
        .auth-twinkle-delay { animation: auth-twinkle 2.6s ease-in-out infinite 1.3s; }
        .auth-glow-drift { animation: auth-glow-drift 10s ease-in-out infinite; }
        .bubble-pop { animation: bubble-pop 2.8s ease-in-out infinite; }
        .caret-blink { animation: caret-blink 1.1s step-end infinite; }
        .auth-bar-fill { animation: auth-bar-fill 4.2s ease-in-out infinite; }
        .panel-pop { animation: panel-pop 4.2s ease-in-out infinite both; }

        @media (prefers-reduced-motion: reduce) {
          .auth-float, .auth-float-slow, .auth-float-alt,
          .auth-twinkle, .auth-twinkle-delay,
          .auth-glow-drift, .bubble-pop, .caret-blink {
            animation: none;
          }
          /* Keep the pages visible instead of mid-fade. */
          .panel-pop { animation: none; opacity: 1; transform: none; }
          .auth-bar-fill { animation: none; width: 100%; }
        }
      `}</style>

      <div className="grid lg:grid-cols-[1.05fr_1fr] min-h-screen lg:min-h-[calc(100vh-2rem)] lg:rounded-[32px] overflow-hidden bg-white lg:shadow-[0_24px_70px_-24px_rgba(15,23,42,0.25)] lg:ring-1 lg:ring-slate-200/70">

        {/* ── LEFT — BRAND PANEL ───────────────────────────── */}
        <div
          className="relative hidden lg:flex flex-col justify-between overflow-hidden px-12 py-12"
          style={{
            backgroundImage:
              'radial-gradient(circle at 8% 12%, rgba(232,121,249,0.35), transparent 42%), radial-gradient(circle at 92% 88%, rgba(56,189,248,0.35), transparent 45%), linear-gradient(125deg, #312e81 0%, #4f46e5 42%, #7c3aed 72%, #a21caf 100%)',
          }}
        >
          {/* Soft drifting glows */}
          <div className="auth-glow-drift absolute -top-24 -right-16 w-96 h-96 bg-fuchsia-400/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 -left-10 w-80 h-80 bg-sky-400/25 rounded-full blur-3xl pointer-events-none" />

          {/* Sparkle accents */}
          <Sparkles className="auth-twinkle absolute top-16 right-[18%] w-4 h-4 text-yellow-200" />
          <Sparkles className="auth-twinkle-delay absolute bottom-24 right-[10%] w-3 h-3 text-fuchsia-200" />
          <span className="auth-twinkle absolute top-32 left-[46%] w-1.5 h-1.5 bg-yellow-200 rounded-full" />

          {/* Brand */}
          <div className="relative z-10 flex items-center gap-3">
            <img
              src="/nlogo2.png"
              alt="ComicTale AI"
              className="w-12 h-12 rounded-2xl object-cover bg-white/90 ring-1 ring-white/40 p-1"
            />
            <span className="font-display text-lg font-semibold text-white tracking-tight">
              ComicTale AI
            </span>
          </div>

          {/* Headline + preview */}
          <div className="relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/25 text-white text-xs font-semibold w-fit">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              AI Powered Comic Studio
            </div>

            <h1 className="font-display mt-5 text-[2.4rem] xl:text-[2.9rem] font-bold leading-[1.1] text-white tracking-tight">
              Create, Launch,
              <br />
              <span className="bg-gradient-to-r from-yellow-200 via-pink-200 to-sky-200 bg-clip-text text-transparent">
                Inspire.
              </span>
            </h1>

            <p className="mt-4 text-[15px] text-indigo-50/80 leading-7 max-w-md">
              Sign in to your studio and turn a single story idea into an
              illustrated comic book, coloring pages or a video — in minutes.
            </p>

            {/* Studio window — the comic pages get "generated" inside it */}
            <div className="relative mt-10 max-w-[420px]">
              <div className="auth-float rounded-2xl overflow-hidden bg-white shadow-[0_28px_60px_-14px_rgba(0,0,0,0.55)] ring-1 ring-black/10">

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
                  {/* Prompt row with typing caret */}
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 px-2.5 py-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-[11px] text-slate-600 truncate">
                      Three friends discover a secret comic world
                    </span>
                    <span className="caret-blink w-px h-3 bg-indigo-500 shrink-0" />
                  </div>

                  {/* Generated comic pages — each pops in on a delay */}
                  <div className="grid grid-cols-3 gap-2">
                    {comicPanels.map((panel, index) => (
                      <div
                        key={panel.caption}
                        className="panel-pop rounded-lg overflow-hidden border-2 border-indigo-950 bg-white"
                        style={{ animationDelay: `${index * 1.4}s` }}
                      >
                        <div className="relative h-[92px] overflow-hidden">
                          <img
                            src={panel.src}
                            alt={panel.alt}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 w-full h-full object-cover"
                          />

                          {/* Halftone + ink wash keep the photos reading as printed comic art */}
                          <HalftoneDots className="absolute inset-0 w-full h-full opacity-20 mix-blend-overlay" color="#ffffff" />
                          <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/25 to-transparent" />
                        </div>

                        {/* Caption strip */}
                        <div className="border-t-2 border-indigo-950 bg-amber-50 py-0.5">
                          <p className="font-display text-[8px] font-bold text-indigo-950 text-center uppercase tracking-wide">
                            {panel.caption}
                          </p>
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
                      <div className="auth-bar-fill h-full rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Speech bubble */}
              <div className="bubble-pop absolute -top-7 -left-4 bg-white rounded-2xl px-3.5 py-2 border-[3px] border-indigo-950 shadow-[0_10px_22px_-8px_rgba(0,0,0,0.5)]">
                <p className="font-display text-[11px] font-bold text-indigo-950 whitespace-nowrap">
                  Let&apos;s make a comic!
                </p>
                <div className="absolute -bottom-[9px] left-6 w-3.5 h-3.5 bg-white border-b-[3px] border-r-[3px] border-indigo-950 rotate-45" />
              </div>

              {/* POW! burst */}
              <BurstBadge
                label="POW!"
                className="auth-float-alt absolute -top-9 -right-7 w-[74px] h-[74px] drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]"
              />

              {/* Floating panel card, tucked behind the window */}
              <div className="auth-float-slow absolute -bottom-8 -right-12 hidden xl:block w-[104px] rounded-xl overflow-hidden border-[3px] border-indigo-950 bg-white rotate-6 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.55)]">
                <img
                  src="/characters/kid-indoors.jpg"
                  alt="Cartoon boy standing in a room"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-[92px] object-cover"
                />
                <div className="border-t-[3px] border-indigo-950 bg-amber-50 py-0.5">
                  <p className="font-display text-[8px] font-bold text-indigo-950 text-center uppercase tracking-wide">
                    Page 4
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature chips */}
          <div className="relative z-10 flex flex-wrap gap-x-5 gap-y-2">
            {['One-click AI', 'Coloring books', 'Comic stories', 'Print ready'].map((chip) => (
              <span key={chip} className="flex items-center gap-1.5 text-xs font-medium text-indigo-50/80">
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* ── RIGHT — SIGN IN FORM ─────────────────────────── */}
        <div className="relative flex items-center justify-center px-5 py-12 sm:px-10 bg-white overflow-hidden">
          {/* Mobile background wash */}
          <div className="lg:hidden absolute -top-24 -right-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="lg:hidden absolute -bottom-24 -left-20 w-72 h-72 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">

            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <img
                src="/nlogo2.png"
                alt="ComicTale AI"
                className="w-20 h-20 mx-auto rounded-2xl object-cover"
              />
              <p className="font-display mt-3 text-sm font-semibold text-slate-500">
                Create, Launch, Inspire.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 ring-1 ring-indigo-100 text-indigo-700 text-[11px] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Welcome back
            </div>

            <h2 className="font-display mt-4 text-[2rem] leading-tight font-bold text-slate-900 tracking-tight">
              Sign in to your studio
            </h2>

            <p className="mt-2 text-sm text-slate-500 leading-6">
              Pick up right where you left off — your comics are waiting.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-[13px] font-semibold text-slate-700">
                  Email Address
                </label>

                <div className="group relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-indigo-600 transition-colors" />

                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 rounded-xl text-[15px] text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-[13px] font-semibold text-slate-700">
                  Password
                </label>

                <div className="group relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-indigo-600 transition-colors" />

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-11 pr-11 bg-slate-50 rounded-xl text-[15px] text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-red-600 text-[13px] animate-in fade-in slide-in-from-top-1 duration-300">
                  <AlertCircle className="w-4 h-4 mt-px shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Remember me */}
              <div className="flex items-center justify-between text-[13px]">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-indigo-600"
                  />
                  <span className="text-slate-600 group-hover:text-slate-900 transition-colors">
                    Remember me
                  </span>
                </label>

                <Link
                  href="/support-1"
                  className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="font-display group w-full h-12 rounded-xl text-[15px] font-semibold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-700 hover:via-violet-700 hover:to-fuchsia-700 shadow-[0_12px_28px_-10px_rgba(79,70,229,0.8)] hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-12px_rgba(79,70,229,0.9)] disabled:opacity-70 disabled:translate-y-0 transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 mr-2 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Sign up */}
            <p className="mt-7 text-center text-[13px] text-slate-500">
              New to ComicTale AI?{' '}
              <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                Create an account
              </Link>
            </p>

            {/* Footer */}
            <p className="mt-8 text-center text-[11px] text-slate-400">
              <Link href="#" className="hover:text-indigo-600 transition-colors">
                Terms of Service
              </Link>
              {' • '}
              <Link href="#" className="hover:text-indigo-600 transition-colors">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
