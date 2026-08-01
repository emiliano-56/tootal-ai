import { supabase } from './supabase'

export { supabase }

// Auth Types
export interface User {
  id: string
  email: string
  createdAt?: string
}

// =====================================================
// SIGN UP
// =====================================================

export async function signUp(
  email: string,
  password: string,
  username: string
) {
  try {
    // CREATE AUTH USER
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    // REAL SUPABASE ERROR
    if (error) {
      console.error('[v0] Signup error:', error)
      throw error
    }

    // DEBUG LOG
    console.log('[v0] Full signup response:', data)

    // CREATE PROFILE
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: email,
          username: username,
        })

      // PROFILE INSERT ERROR
      if (profileError) {
        console.error(
          '[v0] Profile insert error:',
          profileError
        )

        throw profileError
      }

      console.log('[v0] Profile created successfully')
    }

    console.log('[v0] Signup successful for:', email)

    return data
  } catch (error) {
    console.error('[v0] SignUp error:', error)
    throw error
  }
}

// =====================================================
// SIGN IN
// =====================================================

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[v0] Sign in error:', error.message)

      // Email confirmation check
      if (error.message?.includes('Email not confirmed')) {
        throw new Error(
          'Please check your email to confirm your account before signing in.'
        )
      }

      throw error
    }

    // Extra safety check
    if (data.user && !data.user.email_confirmed_at) {
      throw new Error(
        'Please confirm your email before signing in.'
      )
    }

    console.log('[v0] User signed in successfully:', email)

    return data
  } catch (error) {
    console.error('[v0] SignIn error:', error)
    throw error
  }
}

// =====================================================
// SIGN OUT
// =====================================================

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) throw error
}

// =====================================================
// GET CURRENT USER
// =====================================================

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error) throw error

  return data.user
}

// =====================================================
// GET SESSION
// =====================================================

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()

  if (error) throw error

  return data.session
}