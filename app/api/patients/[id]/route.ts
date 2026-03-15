import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params
    const body = await req.json()

    const { data, error } = await supabase
      .from('patients')
      .update({
        full_name: body.full_name,
        age: parseInt(body.age),
        gender: body.gender,
        phone: body.phone || null,
        presenting_complaint: body.presenting_complaint,
        referral_source: body.referral_source || null,
        past_psychiatric_history: body.past_psychiatric_history || null,
        past_medical_history: body.past_medical_history || null,
        substance_use: body.substance_use || null,
        family_history: body.family_history || null,
        education: body.education || null,
        occupation: body.occupation || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Update patient error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete patient error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
