'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import type { MSESession, Patient, MSEDomainScore } from '@/types'

function ScoreBar({ score, label }: { score: number; label: string }) {
  const [w, setW] = useState(0)
  useEffect(() => { setTimeout(() => setW(score), 200) }, [score])
  const color = score > 70 ? 'var(--risk-high)' : score > 40 ? 'var(--risk-med)' : 'var(--teal-600)'
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: 'rgba(13,31,56,0.7)' }}>{label}</span>
        <span className="text-xs font-mono font-medium" style={{ color }}>{score}</span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${w}%`, background: color }}/>
      </div>
    </div>
  )
}

function SeverityPill({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    normal: 'severity-normal', mild: 'severity-mild',
    moderate: 'severity-moderate', severe: 'severity-severe',
  }
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${map[severity] || 'severity-normal'}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  )
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    none: 'risk-none', low: 'risk-low', moderate: 'risk-moderate',
    high: 'risk-high', imminent: 'risk-imminent',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${map[level] || 'risk-none'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"/>
      {level}
    </span>
  )
}

function DomainCard({
  title, domain, icon
}: {
  title: string
  domain: MSEDomainScore & Record<string, any>
  icon: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button
        className="w-full p-5 flex items-center justify-between text-left transition-colors"
        style={{ background: open ? 'var(--cream-50)' : 'white' }}
        onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--navy-900)' }}>{title}</p>
            <SeverityPill severity={domain.severity} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-2xl font-light"
               style={{ color: domain.score > 70 ? 'var(--risk-high)' : domain.score > 40 ? 'var(--risk-med)' : 'var(--teal-600)' }}>
              {domain.score}
            </p>
            <p className="text-xs" style={{ color: 'rgba(13,31,56,0.35)' }}>/100</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
               style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M4 6l4 4 4-4" stroke="rgba(13,31,56,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(13,31,56,0.06)' }}>
          <div className="pt-4 space-y-4">
            {domain.observations && domain.observations.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2 tracking-wide uppercase" style={{ color: 'rgba(13,31,56,0.4)' }}>
                  Observations
                </p>
                <ul className="space-y-1.5">
                  {domain.observations.map((o: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(13,31,56,0.7)' }}>
                      <span className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--teal-400)' }}/>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {domain.flags && domain.flags.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2 tracking-wide uppercase" style={{ color: 'rgba(13,31,56,0.4)' }}>
                  Clinical flags
                </p>
                <div className="flex flex-wrap gap-2">
                  {domain.flags.map((f: string, i: number) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-lg"
                          style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Multimodal Vision Card
function FACSCard({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="card p-5 border-purple-100 shadow-purple-50/50" style={{ borderLeft: '3px solid #C084FC' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">👁️</span>
        <h3 className="text-sm font-semibold text-purple-900">Computer Vision & Facial Affect</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100">
          <p className="text-[10px] uppercase font-bold text-purple-400 mb-1">Dominant Emotion</p>
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {data.dominant_emotion === 'neutral' ? '😐' : 
               data.dominant_emotion === 'happy' ? '😊' : 
               data.dominant_emotion === 'sad' ? '😢' : 
               data.dominant_emotion === 'angry' ? '😠' : 
               data.dominant_emotion === 'fearful' ? '😨' : '🤔'}
            </span>
            <p className="capitalize font-semibold text-purple-900">{data.dominant_emotion}</p>
          </div>
        </div>
        <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100">
          <p className="text-[10px] uppercase font-bold text-purple-400 mb-1">Affect Range</p>
          <p className="font-semibold text-purple-900">{data.affect_range_score}/100</p>
          <p className="text-xs text-purple-600 capitalize">{data.affect_range}</p>
        </div>
      </div>

      {data.observations?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-bold text-purple-400 mb-2 tracking-widest">Vision Biomarkers</p>
          <ul className="space-y-1.5 bg-white border border-purple-50 p-3 rounded-xl">
            {data.observations.map((o: string, i: number) => (
              <li key={i} className="text-xs text-purple-800 flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">•</span> <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Multimodal Speech Card
function ProsodyCard({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="card p-5 border-teal-100 shadow-teal-50/30" style={{ borderLeft: '3px solid #2DD4BF' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🎙️</span>
        <h3 className="text-sm font-semibold text-teal-900">Acoustic Speech Analysis</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100">
          <p className="text-[10px] uppercase font-bold text-teal-400 mb-1">Speech Rate</p>
          <p className="font-semibold text-teal-900">{data.speech_rate_wpm} <span className="text-xs font-normal text-teal-600">WPM</span></p>
          <p className="text-xs text-teal-600 capitalize mt-0.5">{data.speech_rate_category}</p>
        </div>
        <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100">
          <p className="text-[10px] uppercase font-bold text-teal-400 mb-1">Pause Frequency</p>
          <p className="font-semibold text-teal-900">{data.pause_frequency} <span className="text-xs font-normal text-teal-600">/min</span></p>
        </div>
        <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100">
          <p className="text-[10px] uppercase font-bold text-teal-400 mb-1">Pitch Variance</p>
          <p className="font-semibold text-teal-900 capitalize">{data.pitch_variance}</p>
        </div>
        <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100">
          <p className="text-[10px] uppercase font-bold text-teal-400 mb-1">Response Latency</p>
          <p className="font-semibold text-teal-900">{data.latency_first_response_ms} <span className="text-xs font-normal text-teal-600">ms</span></p>
        </div>
      </div>
    </div>
  )
}

const DOMAIN_META = [
  { key: 'mood_affect',     title: 'Mood & Affect',    icon: '◐' },
  { key: 'speech',          title: 'Speech',           icon: '⏵' },
  { key: 'thought_content', title: 'Thought Content',  icon: '◈' },
  { key: 'thought_process', title: 'Thought Process',  icon: '∿' },
  { key: 'perception',      title: 'Perception',       icon: '👁' },
  { key: 'insight',         title: 'Insight',          icon: '◎' },
  { key: 'judgment',        title: 'Judgment',         icon: '△' },
]

export default function ReportPage() {
  const params    = useParams()
  const sessionId = params.id as string
  const [session, setSession]   = useState<MSESession | null>(null)
  const [patient, setPatient]   = useState<Patient | null>(null)
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase.from('mse_sessions').select('*').eq('id', sessionId).single()
      if (!sess) { setLoading(false); return }
      setSession(sess)
      setNotes(sess.clinician_notes || '')
      if (sess.patient_id) {
        const { data: pt } = await supabase.from('patients').select('*').eq('id', sess.patient_id).single()
        setPatient(pt)
      }
      setLoading(false)
    }
    load()
  }, [sessionId])

  async function saveNotes() {
    setSaving(true)
    await supabase.from('mse_sessions').update({ clinician_notes: notes, status: 'complete' }).eq('id', sessionId)
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream-100)' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 rounded-full mx-auto mb-4 animate-spin"
             style={{ borderColor: 'rgba(11,110,79,0.2)', borderTopColor: 'var(--teal-600)' }}/>
        <p className="text-sm" style={{ color: 'rgba(13,31,56,0.5)' }}>Loading assessment report…</p>
      </div>
    </div>
  )

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Session not found.</p>
    </div>
  )

  const a  = session.assessment
  const ra = session.risk_assessment

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream-100)' }}>
      {/* Nav */}
      <nav className="bg-white border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10"
           style={{ borderColor: 'rgba(13,31,56,0.08)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: 'rgba(13,31,56,0.5)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(13,31,56,0.2)' }}>/</span>
          <span className="text-sm font-medium" style={{ color: 'var(--navy-900)' }}>MSE Report</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'rgba(13,31,56,0.4)' }}>
            {new Date(session.session_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(13,31,56,0.5)', border: '1px solid rgba(13,31,56,0.12)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 4.5V2h7v2.5M3.5 10H2.5a1 1 0 01-1-1V5.5a1 1 0 011-1h9a1 1 0 011 1V9a1 1 0 01-1 1H10.5M3.5 8h7v4h-7V8z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Print / PDF
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="grid grid-cols-3 gap-6">

          {/* Left column — header + risk + domains */}
          <div className="col-span-2 space-y-6">

            {/* Patient + severity header */}
            <div className="card p-6 animate-in">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {patient && (
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-medium text-white"
                         style={{ background: 'var(--teal-600)' }}>
                      {patient.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h1 className="font-display text-2xl font-medium mb-0.5" style={{ color: 'var(--navy-900)' }}>
                      {patient?.full_name || 'Patient'}
                    </h1>
                    {patient && (
                      <p className="text-sm" style={{ color: 'rgba(13,31,56,0.5)' }}>
                        {patient.age} yrs · {patient.gender} · {patient.presenting_complaint}
                      </p>
                    )}
                  </div>
                </div>
                {session.overall_severity > 0 && (
                  <div className="text-right">
                    <p className="text-xs mb-1 tracking-wide uppercase" style={{ color: 'rgba(13,31,56,0.4)' }}>
                      Overall severity
                    </p>
                    <p className="font-display text-4xl font-light"
                       style={{ color: session.overall_severity > 70 ? 'var(--risk-high)' : session.overall_severity > 40 ? 'var(--risk-med)' : 'var(--teal-600)' }}>
                      {session.overall_severity}
                      <span className="text-sm font-body ml-1" style={{ color: 'rgba(13,31,56,0.3)' }}>/100</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Score overview bars */}
              {a && (
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 pt-4"
                     style={{ borderTop: '1px solid rgba(13,31,56,0.07)' }}>
                  {DOMAIN_META.filter(d => a[d.key as keyof typeof a]).map(d => (
                    <ScoreBar
                      key={d.key}
                      label={d.title}
                      score={(a[d.key as keyof typeof a] as MSEDomainScore)?.score ?? 0}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Risk alerts */}
            {ra && (ra.suicide_risk !== 'none' || ra.requires_immediate_action || ra.psychosis_probability > 0.4) && (
              <div className="rounded-2xl p-5 animate-in"
                   style={{ background: ra.requires_immediate_action ? '#FEF2F2' : '#FFFBEB',
                            border: `1px solid ${ra.requires_immediate_action ? '#FECACA' : '#FDE68A'}` }}>
                <div className="flex items-center gap-3 mb-3">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2L2 17h16L10 2z" stroke={ra.requires_immediate_action ? '#B91C1C' : '#D97706'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 8v4M10 14v.5" stroke={ra.requires_immediate_action ? '#B91C1C' : '#D97706'} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <h3 className="text-sm font-semibold"
                      style={{ color: ra.requires_immediate_action ? '#B91C1C' : '#92400E' }}>
                    {ra.requires_immediate_action ? 'Immediate clinical action required' : 'Risk factors identified'}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'rgba(13,31,56,0.5)' }}>Suicide risk:</span>
                    <RiskBadge level={ra.suicide_risk} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'rgba(13,31,56,0.5)' }}>Violence risk:</span>
                    <RiskBadge level={ra.violence_risk} />
                  </div>
                  {ra.psychosis_probability > 0.3 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'rgba(13,31,56,0.5)' }}>Psychosis probability:</span>
                      <span className="text-xs font-semibold" style={{ color: ra.psychosis_probability > 0.6 ? '#B91C1C' : '#D97706' }}>
                        {Math.round(ra.psychosis_probability * 100)}%
                      </span>
                    </div>
                  )}
                </div>
                {ra.recommended_actions && ra.recommended_actions.length > 0 && (
                  <ul className="space-y-1">
                    {ra.recommended_actions.map((action: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs"
                          style={{ color: ra.requires_immediate_action ? '#991B1B' : '#92400E' }}>
                        <span className="mt-0.5">→</span>{action}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Domain cards */}
            {a && (
              <div className="space-y-3 stagger">
                {DOMAIN_META.map(d => {
                  const domain = a[d.key as keyof typeof a] as (MSEDomainScore & Record<string, any>) | undefined
                  if (!domain) return null
                  return (
                    <div key={d.key} className="animate-in">
                      <DomainCard title={d.title} domain={domain} icon={d.icon} />
                    </div>
                  )
                })}
                
              </div>
            )}
          </div>

          {/* Right column — summary + notes + MULTIMODAL INSIGHTS */}
          <div className="space-y-5">

            {/* Clinical summary */}
            {session.clinical_summary && (
              <div className="card p-5 animate-in">
                <p className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: 'rgba(13,31,56,0.4)' }}>
                  Clinical summary
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(13,31,56,0.75)' }}>
                  {session.clinical_summary}
                </p>
              </div>
            )}

            {/* Multimodal Insights (Vision & Speech) */}
            <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(13,31,56,0.08)' }}>
              <p className="text-xs font-medium tracking-wide uppercase" style={{ color: 'rgba(13,31,56,0.4)' }}>
                Multimodal AI Insights
              </p>
              <div className="animate-in" style={{ animationDelay: '0.1s' }}>
                <FACSCard data={session.facs_data} />
              </div>
              <div className="animate-in" style={{ animationDelay: '0.2s' }}>
                <ProsodyCard data={session.prosody_data} />
              </div>
            </div>

            {/* Diagnostic impression */}
            {session.diagnostic_impression && (
              <div className="card p-5 animate-in">
                <p className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: 'rgba(13,31,56,0.4)' }}>
                  Diagnostic impression
                </p>
                <p className="text-sm leading-relaxed font-display italic"
                   style={{ color: 'var(--navy-900)', fontSize: '0.9rem' }}>
                  {session.diagnostic_impression}
                </p>
                <p className="mt-3 text-xs" style={{ color: 'rgba(13,31,56,0.35)' }}>
                  AI-generated provisional impression only. Clinician validation required.
                </p>
              </div>
            )}

            {/* Transcript */}
            {session.transcript && (
              <div className="card p-5 animate-in">
                <p className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: 'rgba(13,31,56,0.4)' }}>
                  Session transcript
                </p>
                <p className="text-xs leading-relaxed max-h-40 overflow-y-auto"
                   style={{ color: 'rgba(13,31,56,0.6)', whiteSpace: 'pre-wrap' }}>
                  {session.transcript}
                </p>
              </div>
            )}

            {/* Clinician notes */}
            <div className="card p-5 animate-in">
              <p className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: 'rgba(13,31,56,0.4)' }}>
                Clinician notes &amp; override
              </p>
              <textarea
                rows={5}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add clinical observations, corrections to AI assessment, or additional context…"
                className="w-full px-3 py-3 rounded-xl text-sm outline-none resize-none"
                style={{
                  background: 'var(--cream-50)',
                  border: '1px solid rgba(13,31,56,0.1)',
                  color: 'var(--navy-900)',
                  lineHeight: '1.6',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--teal-600)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(13,31,56,0.1)')}
              />
              <button
                onClick={saveNotes}
                disabled={saving}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all"
                style={{ background: saving ? 'rgba(11,110,79,0.4)' : 'var(--teal-600)' }}>
                {saving ? 'Saving…' : 'Save notes'}
              </button>
            </div>

            {/* Phase 2 teaser */}
            <div className="p-4 rounded-xl text-center"
                 style={{ background: 'rgba(13,31,56,0.03)', border: '1px dashed rgba(13,31,56,0.12)' }}>
              <p className="text-xs font-medium mb-1" style={{ color: 'rgba(13,31,56,0.4)' }}>
                Phase 2 modules
              </p>
              <p className="text-xs" style={{ color: 'rgba(13,31,56,0.3)' }}>
                FACS affect scores · Prosody analysis ·
                Cognitive test results · Longitudinal trend
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
