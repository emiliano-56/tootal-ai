
'use client'

import {
  Bell,
  Menu,
  Zap,
  LogOut,
  Mail,
  KeyRound,
  X,
  Eye,
  EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import { supabase, signOut } from '@/lib/db'
import { useMobileNav } from '@/components/mobile-nav-context'
import { usePlanLabel } from '@/components/entitlements-context'
import { LocaleSwitcher } from '@/components/locale-switcher'

export function Header() {
  const { open: openMobileNav } = useMobileNav()

  const [userEmail, setUserEmail] = useState('Comic Creator')
  const [userLetter, setUserLetter] = useState('C')  // From user_plans, not the old free-text profiles.plans column.
  const userPlan = usePlanLabel()

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isEmailTooltipOpen, setIsEmailTooltipOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // GET CURRENT USER
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        // GET PROFILE
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error(' Profile fetch error:', error)
          return
        }

        if (data) {
          // EMAIL
          if (data.email) {
            setUserEmail(data.email)

            // FIRST LETTER
            setUserLetter(
              data.email.charAt(0).toUpperCase()
            )
          }
        }
      } catch (error) {
        console.error('[v0] Header user fetch error:', error)
      }
    }

    fetchUserProfile()
  }, [])

  // CLOSE DROPDOWN WHEN CLICKING OUTSIDE
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // LOGOUT
  const handleLogout = async () => {
    try {
      await signOut()

      window.location.href = '/'
    } catch (error) {
      console.error('[v0] Logout error:', error)
      alert('Failed to logout')
    }
  }

  // CHANGE PASSWORD
  const handleChangePassword = async () => {
    try {
      setPasswordError('')
      setPasswordSuccess('')

      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        setPasswordError('Please fill all fields')
        return
      }

      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match')
        return
      }

      if (newPassword.length < 6) {
        setPasswordError(
          'Password must be at least 6 characters'
        )
        return
      }

      setPasswordLoading(true)

      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user?.email) {
        throw new Error('User not found')
      }

      const { error: verifyError } =
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword
        })

      if (verifyError) {
        setPasswordError('Current password is incorrect')
        return
      }

      const { error } =
        await supabase.auth.updateUser({
          password: newPassword
        })

      if (error) throw error

      setPasswordSuccess(
        'Password updated successfully'
      )

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        setIsPasswordModalOpen(false)
        setPasswordSuccess('')
      }, 1500)
    } catch (error: any) {
      setPasswordError(
        error.message || 'Failed to update password'
      )
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <header className="fixed top-0 end-0 start-0 md:start-64 bg-white border-b border-gray-200 h-16 z-[1000]">
    <style>{`
        @keyframes pulse-green {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
        .animate-pulse-green {
          animation: pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div className="h-full px-6 flex items-center justify-between">

        {/* Left Side */}
        <div className="flex items-center gap-4 flex-1">
          <button
            type="button"
            onClick={openMobileNav}
            aria-label="Open menu"
            className="md:hidden text-foreground p-1 -ml-1 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Empty Space */}
          <div className="hidden md:flex flex-1 max-w-md"></div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">

          {/* Interface language. Sits before the plan badge so it reads as a
              setting for the whole app rather than an account detail. */}
          <LocaleSwitcher />

          {/* Current plan */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white rounded-lg">
            <Zap className="w-4 h-4 text-blue-600" />

            <span className="text-sm font-semibold text-black">
              {userPlan}
            </span>
          </div>

          {/* Notification */}
          <Button
            size="icon"
            variant="ghost"
            className="text-black hover:bg-blue-700 relative"
          >
            <Bell className="w-5 h-5" />

            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
          </Button>

          {/* Avatar + Dropdown */}
          <div className="relative z-30" ref={dropdownRef}>

            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                setIsDropdownOpen(!isDropdownOpen)
              }
              className="text-black hover:bg-blue-700 w-10 h-10 rounded-full"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white font-bold">
                {userLetter}
              </div>
            </Button>

            {/* Dropdown */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">

                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="text-sm font-semibold text-black">
                    {userEmail}
                  </p>

                  <p className="text-xs text-gray-500">
                    {userPlan}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setIsDropdownOpen(false)
                    setIsPasswordModalOpen(true)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-black hover:bg-gray-100 transition-colors"
                >
                  <KeyRound className="w-4 h-4" />

                  Change Password
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500  transition-colors"
                >
                  <LogOut className="w-4 h-4" />

                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Email Icon with Tooltip */}
          <div className="relative hidden sm:block">
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                setIsEmailTooltipOpen(!isEmailTooltipOpen)
              }
              className="text-black hover:bg-blue-700 relative"
            >
              <Mail className="w-5 h-5" />

              <span className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse-green"></span>
            </Button>

            {/* Email Tooltip */}
            {isEmailTooltipOpen && (
              <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 z-50 whitespace-nowrap">
                <p className="text-xs text-black font-medium">
                  {userEmail}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md p-6">

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-black">
                Change Password
              </h2>

              <button
                onClick={() => {
                  setIsPasswordModalOpen(false)
                  setPasswordError('')
                  setPasswordSuccess('')
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">

              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) =>
                    setCurrentPassword(e.target.value)
                  }
                  className="w-full px-4 py-3 pr-10 bg-white border border-gray-200 rounded-lg text-black"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowCurrentPassword(!showCurrentPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value)
                  }
                  className="w-full px-4 py-3 pr-10 bg-white border border-gray-200 rounded-lg text-black"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowNewPassword(!showNewPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  className="w-full px-4 py-3 pr-10 bg-white border border-gray-200 rounded-lg text-black"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {passwordError && (
                <div className="text-sm text-red-500">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="text-sm text-green-500">
                  {passwordSuccess}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">

                <Button
                  variant="outline"
                  onClick={() =>
                    setIsPasswordModalOpen(false)
                  }
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleChangePassword}
                  disabled={passwordLoading}
                >
                  {passwordLoading
                    ? 'Updating...'
                    : 'Update Password'}
                </Button>

              </div>

            </div>
          </div>
        </div>
      )}
    </header>
  )
}

