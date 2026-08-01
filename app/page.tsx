'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { signIn } from '@/lib/db'

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
  <div className="min-h-screen bg-gradient-to-br from-white via-white to-blue-50 flex items-center justify-center p-4">
  {/* Background decorative elements */}
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-20 right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
    <div className="absolute bottom-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
  </div>

  <div className="w-full max-w-md z-10">
    {/* Logo and Header */}
    <div className="text-center mb-8">
      <img
        src="./nlogo2.png"
        alt="ComicTale AI Logo"
        className="w-32 h-32 mx-auto mb-4 rounded-full object-cover"
      />

      {/* <h1 className="text-3xl font-bold text-black mb-2">
        ToonTale AI
      </h1> */}

      <p className="text-gray-600">
        Create, Launch, Inspire.
      </p>
    </div>

    {/* Login Form Card */}
    <div className="bg-white border border-gray-200 rounded-xl p-8 space-y-6 shadow-xl">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-black">
          Welcome Back
        </h2>

        <p className="text-gray-500 text-sm">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-black"
          >
            Email Address
          </label>

          <div className="relative">
            <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />

            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-colors"
              required
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-black"
          >
            Password
          </label>

          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />

            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-colors"
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400 hover:text-blue-600 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Remember Me */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 bg-white border cursor-pointer accent-blue-600"
            />
            <span className="text-gray-600">
              Remember me
            </span>
          </label>

          <Link
            href="/support-1"
            className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
          >
            Forgot Password?
          </Link>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 mt-6"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>

    {/* Footer */}
    <div className="text-center text-xs text-gray-500 mt-6 space-y-1">
      <p>
        <Link href="#" className="hover:text-blue-600 hover:underline">
          Terms of Service
        </Link>

        {" • "}

        <Link href="#" className="hover:text-blue-600 hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  </div>
</div>
  )
}
