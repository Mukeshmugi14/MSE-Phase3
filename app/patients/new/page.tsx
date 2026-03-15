'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const FIELDS = [
  { group: 'Personal information', fields: [
    { id: 'full_name', label: 'Full name', type: 'text', placeholder: 'Patient full name', required: true, span: 2 },
    { id: 'age',       label: 'Age',       type: 'number', placeholder: '—', required: true },
    { id: 'gender',    label: 'Gender',    type: 'select', options: ['male','female','other'], required: true },
    { id: 'phone',     label: 'Phone',     type: 'tel', placeholder: '+91 00000 00000', span: 2 },
  ]},
  { group: 'Clinical information', fields: [
    { id: 'presenting_complaint',     label: 'Presenting complaint',   type: 'textarea', placeholder: 'Chief complaint in patient\'s own words or referral reason', required: true, span: 2 },
    { id: 'past_psychiatric_history', label: 'Past psychiatric history', type: 'textarea', placeholder: 'Previous diagnoses, hospitalisations, treatments', span: 2 },
    { id: 'past_medical_history',     label: 'Past medical history',    type: 'textarea', placeholder: 'Relevant medical conditions, medications', span: 2 },
    { id: 'substance_use',            label: 'Substance use history',   type: 'textarea', placeholder: 'Tobacco, alcohol, other substances — quantity, frequency, duration', span: 2 },
    { id: 'family_history',           label: 'Family psychiatric history', type: 'textarea', placeholder: 'First or second degree relatives with psychiatric illness', span: 2 },
  ]},
  { group: 'Psychosocial background', fields: [
    { id: 'education',     label: 'Education level',    type: 'text', placeholder: 'Highest qualification' },
    { id: 'occupation',    label: 'Occupation',          type: 'text', placeholder: 'Current or last occupation' },
    { id: 'referral_source', label: 'Referral source',  type: 'text', placeholder: 'GP, OPD, emergency, self', span: 2 },
  ]},
]

export default function NewPatient() {
  const [form, setForm]       = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const router = useRouter()
  const supabase = createClient()

  function set(id: string, val: string) {
    setForm(f => ({ ...f, [id]: val }))
  }

  async function submit() {
    if (!form.full_name || !form.age || !form.gender || !form.presenting_complaint) {
      setError('Please complete all required fields.'); return
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
        presenting_complaint: form.presenting_complaint,
        referral_source: form.referral_source || null,
        past_psychiatric_history: form.past_psychiatric_history || null,
        past_medical_history: form.past_medical_history || null,
        substance_use: form.substance_use || null,
        family_history: form.family_history || null,
        education: form.education || null,
        occupation: form.occupation || null,
        consent_obtained: consent,
      })
      .select()
      .single()

    if (err) { setError(err.message); setLoading(false); return }

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

  const inputClass = `w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-white`
  const inputStyle = { border: '1px solid rgba(13,31,56,0.12)', color: 'var(--navy-900)' }

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream-100)' }}>
      {/* Nav */}
      <nav className="bg-white border-b px-8 py-4 flex items-center gap-4"
           style={{ borderColor: 'rgba(13,31,56,0.08)' }}>
        <button onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 text-sm transition-colors"
                style={{ color: 'rgba(13,31,56,0.5)' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </button>
        <span style={{ color: 'rgba(13,31,56,0.2)' }}>/</span>
        <span className="text-sm font-medium" style={{ color: 'var(--navy-900)' }}>New patient</span>
      </nav>

      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="mb-10 animate-in">
          <h1 className="font-display text-4xl font-light mb-2" style={{ color: 'var(--navy-900)' }}>
            Patient Registration
          </h1>
          <p className="text-sm" style={{ color: 'rgba(13,31,56,0.5)' }}>
            Complete intake form. All information is encrypted and stored securely under DPDP Act 2023.
          </p>
        </div>

        <div className="space-y-8 animate-in">
          {FIELDS.map(group => (
            <div key={group.group} className="card p-6">
              <h3 className="font-display text-lg font-medium mb-5" style={{ color: 'var(--navy-900)' }}>
                {group.group}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {group.fields.map((f: any) => (
                  <div key={f.id} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium mb-1.5 tracking-wide"
                           style={{ color: 'rgba(13,31,56,0.55)' }}>
                      {f.label} {f.required && <span style={{ color: 'var(--risk-high)' }}>*</span>}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        placeholder={f.placeholder}
                        value={form[f.id] || ''}
                        onChange={e => set(f.id, e.target.value)}
                        className={`${inputClass} resize-none`}
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = 'var(--teal-600)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(13,31,56,0.12)')}
                      />
                    ) : f.type === 'select' ? (
                      <select
                        value={form[f.id] || ''}
                        onChange={e => set(f.id, e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = 'var(--teal-600)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(13,31,56,0.12)')}>
                        <option value="">Select…</option>
                        {f.options.map((o: string) => (
                          <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={form[f.id] || ''}
                        onChange={e => set(f.id, e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = 'var(--teal-600)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(13,31,56,0.12)')}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Consent */}
          <div className="card p-6" style={{ border: consent ? '1px solid var(--teal-400)' : undefined }}>
            <label className="flex items-start gap-4 cursor-pointer">
              <div
                className="w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center transition-all"
                style={{
                  background: consent ? 'var(--teal-600)' : 'white',
                  border: consent ? '1px solid var(--teal-600)' : '1px solid rgba(13,31,56,0.2)',
                }}
                onClick={() => setConsent(!consent)}>
                {consent && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--navy-900)' }}>
                  Informed consent obtained
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(13,31,56,0.55)' }}>
                  I confirm that the patient (or their legal guardian) has been informed about this AI-assisted assessment,
                  understood its decision-support nature, and provided written or verbal consent for their clinical data
                  to be processed in accordance with the DPDP Act 2023.
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-4 rounded-xl text-sm"
                 style={{ background: '#FEF2F2', color: 'var(--risk-high)', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button onClick={() => router.push('/dashboard')}
                    className="px-5 py-2.5 rounded-xl text-sm transition-colors"
                    style={{ color: 'rgba(13,31,56,0.5)', border: '1px solid rgba(13,31,56,0.12)' }}>
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: loading ? 'rgba(11,110,79,0.4)' : 'var(--teal-600)' }}>
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 rounded-full animate-spin"
                       style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}/>
                  Saving…
                </>
              ) : 'Register & start MSE session →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
