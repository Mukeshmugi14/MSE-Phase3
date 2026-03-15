'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

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
  }, [id])

  function set(id: string, val: string) {
    setForm(f => ({ ...f, [id]: val }))
  }

  async function submit() {
    if (!form.full_name || !form.age || !form.gender || !form.presenting_complaint) {
      setError('Please complete all required fields.'); return
    }
    setSaving(true); setError('')

    const res = await fetch(`/api/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to update patient')
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
        <span className="text-sm font-medium" style={{ color: 'var(--navy-900)' }}>Edit patient</span>
      </nav>

      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="mb-10 animate-in">
          <h1 className="font-display text-4xl font-light mb-2" style={{ color: 'var(--navy-900)' }}>
            Edit Patient Profile
          </h1>
          <p className="text-sm" style={{ color: 'rgba(13,31,56,0.5)' }}>
            Update clinical information for {form.full_name}.
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
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: saving ? 'rgba(11,110,79,0.4)' : 'var(--teal-600)' }}>
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 rounded-full animate-spin"
                       style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}/>
                  Updating…
                </>
              ) : 'Update patient information →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
