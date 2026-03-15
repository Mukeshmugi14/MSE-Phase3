'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const FIELDS = [
  { group: 'Phase 1: Identity & Eligibility', fields: [
    { id: 'full_name', label: 'Full name', type: 'text', placeholder: 'Patient full name', required: true, span: 2 },
    { id: 'age',       label: 'Age',       type: 'number', placeholder: '—', required: true },
    { id: 'gender',    label: 'Gender',    type: 'select', options: ['male','female','other'], required: true },
    { id: 'phone',     label: 'Phone',     type: 'tel', placeholder: '+91 00000 00000', span: 2 },
    { id: 'ehr_id',    label: 'EHR Registration No. (Optional)', type: 'text', placeholder: 'Internal Hospital ID', span: 2 },
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

export default function EditPatient() {
  const [form, setForm]       = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]     = useState('')
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const initialForm: Record<string, string> = {}
      Object.keys(data).forEach(key => {
        initialForm[key] = data[key]?.toString() || ''
      })
      setForm(initialForm)
      setLoading(false)
    }
    load()
  }, [id, supabase])

  function set(id: string, val: string) {
    setForm(f => ({ ...f, [id]: val }))
  }

  async function submit() {
    if (!form.full_name || !form.age || !form.gender || !form.presenting_complaint) {
      setError('Please complete all required fields.'); return
    }
    setSaving(true); setError('')

    const { error: patchErr } = await supabase
      .from('patients')
      .update(form)
      .eq('id', id)

    if (patchErr) {
      setError(patchErr.message || 'Failed to update patient')
      setSaving(false)
      return
    }

    router.push('/dashboard')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream-100)' }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin"
           style={{ borderColor: 'rgba(13,31,56,0.1)', borderTopColor: 'var(--teal-600)' }}/>
    </div>
  )

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
           <div className="w-2 h-2 rounded-full bg-navy-800" />
           <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--navy-900)' }}>Clinical Record Update</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-16">
        <div className="mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex items-center gap-3 mb-4">
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-navy-600 bg-navy-50 px-3 py-1 rounded-full">Record Modification</span>
             <span className="text-[10px] font-bold text-gray-400">Baseline Enrichment</span>
          </div>
          <h1 className="font-display text-5xl font-black mb-2 tracking-tight" style={{ color: 'var(--navy-900)' }}>
            Calibrate <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-navy-800 italic">Patient Profile</span>
          </h1>
          <p className="text-sm font-medium leading-relaxed max-w-xl" style={{ color: 'rgba(13,31,56,0.45)' }}>
            Refining the digital clinical core for <span className="text-navy-900">{form.full_name}</span>.
            Changes will be reflected in all subsequent longitudinal AI assessments.
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
              Abandon Changes
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex items-center gap-4 px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all shadow-2xl shadow-teal-900/20 active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--teal-600)' }}>
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 rounded-full animate-spin"
                       style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}/>
                  Syncing Modifications…
                </>
              ) : (
                <>
                  Update Clinical Profile
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
