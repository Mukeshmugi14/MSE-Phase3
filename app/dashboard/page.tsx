'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Patient, MSESession } from '@/types'

interface Stats { total: number; thisWeek: number; highRisk: number }

function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, string> = {
    none: 'risk-none', low: 'risk-low', moderate: 'risk-moderate',
    high: 'risk-high', imminent: 'risk-imminent',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${map[risk] || 'risk-none'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"/>
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </span>
  )
}

export default function Dashboard() {
  const [patients, setPatients]       = useState<Patient[]>([])
  const [sessions, setSessions]       = useState<MSESession[]>([])
  const [stats, setStats]             = useState<Stats>({ total: 0, thisWeek: 0, highRisk: 0 })
  const [clinicianName, setClinicianName] = useState('')
  const [loading, setLoading]         = useState(true)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const [{ data: profile }, { data: pts }, { data: sess }] = await Promise.all([
        supabase.from('clinician_profiles').select('*').eq('id', user.id).single(),
        supabase.from('patients').select('*').eq('clinician_id', user.id).order('created_at', { ascending: false }),
        supabase.from('mse_sessions').select('*').eq('clinician_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])

      setClinicianName(profile?.full_name || user.email || '')
      setPatients(pts || [])
      setSessions(sess || [])

      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      const thisWeek = (sess || []).filter(s => new Date(s.created_at) > weekAgo).length
      const highRisk = (sess || []).filter(s =>
        s.risk_assessment?.suicide_risk === 'high' ||
        s.risk_assessment?.suicide_risk === 'imminent' ||
        s.risk_assessment?.violence_risk === 'high'
      ).length

      setStats({ total: pts?.length || 0, thisWeek, highRisk })
      setLoading(false)
    }
    load()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleDeletePatient(id: string) {
    if (!confirm('Are you sure you want to delete this patient? This will also delete all their sessions.')) return
    try {
      const res = await fetch(`/api/patients/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete patient')
      setPatients(prev => prev.filter(p => p.id !== id))
      setSessions(prev => prev.filter(s => s.patient_id !== id))
      // Refresh stats
      setStats(prev => ({ ...prev, total: prev.total - 1 }))
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleDeleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation() // Prevent navigating to the report
    if (!confirm('Are you sure you want to delete this session?')) return
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete session')
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream-100)' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 rounded-full mx-auto mb-4 animate-spin"
             style={{ borderColor: 'rgba(11,110,79,0.2)', borderTopColor: 'var(--teal-600)' }}/>
        <p className="text-sm" style={{ color: 'rgba(13,31,56,0.5)' }}>Loading clinical dashboard…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream-100)' }}>
      {/* Nav */}
      <nav className="bg-white border-b px-8 py-4 flex items-center justify-between"
           style={{ borderColor: 'rgba(13,31,56,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: 'var(--teal-600)' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 3a2 2 0 110 4 2 2 0 010-4zm0 10.4c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="white"/>
            </svg>
          </div>
          <span className="font-display text-lg font-medium" style={{ color: 'var(--navy-900)' }}>AI-MSE</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--teal-400)', color: 'white', opacity: 0.9 }}>
            Beta
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm font-medium" style={{ color: 'var(--navy-900)' }}>Dr. {clinicianName.split('@')[0]}</p>
            <p className="text-xs" style={{ color: 'rgba(13,31,56,0.45)' }}>Psychiatrist</p>
          </div>
          <button onClick={signOut} className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'rgba(13,31,56,0.5)', border: '1px solid rgba(13,31,56,0.12)' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--cream-200)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-10 animate-in">
          <div>
            <h1 className="font-display text-4xl font-light mb-1" style={{ color: 'var(--navy-900)' }}>
              Clinical Dashboard
            </h1>
            <p className="text-sm" style={{ color: 'rgba(13,31,56,0.5)' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => router.push('/patients/new')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
            style={{ background: 'var(--teal-600)' }}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--teal-400)')}
            onMouseOut={e => (e.currentTarget.style.background = 'var(--teal-600)')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            New Patient
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-5 mb-10 stagger">
          {[
            { label: 'Total patients', value: stats.total,    sub: 'registered',       color: 'var(--teal-600)' },
            { label: 'Sessions this week', value: stats.thisWeek, sub: 'assessments',  color: 'var(--navy-800)' },
            { label: 'High-risk alerts', value: stats.highRisk,   sub: 'require review', color: 'var(--risk-high)' },
          ].map(s => (
            <div key={s.label} className="card p-6 animate-in">
              <p className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: 'rgba(13,31,56,0.45)' }}>
                {s.label}
              </p>
              <p className="font-display text-4xl font-light mb-1" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-xs" style={{ color: 'rgba(13,31,56,0.4)' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-6">
          {/* Patient list */}
          <div className="col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-medium" style={{ color: 'var(--navy-900)' }}>Patients</h2>
              <span className="text-xs" style={{ color: 'rgba(13,31,56,0.4)' }}>{patients.length} total</span>
            </div>
            <div className="card overflow-hidden">
              {patients.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                       style={{ background: 'var(--cream-200)' }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <circle cx="11" cy="7" r="4" stroke="rgba(13,31,56,0.3)" strokeWidth="1.5"/>
                      <path d="M3 19c0-4 3.58-6 8-6s8 2 8 6" stroke="rgba(13,31,56,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="text-sm mb-1 font-medium" style={{ color: 'var(--navy-900)' }}>No patients yet</p>
                  <p className="text-xs mb-5" style={{ color: 'rgba(13,31,56,0.45)' }}>Register your first patient to begin an AI-MSE session</p>
                  <button onClick={() => router.push('/patients/new')}
                          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                          style={{ color: 'var(--teal-600)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
                    Register patient
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(13,31,56,0.08)' }}>
                      {['Patient', 'Age', 'Presenting complaint', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium tracking-wide uppercase"
                            style={{ color: 'rgba(13,31,56,0.4)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((p, i) => (
                      <tr key={p.id}
                          style={{ borderBottom: i < patients.length - 1 ? '1px solid rgba(13,31,56,0.06)' : 'none' }}
                          className="transition-colors"
                          onMouseOver={e => (e.currentTarget.style.background = 'var(--cream-50)')}
                          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                                 style={{ background: 'var(--teal-600)' }}>
                              {p.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium" style={{ color: 'var(--navy-900)' }}>{p.full_name}</p>
                              <p className="text-xs" style={{ color: 'rgba(13,31,56,0.4)' }}>{p.gender}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5" style={{ color: 'rgba(13,31,56,0.7)' }}>{p.age}</td>
                        <td className="px-5 py-3.5 max-w-[160px]">
                          <p className="truncate text-xs" style={{ color: 'rgba(13,31,56,0.6)' }}>
                            {p.presenting_complaint}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const sb = createClient()
                                const { data: { user } } = await sb.auth.getUser()
                                const { data: sess } = await sb.from('mse_sessions').insert({
                                  patient_id: p.id, clinician_id: user!.id, status: 'recording',
                                }).select().single()
                                if (sess) router.push(`/session/${sess.id}?patientId=${p.id}`)
                              }}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                              style={{ color: 'var(--teal-600)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}
                              onMouseOver={e => (e.currentTarget.style.background = 'var(--teal-100)')}
                              onMouseOut={e => (e.currentTarget.style.background = 'var(--teal-50)')}>
                              Start MSE
                            </button>
                              <button
                                onClick={() => router.push(`/patients/${p.id}`)}
                                className="p-1.5 rounded-lg text-black/20 hover:text-purple-600 hover:bg-purple-50 transition-all"
                                title="Patient Trends & Longitudinal Data"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M18.5 9l-5 5-3-3-4.5 4.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => router.push(`/patients/${p.id}/edit`)}
                                className="p-1.5 rounded-lg text-black/20 hover:text-teal-600 hover:bg-teal-50 transition-all"
                                title="Edit Patient"
                              >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeletePatient(p.id)}
                              className="p-1.5 rounded-lg text-black/20 hover:text-risk-high hover:bg-risk-high/5 transition-all"
                              title="Delete Patient"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recent sessions */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-medium" style={{ color: 'var(--navy-900)' }}>Recent sessions</h2>
            </div>
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-sm" style={{ color: 'rgba(13,31,56,0.4)' }}>No sessions yet</p>
                </div>
              ) : sessions.slice(0, 6).map(s => {
                const patient = patients.find(p => p.id === s.patient_id)
                return (
                  <div key={s.id}
                       className="card p-4 cursor-pointer transition-all"
                       onClick={() => router.push(`/report/${s.id}`)}
                       onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                       onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                    <div className="flex items-start justify-between mb-2">
                       <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--navy-900)' }}>
                          {patient?.full_name || 'Unknown patient'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.risk_assessment && (
                          <RiskBadge risk={s.risk_assessment.suicide_risk || 'none'} />
                        )}
                        <button
                          onClick={(e) => handleDeleteSession(e, s.id)}
                          className="p-1 rounded-md text-black/10 hover:text-risk-high hover:bg-risk-high/5 transition-all"
                          title="Delete Session"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs mb-2 line-clamp-2" style={{ color: 'rgba(13,31,56,0.5)' }}>
                      {s.clinical_summary || 'Assessment in progress…'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'rgba(13,31,56,0.35)' }}>
                        {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {s.overall_severity > 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{
                                background: s.overall_severity > 70 ? '#FEE2E2' : s.overall_severity > 40 ? '#FEF3C7' : '#ECFDF5',
                                color: s.overall_severity > 70 ? 'var(--risk-high)' : s.overall_severity > 40 ? 'var(--risk-med)' : 'var(--risk-low)',
                              }}>
                          Severity {s.overall_severity}/100
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
