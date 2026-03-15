import { NextRequest, NextResponse } from 'next/server'
import { runMSEAssessment } from '@/lib/gemini'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  console.log('[API/Assess] Start clinical assessment...')
  try {
    const { sessionId, transcript, facs_data, prosody_data, images } = await req.json()

    // 1. Fetch rich patient context from DB (Phase 2 data)
    const supabase = await createAdminClient()
    const { data: sessionData, error: sessionErr } = await supabase
      .from('mse_sessions')
      .select('patient_id')
      .eq('id', sessionId)
      .single()

    if (sessionErr || !sessionData) {
      throw new Error(`Session not found: ${sessionErr?.message || 'Unknown'}`)
    }

    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .select('*')
      .eq('id', sessionData.patient_id)
      .single()

    if (patientErr || !patient) {
      throw new Error(`Patient history not found: ${patientErr?.message || 'Unknown'}`)
    }

    const enrichedContext = {
      age: patient.age,
      gender: patient.gender,
      presenting_complaint: patient.presenting_complaint,
      past_psychiatric_history: patient.past_psychiatric_history,
      past_medical_history: patient.past_medical_history,
      substance_use: patient.substance_use,
      current_stressors: patient.current_stressors,
      living_situation: patient.living_situation,
      collateral_information: patient.collateral_information
    }

    if (!transcript || transcript.trim().length < 5) {
      console.warn('[API/Assess] Transcript is very short or empty. Proceeding with Vision-Only assessment mode.')
    }

    console.log(`[API/Assess] Running Clinical Intelligence (Ollama/Gemini) for Session ${sessionId} with enriched Phase 2 context...`)
    
    // 2. Run Multimodal MSE assessment (Prioritizes local hardware)
    const result = await runMSEAssessment(transcript, enrichedContext, prosody_data, facs_data, images)
    console.log('[API/Assess] Clinical evaluation result received successfully.')

    // Persist to Supabase
    console.log('[API/Assess] Persisting results to Supabase...')
    const { error: dbErr } = await supabase
      .from('mse_sessions')
      .update({
        assessment:           result.assessment,
        risk_assessment:      result.risk_assessment,
        overall_severity:     result.overall_severity,
        clinical_summary:     result.clinical_summary,
        diagnostic_impression: result.diagnostic_impression,
        facs_data,
        prosody_data,
        status:               'complete',
        updated_at:           new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (dbErr) {
      console.error('[API/Assess] DB Error:', dbErr)
      throw new Error(`Database update failed: ${dbErr.message}`)
    }

    console.log('[API/Assess] Assessment lifecycle complete.')
    return NextResponse.json({ success: true, overall_severity: result.overall_severity })
  } catch (error: any) {
    console.error('[API/Assess] CRITICAL ERROR:', error)
    return NextResponse.json({ error: `Clinical evaluation failing: ${error.message || 'Multimodal AI timeout'}` }, { status: 500 })
  }
}
