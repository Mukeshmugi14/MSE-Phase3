'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const FIELDS = [
  { group: 'Phase 1: Registration & Eligibility', fields: [
    { id: 'full_name', label: 'Full name', type: 'text', placeholder: 'Patient full name', required: true, span: 2 },
    { id: 'age',       label: 'Age',       type: 'number', placeholder: '—', required: true },
    { id: 'gender',    label: 'Gender',    type: 'select', options: ['male','female','other'], required: true },
    { id: 'phone',     label: 'Phone',     type: 'tel', placeholder: '+91 00000 00000', span: 2 },
    { id: 'ehr_id',    label: 'EHR Registration No. (Optional)', type: 'text', placeholder: 'Internal Hospital ID', span: 2 },
    { id: 'eligibility_status', label: 'Screening Eligibility', type: 'select', options: ['pending','eligible','ineligible'], required: true },
  ]},
  { group: 'Phase 1 & 2: Presenting Complaint', fields: [
    { id: 'presenting_complaint',     label: 'Presenting complaint',   type: 'textarea', placeholder: 'Chief complaint in patient\'s own words or referral reason', required: true, span: 2 },
    { id: 'referral_source',          label: 'Referral source',        type: 'text', placeholder: 'GP, OPD, emergency, self', span: 2 },
  ]},
  { group: 'Phase 2: Comprehensive Case History', fields: [
    { id: 'past_psychiatric_history', label: 'Past psychiatric history', type: 'textarea', placeholder: 'Previous diagnoses, hospitalisations, treatments', span: 2 },
    { id: 'past_medical_history',     label: 'Past medical history',    type: 'textarea', placeholder: 'Relevant medical conditions, medications', span: 2 },
    { id: 'substance_use',            label: 'Substance use history',   type: 'textarea', placeholder: 'Tobacco, alcohol, other substances — quantity, frequency, duration', span: 2 },
    { id: 'family_history',           label: 'Family psychiatric history', type: 'textarea', placeholder: 'First or second degree relatives with psychiatric illness', span: 2 },
  ]},
  { group: 'Phase 2: Psychosocial Background', fields: [
    { id: 'education',              label: 'Education level',            type: 'text', placeholder: 'Highest qualification' },
    { id: 'occupation',             label: 'Occupation',                 type: 'text', placeholder: 'Current or last occupation' },
    { id: 'living_situation',       label: 'Living situation',           type: 'text', placeholder: 'Cohabitation, dependents, living conditions', span: 2 },
    { id: 'current_stressors',      label: 'Current stressors',          type: 'textarea', placeholder: 'Financial, relationship, or occupational stress', span: 2 },
    { id: 'legal_history',          label: 'Legal history',              type: 'textarea', placeholder: 'Any pending cases, forensic history', span: 2 },
    { id: 'collateral_information', label: 'Collateral information',     type: 'textarea', placeholder: 'Input from family or caregivers', span: 2 },
  ]},
]

export default function NewPatient() {
  const [form, setForm]       = useState<Record<string, string>>({ eligibility_status: 'pending' })
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const router = useRouter()
  const supabase = createClient()

  function set(id: string, val: string) {
    setForm(f => ({ ...f, [id]: val }))
  }

  async function submit() {
    if (!form.full_name || !form.age || !form.gender || !form.presenting_complaint || !form.eligibility_status) {
      setError('Please complete all required fields (Name, Age, Gender, Complaint, Eligibility).'); return
    }
    if (!consent) { setError('Informed consent must be obtained before registration.'); return }
    setLoading(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: patient, error: err } = await supabase
      .from('patients')
      .insert({
        clinician_id: user.id,
        full_name: form.full_name,
        age: parseInt(form.age),
        gender: form.gender,
        phone: form.phone || null,
        ehr_id: form.ehr_id || null,
        eligibility_status: form.eligibility_status,
        presenting_complaint: form.presenting_complaint,
        referral_source: form.referral_source || null,
        past_psychiatric_history: form.past_psychiatric_history || null,
        past_medical_history: form.past_medical_history || null,
        substance_use: form.substance_use || null,
        family_history: form.family_history || null,
        education: form.education || null,
        occupation: form.occupation || null,
        living_situation: form.living_situation || null,
        current_stressors: form.current_stressors || null,
        legal_history: form.legal_history || null,
        collateral_information: form.collateral_information || null,
        consent_obtained: consent,
        digital_consent_timestamp: new Date().toISOString(),
      })
      .select()
      .single()

    if (err) { setError(`Database Error: ${err.message}`); setLoading(false); return }

    // Create session immediately
    const { data: session } = await supabase
      .from('mse_sessions')
      .insert({ patient_id: patient.id, clinician_id: user.id, status: 'recording' })
      .select().single()

    if (session) {
      router.push(`/session/${session.id}?patientId=${patient.id}`)
    } else {
      router.push('/dashboard')
    }
  }

  const inputClass = `w-full px-5 py-4 rounded-2xl text-sm outline-none transition-all shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-teal-500/50 focus:shadow-xl focus:shadow-teal-900/5`
  const inputStyle = { background: 'white', color: 'var(--navy-900)' }

  return (
    <div className="min-h-screen selection:bg-teal-100 selection:text-teal-900" style={{ background: 'var(--cream-100)' }}>
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50 px-8 py-4 flex items-center justify-between"
           style={{ borderColor: 'rgba(13,31,56,0.05)' }}>
        <button onClick={() => router.push('/dashboard')}
                className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-navy-900"
                style={{ color: 'rgba(13,31,56,0.4)' }}>
          <div className="w-8 h-8 rounded-xl ring-1 ring-gray-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-md transition-all">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          Return to Hub
        </button>
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-teal-500" />
           <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--navy-900)' }}>Secure Intake Pipeline</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-16">
        <div className="mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex items-center gap-3 mb-4">
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-600 bg-teal-50 px-3 py-1 rounded-full">New Registration</span>
             <span className="text-[10px] font-bold text-gray-400">Step 1 of 2: Baseline History</span>
          </div>
          <h1 className="font-display text-5xl font-black mb-2 tracking-tight" style={{ color: 'var(--navy-900)' }}>
            Patient <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-navy-800 italic">Initialization</span>
          </h1>
          <p className="text-sm font-medium leading-relaxed max-w-xl" style={{ color: 'rgba(13,31,56,0.45)' }}>
            Initialise the clinical record using multimodal baseline markers.
            All data is encrypted via <span className="text-navy-900">AES-256</span> and compliant with <span className="text-navy-900">DPDP Act 2023</span>.
          </p>
        </div>

        <div className="space-y-12 animate-in stagger">
          {FIELDS.map((group, gIdx) => (
            <div key={group.group} className="relative">
              {/* Group Header */}
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-10 h-10 rounded-2xl bg-navy-900 flex items-center justify-center text-white text-xs font-black shadow-xl">
                    0{gIdx + 1}
                 </div>
                 <h3 className="font-display text-2xl font-black tracking-tight" style={{ color: 'var(--navy-900)' }}>
                   {group.group.split(': ')[1] || group.group}
                 </h3>
              </div>

              <div className="card p-10 bg-white/60 backdrop-blur-xl border-none shadow-2xl shadow-navy-900/5">
                <div className="grid grid-cols-2 gap-x-8 gap-y-10">
                  {group.fields.map((f: any) => (
                    <div key={f.id} className={`${f.span === 2 ? 'col-span-2' : ''} group`}>
                      <label className="block text-[10px] font-black mb-3 tracking-[0.2em] uppercase transition-colors group-focus-within:text-teal-600"
                             style={{ color: 'rgba(13,31,56,0.4)' }}>
                        {f.label} {f.required && <span className="text-red-500">*</span>}
                      </label>
                      {f.type === 'textarea' ? (
                        <textarea
                          rows={4}
                          placeholder={f.placeholder}
                          value={form[f.id] || ''}
                          onChange={e => set(f.id, e.target.value)}
                          className={`${inputClass} resize-none leading-relaxed italic`}
                          style={inputStyle}
                        />
                      ) : f.type === 'select' ? (
                        <div className="relative">
                          <select
                            value={form[f.id] || ''}
                            onChange={e => set(f.id, e.target.value)}
                            className={`${inputClass} appearance-none cursor-pointer`}
                            style={inputStyle}>
                            <option value="">Select Identity…</option>
                            {f.options.map((o: string) => (
                              <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                            ))}
                          </select>
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                             <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                             </svg>
                          </div>
                        </div>
                      ) : (
                        <input
                          type={f.type}
                          placeholder={f.placeholder}
                          value={form[f.id] || ''}
                          onChange={e => set(f.id, e.target.value)}
                          className={inputClass}
                          style={inputStyle}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Consent — Redesigned */}
          <div className="card p-10 bg-teal-900 text-white relative overflow-hidden shadow-2xl shadow-teal-900/20">
            {/* Abstract glow */}
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/5 blur-[80px] rounded-full" />
            
            <label className="flex items-start gap-8 cursor-pointer relative z-10">
              <div
                className={`w-8 h-8 rounded-xl flex-shrink-0 mt-1 flex items-center justify-center transition-all shadow-inner ${!consent ? 'ring-1 ring-white/20' : ''}`}
                style={{
                  background: consent ? 'white' : 'rgba(255,255,255,0.1)',
                }}
                onClick={() => setConsent(!consent)}>
                {consent && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3 3 7-7" stroke="var(--teal-600)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="font-display text-2xl font-black mb-3 tracking-tight">Clinical Consent Verification</p>
                <p className="text-sm font-medium leading-relaxed opacity-70">
                  I certify that informed consent has been obtained from the patient (or legal guardian). 
                  They have been briefed on the AI-assisted nature of this assessment and the secure 
                  processing of their clinical markers under the <span className="opacity-100 font-black decoration-teal-400 underline underline-offset-4">DPDP Act 2023 framework</span>.
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-6 rounded-3xl text-xs font-black uppercase tracking-widest flex items-center gap-4 animate-shake"
                 style={{ background: '#FFF1F2', color: 'var(--risk-high)', border: '1px solid #FFE4E6' }}>
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
                 </svg>
              </div>
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-8">
            <button onClick={() => router.push('/dashboard')}
                    className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white hover:shadow-md"
                    style={{ color: 'rgba(13,31,56,0.4)', border: '1px solid rgba(13,31,56,0.1)' }}>
              Abandon Intake
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="flex items-center gap-4 px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all shadow-2xl shadow-teal-900/20 active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--teal-600)' }}>
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 rounded-full animate-spin"
                       style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}/>
                  Syncing Core Identity…
                </>
              ) : (
                <>
                  Register & Launch AI-HUD
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
