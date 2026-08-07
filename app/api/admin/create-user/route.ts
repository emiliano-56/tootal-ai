import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getSessionContext } from '@/lib/supabase/server'
import { can } from '@/lib/auth/rbac'

export async function POST(request: NextRequest) {
  try {
    // This route holds the service-role client, which bypasses every RLS
    // policy — so it has to establish the caller's role itself.
    const session = await getSessionContext()

    if (!session || !can(session.role, 'users.create')) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

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
