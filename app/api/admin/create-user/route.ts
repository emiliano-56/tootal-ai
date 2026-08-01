import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl =  'https://xcsbwpagpvixxwupnmwn.supabase.co'
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhjc2J3cGFncHZpeHh3dXBubXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0Njk2OCwiZXhwIjoyMDk1MDIyOTY4fQ.z17C5sFJXvjlvQK1IQWcF4QHsR2IKr0ky3_XSUdfgSc"

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function POST(request: NextRequest) {
  try {
    const { email, password, credits, plan } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Create user in Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('[v0] Auth error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Create or update profile with credits and plan (UPSERT)
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: authData.user.id,
        email,
        credits: credits || 100,
        plans: plan || 'free',
        is_admin: false,
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      console.error('[v0] Profile error:', profileError)
      // Delete the user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 400 }
      )
    }

    // Log admin action
    const {
      data: { user: adminUser },
    } = await supabase.auth.getUser()
    if (adminUser) {
      await supabase.from('admin_logs').insert({
        admin_id: adminUser.id,
        action: 'CREATE_USER',
        target_user_id: authData.user.id,
        details: { email, credits },
      })
    }

    return NextResponse.json(
      { success: true, message: 'User created successfully', user: authData.user },
      { status: 201 }
    )
  } catch (error) {
    console.error('[v0] Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
