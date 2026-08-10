'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase, signIn, signOut } from '@/lib/db'
import { resolvePortalAccess, resolveRoleFromProfile, type Portal } from '@/lib/auth/portals'

/**
 * Sign-in form, shared by all four portals.
 *
 * After the password is accepted the account's role is read back and checked
 * against the portal. A wrong-door sign-in is torn down rather than redirected,
 * so a plain user who finds /superadmin never holds a live session there.
 */

export function LoginForm({ portal }: { portal: Portal }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { user } = await signIn(email, password)

      // Select the whole row rather than named columns: before migration 002
      // there is no `role` column and asking for it by name fails outright.
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id ?? '')
        .single()

      if (profile?.status === 'suspended') {
        await signOut()
        setError('This account is suspended. Contact support.')
        return
      }

      const access = resolvePortalAccess(portal, resolveRoleFromProfile(profile))

      if (!access.allowed) {
        // Never leave a session behind on a portal the account may not use.
        await signOut()
        setError(access.error ?? 'You cannot sign in here.')
        return
      }

      window.location.href = access.redirectTo ?? '/dashboard'
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const isStaffPortal = portal.role !== null

  return (
    <div className="relative w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      {/* Mobile logo */}
      <div className="lg:hidden text-center mb-8">
        <img src="/nlogo2.png" alt="ComicAgent AI" className="w-20 h-20 mx-auto rounded-2xl object-cover" />
        <p className="font-display mt-3 text-sm font-semibold text-slate-500">
          Create, Launch, Inspire.
        </p>
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 ring-1 ring-indigo-100 text-indigo-700 text-[11px] font-semibold">
        {isStaffPortal ? <ShieldCheck className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
        {portal.badge}
      </div>

      <h2 className="font-display mt-4 text-[2rem] leading-tight font-bold text-slate-900 tracking-tight">
        {portal.title}
      </h2>

      <p className="mt-2 text-sm text-slate-500 leading-6">{portal.subtitle}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-[13px] font-semibold text-slate-700">
            Email Address
          </label>

          <div className="group relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full h-12 pl-11 pr-4 bg-slate-50 rounded-xl text-[15px] text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-[13px] font-semibold text-slate-700">
            Password
          </label>

          <div className="group relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-red-600 text-[13px] animate-in fade-in slide-in-from-top-1 duration-300">
            <AlertCircle className="w-4 h-4 mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[13px]">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-indigo-600" />
            <span className="text-slate-600 group-hover:text-slate-900 transition-colors">Remember me</span>
          </label>

          <Link href="/support-1" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className={`font-display group w-full h-12 rounded-xl text-[15px] font-semibold text-white bg-gradient-to-r ${portal.accent} shadow-[0_12px_28px_-10px_rgba(79,70,229,0.8)] hover:-translate-y-0.5 disabled:opacity-70 disabled:translate-y-0 transition-all duration-300`}
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

      {!isStaffPortal && (
        <p className="mt-7 text-center text-[13px] text-slate-500">
          New to ComicAgent AI?{' '}
          <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            Create an account
          </Link>
        </p>
      )}

      {isStaffPortal && (
        <p className="mt-7 text-center text-[13px] text-slate-500">
          Not a {portal.badge.toLowerCase()}?{' '}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            Go to the main sign-in
          </Link>
        </p>
      )}

      <p className="mt-8 text-center text-[11px] text-slate-400">
        <Link href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</Link>
        {' • '}
        <Link href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link>
      </p>
    </div>
  )
}
