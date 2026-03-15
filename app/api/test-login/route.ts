import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Admin client for backend operations
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Public client for performing the actual sign-in
    const supabasePublic = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const testPassword = 'TestingPassword123!'

    // 1. Ensure user exists and is confirmed via Admin API
    console.log(`[TestLogin] Ensuring user exists: ${email}`)
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    const existingUser = userList.users.find(u => u.email === email)

    if (!existingUser) {
      console.log(`[TestLogin] Creating new test user: ${email}`)
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true
      })
      if (createError) throw createError
    } else {
      console.log(`[TestLogin] User already exists: ${existingUser.id}`)
      // Update password just in case it's different
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: testPassword })
    }

    // 2. Perform the actual sign-in with the Public client (uses Anon Key)
    console.log(`[TestLogin] Signing in user: ${email}`)
    const { data: signInData, error: signInError } = await supabasePublic.auth.signInWithPassword({
      email,
      password: testPassword
    })

    if (signInError) {
      console.error('[TestLogin] SignIn Error:', signInError)
      throw signInError
    }

    // 3. Upsert clinician profile via Admin Client
    console.log(`[TestLogin] Upserting profile for: ${signInData.user.id}`)
    const { error: profileError } = await supabaseAdmin.from('clinician_profiles').upsert({
      id: signInData.user.id,
      email: signInData.user.email!,
      full_name: signInData.user.email!.split('@')[0],
      role: 'psychiatrist',
      hospital: 'General Hospital',
      registration_number: 'MCI-00000',
    }, { onConflict: 'id' })

    if (profileError) {
      console.error('[TestLogin] Profile Upsert Error:', profileError)
      // We don't necessarily want to fail login if profile upsert fails, but let's log it
    }

    // 4. Set cookies and return session
    const res = NextResponse.json({ 
      user: signInData.user, 
      session: signInData.session 
    })

    // Manual cookie setting for @supabase/ssr
    const cookieOptions = { 
      path: '/', 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: signInData.session.expires_in
    }

    res.cookies.set('sb-jyewfipikrrsjgmvpcgu-auth-token.0', signInData.session.access_token, cookieOptions)
    res.cookies.set('sb-jyewfipikrrsjgmvpcgu-auth-token.1', signInData.session.refresh_token, cookieOptions)

    console.log('[TestLogin] Login successful')
    return res
    
  } catch (error: any) {
    console.error('[TestLogin] Fatal Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Login failed',
      details: error.description || error.code || ''
    }, { status: 500 })
  }
}
