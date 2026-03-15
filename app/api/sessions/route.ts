import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')

    let query = supabase
      .from('mse_sessions')
      .select('*')
      .eq('clinician_id', user.id)
      .order('created_at', { ascending: false })

    if (patientId) query = query.eq('patient_id', patientId)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ sessions: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { data, error } = await supabase
      .from('mse_sessions')
      .insert({ ...body, clinician_id: user.id, status: 'recording' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ session: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
