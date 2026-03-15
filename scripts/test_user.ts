import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jyewfipikrrsjgmvpcgu.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_AvZnJj-WyT022ej56fQ6IQ_Ac6oMwFq' // We use the Anon key as a fallback but this must be the service role

console.log('Testing connection with URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function run() {
  try {
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'mytestmail7@hospital.com',
      password: 'TestingPassword123!'
    })

    if (signInError && signInError.message.includes('Invalid login credentials')) {
      console.log('Creating new user...')
      const { data, error } = await supabase.auth.admin.createUser({
        email: 'mytestmail7@hospital.com',
        password: 'TestingPassword123!',
        email_confirm: true
      })
      if (error) throw error
      console.log('User created:', data.user.id)

      console.log('Upserting profile...')
      const { error: profileError } = await supabase.from('clinician_profiles').upsert({
        id: data.user.id,
        email: data.user.email!,
        full_name: 'mytestmail7',
        role: 'psychiatrist',
        hospital: 'General Hospital',
        registration_number: 'MCI-00000',
      })
      if (profileError) throw profileError
      
      console.log('Success')
    } else if (signInError) {
      throw signInError
    } else {
      console.log('Logged in existing user:', user?.id)
    }
  } catch (err) {
    console.error('Failed test:', err)
  }
}

run()
