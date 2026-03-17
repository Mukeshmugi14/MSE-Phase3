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
  const [error, setError]             = useState('')
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) { router.push('/'); return }

        const [{ data: profile }, { data: pts, error: pErr }, { data: sess, error: sErr }] = await Promise.all([
          supabase.from('clinician_profiles').select('*').eq('id', user.id).single(),
          supabase.from('patients').select('*').eq('clinician_id', user.id).order('created_at', { ascending: false }),
          supabase.from('mse_sessions').select('*').eq('clinician_id', user.id).order('created_at', { ascending: false }).limit(10),
        ])

        if (pErr) throw pErr;
        if (sErr) throw sErr;

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
      } catch (err: any) {
        console.error('Dashboard load error:', err)
        setError(err.message || 'An unexpected error occurred.')
      } finally {
        setLoading(false)
      }
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

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream-100)' }}>
      <div className="text-center max-w-md p-8 card border-red-100">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 className="font-display text-xl font-medium mb-2 text-navy-900">Dashboard Error</h3>
        <p className="text-sm text-red-600 mb-6">{error}</p>
        <button onClick={() => window.location.reload()}
                className="px-6 py-2 rounded-xl text-sm font-medium bg-red-600 text-white shadow-lg shadow-red-600/20">
          Try Again
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen selection:bg-teal-100 selection:text-teal-900" style={{ background: 'var(--cream-100)' }}>
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50 px-8 py-4 flex items-center justify-between"
           style={{ borderColor: 'rgba(13,31,56,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-900/10"
               style={{ background: 'var(--teal-600)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 3a2 2 0 110 4 2 2 0 010-4zm0 10.4c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="white"/>
            </svg>
          </div>
          <div>
            <span className="font-display text-xl font-black tracking-tighter uppercase italic" style={{ color: 'var(--navy-900)' }}>AI-MSE</span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 leading-none">Intelligence Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-sm font-black tracking-tight" style={{ color: 'var(--navy-900)' }}>Dr. {clinicianName.split('@')[0]}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Certified Psychiatrist</p>
          </div>
          <button onClick={signOut} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all hover:bg-red-50 hover:text-red-600 ring-1 ring-gray-100"
                  style={{ color: 'rgba(13,31,56,0.5)' }}>
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">Dashboard v2.0</span>
               <span className="text-[10px] font-bold text-gray-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <h1 className="font-display text-5xl font-black mb-1 p-1 tracking-tight" style={{ color: 'var(--navy-900)' }}>
              Clinical <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-navy-800">Overview</span>
            </h1>
          </div>
          <button
            onClick={() => router.push('/patients/new')}
            className="group flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all shadow-2xl shadow-teal-900/20 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'var(--teal-600)' }}>
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:rotate-90">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            Register New Intake
          </button>
        </div>

        {/* Dynamic Stats Row */}
        <div className="grid grid-cols-3 gap-6 mb-12 stagger">
          {[
            { label: 'Total active baseline', value: stats.total,    sub: 'Total Registered Patients', icon: '👤', color: 'bg-teal-600' },
            { label: 'Evaluation intensity', value: stats.thisWeek, sub: 'Sessions Concluded This Week', icon: '📈', color: 'bg-navy-800' },
            { label: 'Clinical risk alerts', value: stats.highRisk,   sub: 'Critical Cases Requiring Review', icon: '⚠️', color: 'bg-red-600' },
          ].map((s, idx) => (
            <div key={s.label} className="group card p-8 relative overflow-hidden transition-all hover:shadow-2xl hover:shadow-navy-900/5 hover:-translate-y-1">
              <div className={`absolute top-0 right-0 w-32 h-32 opacity-[0.03] transition-transform group-hover:scale-150`}>
                <span className="text-9xl">{s.icon}</span>
              </div>
              <p className="text-[10px] font-black mb-4 tracking-[0.2em] uppercase opacity-40">
                {s.label}
              </p>
              <div className="flex items-baseline gap-4">
                <p className={`font-display text-6xl font-black p-1 tracking-tighter ${idx === 2 && s.value > 0 ? 'text-red-600' : 'text-navy-900'}`}>
                  {s.value}
                </p>
                <div className={`w-2 h-2 rounded-full ${s.color} animate-pulse`} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-4 opacity-40">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Content: Patient Intelligence Table */}
          <div className="col-span-12 lg:col-span-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl font-black tracking-tight" style={{ color: 'var(--navy-900)' }}>Patient Registry</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm">
                   <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                   <span className="text-[10px] font-black uppercase text-gray-400">Database Sync: Active</span>
                </div>
              </div>
            </div>
            
            <div className="card overflow-hidden border-none shadow-xl shadow-navy-100/20">
              {patients.length === 0 ? (
                <div className="p-20 text-center bg-white/60 backdrop-blur-xl">
                  <div className="w-20 h-20 rounded-[32px] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-navy-100/10"
                       style={{ background: 'var(--cream-200)' }}>
                    <svg width="32" height="32" viewBox="0 0 22 22" fill="none">
                      <circle cx="11" cy="7" r="4" stroke="var(--navy-400)" strokeWidth="2"/>
                      <path d="M3 19c0-4 3.58-6 8-6s8 2 8 6" stroke="var(--navy-400)" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <h3 className="font-display text-2xl font-black mb-2" style={{ color: 'var(--navy-900)' }}>Zero Clinical Records</h3>
                  <p className="text-sm font-medium mb-8 max-w-xs mx-auto" style={{ color: 'rgba(13,31,56,0.45)' }}>Initialise your clinical workspace by registering your primary patient cohort.</p>
                  <button onClick={() => router.push('/patients/new')}
                          className="px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white shadow-xl shadow-teal-900/20 transition-all active:scale-95"
                          style={{ background: 'var(--teal-600)' }}>
                    Register First Patient
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left bg-white/60 backdrop-blur-xl">
                    <thead>
                      <tr className="bg-gray-50/50">
                        {['Clinical Identity', 'Attributes', 'Clinical Indicator', 'Operations'].map((h, i) => (
                          <th key={h} className={`px-8 py-5 text-[10px] font-black tracking-[0.2em] uppercase text-gray-400 ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/50">
                      {patients.map((p, i) => (
                        <tr key={p.id}
                            className="group transition-all hover:bg-white/80">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-[22px] flex items-center justify-center text-lg font-black text-white shadow-lg relative overflow-hidden transition-transform group-hover:scale-105"
                                   style={{ background: `linear-gradient(135deg, var(--teal-600), var(--navy-800))` }}>
                                {p.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div>
                                <p className="text-base font-black tracking-tight" style={{ color: 'var(--navy-900)' }}>{p.full_name}</p>
                                <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mt-0.5">EHR-{p.ehr_id || 'LOCAL'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col gap-1">
                               <span className="text-xs font-black text-navy-800">{p.age}Y · <span className="capitalize">{p.gender}</span></span>
                               <span className="text-[10px] font-bold text-gray-400 italic">Registered {new Date(p.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 max-w-[200px]">
                            <p className="text-xs font-medium text-navy-900/60 leading-relaxed line-clamp-2 italic">
                              "{p.presenting_complaint}"
                            </p>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                              <button
                                onClick={async () => {
                                  const sb = createClient()
                                  const { data: { user } } = await sb.auth.getUser()
                                  const { data: sess } = await sb.from('mse_sessions').insert({
                                    patient_id: p.id, clinician_id: user!.id, status: 'recording',
                                  }).select().single()
                                  if (sess) router.push(`/session/${sess.id}?patientId=${p.id}`)
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 ring-1 ring-teal-100 hover:bg-teal-600 hover:text-white transition-all">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path d="M5 3l14 9-14 9V3z" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Start MSE
                              </button>
                               <div className="w-px h-8 bg-gray-100 mx-1" />
                               <button
                                 onClick={() => router.push(`/patients/${p.id}/edit`)}
                                 className="p-3 rounded-xl bg-gray-50 text-gray-400 hover:bg-navy-900 hover:text-white transition-all shadow-sm"
                                 title="Edit Profile">
                                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                   <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                                   <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
                                 </svg>
                               </button>
                               <button
                                 onClick={() => router.push(`/patients/${p.id}`)}
                                 className="p-3 rounded-xl bg-gray-50 text-gray-400 hover:bg-teal-600 hover:text-white transition-all shadow-sm"
                                 title="Patient Analytics">
                                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                   <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/>
                                   <path d="M18.5 9l-5 5-3-3-4.5 4.5" strokeLinecap="round" strokeLinejoin="round"/>
                                 </svg>
                               </button>
                               <button
                                 onClick={() => handleDeletePatient(p.id)}
                                 className="p-3 rounded-xl bg-red-50 text-red-400 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                 title="Delete Entry">
                                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                   <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/>
                                 </svg>
                               </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Recent Intelligence Output */}
          <div className="col-span-12 lg:col-span-4">
            <h2 className="font-display text-2xl font-black tracking-tight mb-6" style={{ color: 'var(--navy-900)' }}>Recent Synthesis</h2>
            <div className="space-y-4">
              {sessions.length === 0 ? (
                <div className="card p-12 text-center bg-white shadow-lg shadow-navy-100/10">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Diagnostic Pipeline Idle</p>
                </div>
              ) : sessions.slice(0, 5).map(s => {
                const pat = patients.find(p => p.id === s.patient_id)
                return (
                  <div key={s.id}
                       className="group card p-6 cursor-pointer bg-white transition-all hover:shadow-2xl hover:shadow-navy-900/10 hover:-translate-y-1 relative"
                       onClick={() => router.push(`/report/${s.id}`)}>
                    <div className="flex items-start justify-between mb-4">
                       <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-[10px] font-black border border-gray-100 group-hover:bg-navy-900 group-hover:text-white transition-colors">
                             {pat?.full_name[0] || '?'}
                          </div>
                          <div className="min-w-0">
                             <p className="text-sm font-black tracking-tight truncate leading-none mb-1" style={{ color: 'var(--navy-900)' }}>
                               {pat?.full_name || 'Anonymous Patient'}
                             </p>
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Eval ID: {s.id.slice(0,6)}</span>
                          </div>
                       </div>
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/report/${s.id}`); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-navy-900 transition-colors"
                            title="Edit / Review">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDeleteSession(e, s.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                       <div className="flex flex-col items-end gap-1.5 translate-y-[-2px]">
                         {s.risk_assessment && (
                           <RiskBadge risk={s.risk_assessment.suicide_risk || 'none'} />
                         )}
                         <span className="text-[9px] font-black text-gray-300 uppercase tracking-tighter">
                            {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                         </span>
                       </div>
                    </div>
                    <p className="text-xs font-medium mb-5 line-clamp-2 italic leading-relaxed" style={{ color: 'rgba(13,31,56,0.6)' }}>
                       {s.clinical_summary ? `"${s.clinical_summary}"` : 'Processing multimodal data fusion...'}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                       <div className="flex items-center gap-2">
                          <div className="flex -space-x-1.5">
                             {[1,2,3].map(i => <div key={i} className="w-4 h-4 rounded-full bg-teal-500 border border-white" />)}
                          </div>
                          <span className="text-[9px] font-black uppercase text-teal-600 tracking-widest">AI Certified</span>
                       </div>
                       {s.overall_severity > 0 && (
                        <div className="flex items-baseline gap-1">
                           <span className="text-[11px] font-black" style={{ 
                             color: s.overall_severity > 70 ? 'var(--risk-high)' : s.overall_severity > 40 ? 'var(--risk-med)' : 'var(--teal-600)' 
                           }}>{s.overall_severity}%</span>
                           <span className="text-[8px] font-black uppercase text-gray-400">Severity</span>
                        </div>
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
