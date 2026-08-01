'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LogOut, Plus, Zap, Users, ChevronDown, Eye, EyeOff } from 'lucide-react'

interface User {
  id: string
  email: string
  credits: number
  plans: string
  created_at: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'search' | 'add' | 'topup' | 'reset'>('search')
  
  // Search User states
  const [searchEmail, setSearchEmail] = useState('')
  const [searchedUser, setSearchedUser] = useState<User | null>(null)
  
  // Add New User states
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserCredits, setNewUserCredits] = useState('100')
  const [newUserPlan, setNewUserPlan] = useState('Front End Comic Tale AI FE')
  
  // Top Up states
  const [selectedUserForCredit, setSelectedUserForCredit] = useState<string | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [topupUserPlan, setTopupUserPlan] = useState('')
  
  // Dropdown states
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false)
  const [topupPlanDropdownOpen, setTopupPlanDropdownOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  // UI states
  const [showPassword, setShowPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Reset Password states
  const [resetEmail, setResetEmail] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)

  useEffect(() => {
    checkAdminStatus()
  }, [])

  const checkAdminStatus = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user && user.email === 'toon15vg@gmail.com') {
        setIsAuthenticated(true)
        fetchUsers()
      }
    } catch (error) {
      console.error('[v0] Error checking admin status:', error)
    }
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      })

      if (error) {
        setErrorMessage(error.message || 'Login failed')
        setTimeout(() => setErrorMessage(''), 3000)
        return
      }

      // Check if user is admin (email must be toon15vg@gmail.com)
      if (data?.user?.email !== 'toon15vg@gmail.com') {
        setErrorMessage('Only admin users can access this dashboard')
        setTimeout(() => setErrorMessage(''), 3000)
        await supabase.auth.signOut()
        return
      }

      setIsAuthenticated(true)
      setSuccessMessage('Admin logged in successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      fetchUsers()
    } catch (error) {
      console.error('[v0] Login error:', error)
      setErrorMessage('An unexpected error occurred during login')
      setTimeout(() => setErrorMessage(''), 3000)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, credits, plans, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }
      setUsers(data || [])
    } catch (error) {
      console.error('[v0] Error fetching users:', error)
      setErrorMessage('Failed to fetch users')
      setTimeout(() => setErrorMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserEmail || !newUserPassword || !newUserPlan) {
      setErrorMessage('Please fill in all fields')
      setTimeout(() => setErrorMessage(''), 3000)
      return
    }

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          credits: parseInt(newUserCredits),
          plan: newUserPlan,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to create user')
        setTimeout(() => setErrorMessage(''), 3000)
      } else {
        setSuccessMessage('New user added successfully!')
        setTimeout(() => setSuccessMessage(''), 3000)
        setNewUserEmail('')
        setNewUserPassword('')
        setNewUserCredits('100')
        setNewUserPlan('Front End Comic Tale AI FE')
        fetchUsers()
      }
    } catch (error) {
      console.error('[v0] Error creating user:', error)
      setErrorMessage('Failed to create user')
      setTimeout(() => setErrorMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchUser = async () => {
    if (!searchEmail) {
      setErrorMessage('Please enter an email to search')
      setTimeout(() => setErrorMessage(''), 3000)
      return
    }

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const user = users.find(u => u.email.toLowerCase() === searchEmail.toLowerCase())
      if (user) {
        setSearchedUser(user)
        setSuccessMessage('User found')
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        setSearchedUser(null)
        setErrorMessage('User not found')
        setTimeout(() => setErrorMessage(''), 3000)
      }
    } catch (error) {
      console.error('[v0] Error searching user:', error)
      setErrorMessage('Failed to search user')
      setTimeout(() => setErrorMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCredits = async () => {
    if (!selectedUserForCredit || !creditAmount) {
      setErrorMessage('Please select user and enter credit amount')
      setTimeout(() => setErrorMessage(''), 3000)
      return
    }

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const response = await fetch('/api/admin/add-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserForCredit,
          amount: parseFloat(creditAmount),
          plan: topupUserPlan || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to add credits')
        setTimeout(() => setErrorMessage(''), 3000)
      } else {
        setSuccessMessage('Credits added successfully!')
        setTimeout(() => setSuccessMessage(''), 3000)
        setCreditAmount('')
        setSelectedUserForCredit(null)
        setTopupUserPlan('')
        fetchUsers()
      }
    } catch (error) {
      console.error('[v0] Error adding credits:', error)
      setErrorMessage('Failed to add credits')
      setTimeout(() => setErrorMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      setIsAuthenticated(false)
      setAdminEmail('')
      setAdminPassword('')
      setSuccessMessage('Logged out successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('[v0] Logout error:', error)
      setErrorMessage('Failed to logout')
      setTimeout(() => setErrorMessage(''), 3000)
    }
  }

  const handleResetPassword = async () => {
    if (!resetEmail || !resetPassword) {
      setErrorMessage('Enter email and password')
      setTimeout(() => setErrorMessage(''), 3000)
      return
    }

    setResetLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch(
        '/api/admin/reset-password',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: resetEmail,
            password: resetPassword,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || 'User not found or reset failed')
        setTimeout(() => setErrorMessage(''), 3000)
        return
      }

      setSuccessMessage(
        'Password reset successfully!'
      )

      setResetEmail('')
      setResetPassword('')

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      setErrorMessage('Failed to reset password')
      setTimeout(() => setErrorMessage(''), 3000)
    } finally {
      setResetLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-3xl font-bold text-foreground mb-8 text-center">Admin Login</h1>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="toon15vg@gmail.com"
                disabled={isLoggingIn}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isLoggingIn}
              />
            </div>
            <Button type="submit" disabled={isLoggingIn} className="w-full">
              {isLoggingIn ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  const totalUsers = users.length
  const totalCredits = users.reduce((sum, user) => sum + user.credits, 0)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Messages */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-700 dark:text-green-400 text-sm">
            ✓ {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
            ✕ {errorMessage}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-foreground">Admin Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                <p className="text-3xl font-bold text-foreground">{totalUsers}</p>
              </div>
              <Users className="w-12 h-12 text-primary opacity-20" />
            </div>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Credits</p>
                <p className="text-3xl font-bold text-foreground">{totalCredits.toLocaleString()}</p>
              </div>
              <Zap className="w-12 h-12 text-green-500 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-4 border-b border-border">
            <button
              onClick={() => setActiveTab('search')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'search'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Search User
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'add'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Add New User
            </button>
            <button
              onClick={() => setActiveTab('topup')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'topup'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Add/Top Up Credits
            </button>

            <button
              onClick={() => setActiveTab('reset')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'reset'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Reset Password
            </button>
          </div>
        </div>

        {/* Search User Tab */}
        {activeTab === 'search' && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-6">Search User Details</h2>
            <div className="space-y-6">
              <div className="flex gap-3">
                <Input
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="Enter user email..."
                  disabled={loading}
                  className="flex-1"
                />
                <Button onClick={handleSearchUser} disabled={loading} className="px-6">
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>

              {searchedUser && (
                <div className="bg-secondary rounded-lg p-6 space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-lg font-semibold text-foreground">{searchedUser.email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Credits</p>
                      <p className="text-lg font-semibold text-foreground">{searchedUser.credits}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Plan</p>
                      <p className="text-lg font-semibold text-foreground capitalize">{searchedUser.plans || 'free'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Account Created</p>
                    <p className="text-foreground">{new Date(searchedUser.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Add New User Tab */}
        {activeTab === 'add' && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-6">Add New User</h2>
            <form onSubmit={handleAddUser} className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Initial Credits</label>
                <Input
                  type="number"
                  value={newUserCredits}
                  onChange={(e) => setNewUserCredits(e.target.value)}
                  placeholder="100"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Plan</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPlanDropdownOpen(!planDropdownOpen)}
                    disabled={loading}
                    className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 flex items-center justify-between"
                  >
                    <span className="capitalize">{newUserPlan}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {planDropdownOpen && (
                    <div className="absolute z-10 left-full ml-2 top-0 w-48 bg-secondary border border-border rounded-lg shadow-lg">
                      {['Comic Tale AI FE', ' Comic Tale AI Unlimited', 'Comic Tale AI DFY', 'Comic Tale AI Traffic', 'Comic Tale AI Enterprise', 'Comic Tale AI Agency', 'Comic Tale AI MegaSuite'].map((plan) => (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => {
                            setNewUserPlan(plan)
                            setPlanDropdownOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-primary/10 capitalize first:rounded-t-lg last:rounded-b-lg"
                        >
                          {plan}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </Card>
        )}

        {/* Top Up Credits Tab */}
        {activeTab === 'topup' && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-6">Add/Top Up Credits</h2>
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Select User</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    disabled={loading}
                    className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 flex items-center justify-between text-left"
                  >
                    <span>{selectedUserForCredit ? users.find(u => u.id === selectedUserForCredit)?.email : 'Choose a user...'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {userDropdownOpen && (
                    <div className="absolute z-10 left-full ml-2 top-0 w-64 bg-secondary border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {users.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserForCredit(user.id)
                            setUserDropdownOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-primary/10 first:rounded-t-lg last:rounded-b-lg text-sm"
                        >
                          {user.email} (Credits: {user.credits})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Credit Amount</label>
                <Input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="50"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Update Plan (Optional)</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTopupPlanDropdownOpen(!topupPlanDropdownOpen)}
                    disabled={loading}
                    className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 flex items-center justify-between"
                  >
                    <span className="capitalize">{topupUserPlan || 'Keep current plan'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {topupPlanDropdownOpen && (
                    <div className="absolute z-10 left-full ml-2 top-0 w-48 bg-secondary border border-border rounded-lg shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setTopupUserPlan('')
                          setTopupPlanDropdownOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-primary/10 first:rounded-t-lg"
                      >
                        Keep current plan
                      </button>
                      {['Comic Tale AI FE', ' Comic Tale AI Unlimited', 'Comic Tale AI DFY', 'Comic Tale AI Traffic', 'Comic Tale AI Enterprise', 'Comic Tale AI Agency', 'Comic Tale AI MegaSuite'].map((plan) => (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => {
                            setTopupUserPlan(plan)
                            setTopupPlanDropdownOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-primary/10 last:rounded-b-lg capitalize"
                        >
                          {plan}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={handleAddCredits} disabled={loading} className="w-full">
                {loading ? 'Adding...' : 'Add Credits'}
              </Button>
            </div>
          </Card>
        )}

        {activeTab === 'reset' && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Reset User Password
            </h2>

            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  User Email
                </label>

                <Input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New Password
                </label>

                <div className="relative">
                  <Input
                    type={showResetPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) =>
                      setResetPassword(e.target.value)
                    }
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowResetPassword(!showResetPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showResetPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="w-full"
              >
                {resetLoading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
