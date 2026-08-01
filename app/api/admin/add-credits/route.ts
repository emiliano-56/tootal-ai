import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { userId, amount, plan } = body

    const parsedAmount = Number(amount)

    console.log('[v0] Incoming body:', body)

    // Validate input
    if (!userId || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      )
    }

    // Fetch current user profile
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('credits, plans')
      .eq('id', userId)
      .single()

    console.log('[v0] Profile:', profile)
    console.log('[v0] Fetch error:', fetchError)

    if (fetchError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Calculate new credits
    const currentCredits = Number(profile.credits || 0)
    const newCredits = currentCredits + parsedAmount

    // Prepare update object
    const updateData: any = {
      credits: newCredits,
    }

    // Only update plan if selected
    if (plan && plan.trim() !== '') {
      updateData.plans = plan
    }

    console.log('[v0] Update data:', updateData)

    // Update profile
    const { data: updatedProfile, error: updateError } =
      await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()

    console.log('[v0] Updated profile:', updatedProfile)
    console.log('[v0] Update error:', updateError)

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message || 'Failed to update credits',
        },
        { status: 400 }
      )
    }

    // Insert admin log (optional)
    const { error: logError } = await supabaseAdmin
      .from('admin_logs')
      .insert({
        action: 'ADD_CREDITS',
        target_user_id: userId,
        details: {
          amount: parsedAmount,
          newCredits,
          plan: plan || profile.plans,
        },
      })

    console.log('[v0] Log error:', logError)

    return NextResponse.json(
      {
        success: true,
        message: 'Credits added successfully',
        newCredits,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[v0] Add credits route error:', error)

    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}

