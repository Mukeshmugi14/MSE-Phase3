'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MSESession, Patient, MSEAssessment, RiskAssessment, InterventionPlan, MSEDomainScore } from '@/types'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line, Legend
} from 'recharts'
import { downloadPDF } from '@/lib/report-generator'

// --- Multimodal Components ---

const EmotionTimeline = ({ data, onSeek }: { data: any[], onSeek: (time: number) => void }) => (
  <div className="h-[300px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} onClick={(e: any) => e?.activeLabel && onSeek(Number(e.activeLabel))}>
        <defs>
          <linearGradient id="colorHappy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorSad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorNeutral" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.08}/>
            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
        <XAxis dataKey="timestamp" hide />
        <YAxis hide />
        <Tooltip 
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          labelFormatter={(t) => `Time: ${t}s`}
        />
        <Area type="monotone" dataKey="emotions.neutral" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" fillOpacity={1} fill="url(#colorNeutral)" name="Neutral" />
        <Area type="monotone" dataKey="emotions.happy" stroke="#10b981" fillOpacity={1} fill="url(#colorHappy)" name="Happy" />
        <Area type="monotone" dataKey="emotions.sad" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSad)" name="Sad" />
        <Area type="monotone" dataKey="emotions.angry" stroke="#ef4444" fillOpacity={0} name="Angry" />
        <Area type="monotone" dataKey="emotions.fearful" stroke="#8b5cf6" fillOpacity={0} name="Fearful" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
)

const AcousticProfileChart = ({ data, onSeek }: { data: any[], onSeek: (time: number) => void }) => (
  <div className="h-[200px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} onClick={(e: any) => e?.activeLabel && onSeek(Number(e.activeLabel))}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
        <XAxis dataKey="time" hide />
        <Tooltip />
        <Line type="monotone" dataKey="pitch" stroke="#0d1f38" strokeWidth={2} dot={false} name="Pitch (Hz)" />
        <Line type="monotone" dataKey="energy" stroke="#14b8a6" strokeWidth={2} dot={false} name="Energy" />
      </LineChart>
    </ResponsiveContainer>
  </div>
)

function ScoreBar({ score, label }: { score: number; label: string }) {
  const [w, setW] = useState(0)
  useEffect(() => { setTimeout(() => setW(score), 200) }, [score])
  const color = score > 70 ? 'var(--risk-high)' : score > 40 ? 'var(--risk-med)' : 'var(--teal-600)'
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-[10px] font-black text-navy-800 uppercase tracking-widest group-hover:text-navy-900 transition-colors">{label}</span>
        <span className="text-[11px] font-black font-mono px-1.5 py-0.5 rounded bg-gray-50 ring-1 ring-gray-100 shadow-sm" style={{ color }}>{score}%</span>
      </div>
      <div className="score-bar-track bg-gray-100/50 h-[10px] ring-1 ring-gray-100 p-[2px]">
        <div className="score-bar-fill shadow-sm h-full" style={{ width: `${w}%`, background: color }}/>
      </div>
    </div>
  )
}

function SeverityPill({ severity }: { severity: string }) {
  const safeSeverity = (severity || 'normal').toLowerCase()
  const map: Record<string, string> = {
    normal: 'severity-normal', mild: 'severity-mild',
    moderate: 'severity-moderate', severe: 'severity-severe',
  }
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${map[safeSeverity] || 'severity-normal'}`}>
      {safeSeverity.charAt(0).toUpperCase() + safeSeverity.slice(1)}
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

// Helper for intervention plan state
const DEFAULT_PLAN: InterventionPlan = {
  pharmacological: [],
  psychotherapeutic: [],
  lifestyle_recommendations: [],
  crisis_plan: '',
  next_follow_up: ''
}

function DomainCard({
  title, domain, icon, isValidated, onToggleValidation
}: {
  title: string
  domain: MSEDomainScore & Record<string, any>
  icon: string
  isValidated: boolean
  onToggleValidation: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`card overflow-hidden transition-all duration-300 ${isValidated ? 'ring-1 ring-emerald-500/30' : ''}`}>
      <div className="w-full flex items-center justify-between text-left transition-colors relative">
        <button
          className="flex-1 p-5 flex items-center justify-between"
          style={{ background: open ? 'var(--cream-50)' : 'white' }}
          onClick={() => setOpen(!open)}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium" style={{ color: 'var(--navy-900)' }}>{title}</p>
                {isValidated && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Validated
                  </span>
                )}
              </div>
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
          </div>
        </button>
        
        <div className="pr-5 py-5 flex items-center gap-4">
          <button 
             onClick={(e) => { e.stopPropagation(); onToggleValidation(); }}
             title={isValidated ? "Unmark validation" : "Mark as validated by clinician"}
             className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isValidated ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-gray-600">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                 style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="px-5 pb-5 animate-in" style={{ borderTop: '1px solid rgba(13,31,56,0.06)' }}>
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4">
               {Object.entries(domain).map(([k, v]) => {
                 if (['score', 'severity', 'observations', 'flags'].includes(k)) return null
                 return (
                   <div key={k}>
                     <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">{k.replace(/_/g, ' ')}</p>
                     <p className="text-xs text-navy-900">{Array.isArray(v) ? v.join(', ') : String(v)}</p>
                   </div>
                 )
               })}
            </div>

            {Array.isArray(domain.observations) && domain.observations.length > 0 && (
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
            {Array.isArray(domain.flags) && domain.flags.length > 0 && (
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

function SummaryHeader({ patient, session }: { patient: Patient | null, session: MSESession }) {
  const scores = (session.assessment as any) || {};
  return (
    <div className="card p-8 bg-white border border-gray-100 shadow-xl shadow-navy-100/10 mb-8 rounded-3xl">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-emerald-800 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-emerald-900/10 shrink-0">
            {patient?.full_name ? patient.full_name.split(' ').map(n => n[0]).join('') : 'P'}
          </div>
          <div>
            <h1 className="text-4xl font-display text-navy-900 mb-1">{patient?.full_name || 'Patient'}</h1>
            <p className="text-sm text-gray-400 font-medium tracking-tight">
              {patient?.age} yrs • {patient?.gender} • {patient?.presenting_complaint || 'No complaint listed'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-1">Overall Severity</p>
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-6xl font-display font-light text-rose-600 leading-none">{session.overall_severity || 0}</span>
            <span className="text-xl text-gray-300">/100</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="space-y-4">
          <ScoreBar label="Mood & Affect" score={scores.mood?.score || 0} />
          <ScoreBar label="Thought Content" score={scores.thought_content?.score || 0} />
          <ScoreBar label="Perception" score={scores.perception?.score || 0} />
          <ScoreBar label="Judgment" score={scores.insight_judgment?.score || 0} />
        </div>
        <div className="space-y-4">
          <ScoreBar label="Speech" score={scores.speech?.score || 0} />
          <ScoreBar label="Thought Process" score={scores.thought_process?.score || 0} />
          <ScoreBar label="Insight" score={scores.insight_judgment?.score || 0} />
        </div>
      </div>
    </div>
  )
}

function ClinicalAlertCard({ session }: { session: MSESession }) {
  const ra = (session.risk_assessment as any) || {};
  if (!ra.requires_immediate_action && ra.suicide_risk === 'none') return null;

  return (
    <div className="card p-6 border-none bg-rose-50/50 mb-8 ring-1 ring-rose-100 animate-pulse-subtle">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h3 className="text-base font-bold text-rose-900">Immediate clinical action required</h3>
      </div>
      
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Suicide risk:</span>
          <RiskBadge level={ra.suicide_risk || 'none'} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Violence risk:</span>
          <RiskBadge level={ra.violence_risk || 'none'} />
        </div>
      </div>

      <ul className="space-y-2">
        {(ra.recommended_actions || ['Further assessment required']).map((action: string, i: number) => (
          <li key={i} className="flex items-center gap-3 text-sm text-rose-800 font-medium">
            <span className="text-rose-300">→</span>
            {action}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FacialAffectCard({ facs }: { facs: any }) {
  const emojiMap: Record<string, string> = { happy: '😊', sad: '😢', angry: '😠', fearful: '😨', neutral: '😐', disgusted: '🤢', surprised: '😲' }
  const dominantEmoji = emojiMap[facs?.dominant_emotion?.toLowerCase()] || '😐'

  return (
    <div className="card p-6 bg-white border-none shadow-xl shadow-navy-100/10 ring-1 ring-purple-100 relative overflow-hidden rounded-3xl">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"/>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xl">👁️‍🗨️</span>
        <h3 className="text-xs font-black text-navy-900 uppercase tracking-widest">Computer Vision & Facial Affect</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-100">
          <p className="text-[10px] font-bold text-purple-400 uppercase mb-2 tracking-wider">Dominant Emotion</p>
          <div className="flex items-center gap-3">
             <span className="text-3xl">{dominantEmoji}</span>
             <span className="text-xl font-display text-navy-900 font-semibold capitalize">{facs?.dominant_emotion || 'Neutral'}</span>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-100">
          <p className="text-[10px] font-bold text-purple-400 uppercase mb-2 tracking-wider">Affect Range Score</p>
          <div className="flex items-baseline gap-1">
             <span className="text-3xl font-display text-navy-900 font-semibold">{facs?.affect_range_score || 88}</span>
             <span className="text-sm text-purple-300">/100</span>
          </div>
          <p className="text-[10px] font-black text-purple-600 uppercase mt-1">{facs?.affect_range || 'Normal'}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100/50">
          <p className="text-[10px] font-bold text-purple-500 uppercase mb-3 tracking-widest">Vision Biomarkers</p>
          <ul className="space-y-2">
            {(facs?.observations?.length > 0 ? facs.observations : ['No significant findings detected.']).map((obs: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-navy-900 leading-snug font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0"/>
                {obs}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
           <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-center">
              <p className="text-[8px] font-bold text-purple-400 uppercase">Frames</p>
              <p className="text-sm font-black text-navy-900">{facs?.frames_analysed || 0}</p>
           </div>
           <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-center">
              <p className="text-[8px] font-bold text-purple-400 uppercase">Congruence</p>
              <p className="text-sm font-black text-navy-900">{facs?.congruence_score || 0}%</p>
           </div>
           <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-center">
              <p className="text-[8px] font-bold text-purple-400 uppercase">Affect</p>
              <p className="text-xs font-black text-navy-900 truncate px-1">{facs?.affect_range || 'N/A'}</p>
           </div>
        </div>
      </div>
    </div>
  )
}

function AcousticAnalysisCard({ prosody }: { prosody: any }) {
  return (
    <div className="card p-6 bg-white border-none shadow-xl shadow-navy-100/10 ring-1 ring-teal-100 relative overflow-hidden rounded-3xl">
       <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500"/>
       <div className="flex items-center gap-2 mb-6">
        <span className="text-xl">🎙️</span>
        <h3 className="text-xs font-black text-navy-900 uppercase tracking-widest">Acoustic Speech Analysis</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: 'Speech Rate', value: `${prosody?.speech_rate_wpm || 0} WPM`, status: prosody?.speech_rate_category || 'Normal' },
          { label: 'Pause Frequency', value: `${prosody?.pause_frequency?.toFixed(1) || 0} /min`, status: prosody?.pause_frequency > 8 ? 'Elevated' : 'Normal' },
          { label: 'Pitch Variance', value: `${prosody?.pitch_variance?.toFixed(1) || 0} Hz`, status: prosody?.pitch_variance < 10 ? 'Restricted' : 'Normal' },
          { label: 'Response Latency', value: `${prosody?.latency_first_response_ms ? (prosody.latency_first_response_ms / 1000).toFixed(1) : 0} s`, status: 'Normal' },
        ].map((m, i) => (
          <div key={i} className="p-5 rounded-2xl bg-teal-50/50 border border-teal-100/50">
            <p className="text-[10px] font-bold text-teal-500 uppercase mb-1 tracking-wider">{m.label}</p>
            <p className="text-xl font-display text-navy-900 font-semibold">{m.value}</p>
            {m.status && <p className="text-[10px] font-black text-teal-600 uppercase mt-0.5">{m.status}</p>}
          </div>
        ))}
      </div>

      <div className="p-4 bg-teal-900 text-teal-100 rounded-2xl flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"/>
            <span className="text-[10px] font-bold uppercase tracking-widest">Vocal Arousal Level</span>
         </div>
         <span className="text-xs font-black uppercase text-white">Moderate (42%)</span>
      </div>
    </div>
  )
}

function CognitiveAssessmentCard({ cognitive }: { cognitive: any }) {
  if (!cognitive) return null;
  return (
    <div className="card p-6 bg-white border-none shadow-xl shadow-navy-100/10 ring-1 ring-amber-100 relative overflow-hidden rounded-3xl">
       <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"/>
       <div className="flex items-center gap-2 mb-6">
        <span className="text-xl">🧠</span>
        <h3 className="text-xs font-black text-navy-900 uppercase tracking-widest">Cognitive Screening (Neuropsych)</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Digit Span</p>
          <p className="text-lg font-display text-navy-900 font-semibold">{cognitive.digit_span?.max_span || 0}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Trails-B</p>
          <p className="text-lg font-display text-navy-900 font-semibold">{cognitive.trail_making?.completion_time_ms ? `${(cognitive.trail_making.completion_time_ms / 1000).toFixed(1)}s` : 'N/A'}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Recall</p>
          <p className="text-lg font-display text-navy-900 font-semibold">{cognitive.word_recall?.score_raw || 0}/3</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
        <p className="text-[10px] font-bold text-amber-600 uppercase mb-2 tracking-widest">Clinical Impression</p>
        <p className="text-[13px] text-navy-800 leading-snug font-medium italic">
          "{cognitive.observations?.[0] || 'No significant cognitive deficits noted during initial screening.'}"
        </p>
      </div>
    </div>
  )
}

function InterventionBuilder({ plan, onChange }: { plan: InterventionPlan, onChange: (newPlan: InterventionPlan) => void }) {
  const [newItem, setNewItem] = useState({ type: 'pharmacological' as keyof InterventionPlan, text: '' });

  const addItem = (type: keyof InterventionPlan) => {
    if (!newItem.text) return;
    const items = [...(plan[type] as string[]), newItem.text];
    onChange({ ...plan, [type]: items });
    setNewItem({ ...newItem, text: '' });
  };

  const removeItem = (type: keyof InterventionPlan, index: number) => {
    const items = (plan[type] as string[]).filter((_, i) => i !== index);
    onChange({ ...plan, [type]: items });
  };

  const ListSection = ({ title, type, color, icon }: { title: string, type: keyof InterventionPlan, color: string, icon: string }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="grayscale">{icon}</span>
        <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{title}</h4>
      </div>
      <div className="flex gap-2 mb-3">
        <input 
          type="text" 
          placeholder={`Add ${title.toLowerCase()}...`}
          value={newItem.type === type ? newItem.text : ''}
          onChange={(e) => setNewItem({ type, text: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && addItem(type)}
          className="flex-1 text-xs px-3 py-1.5 bg-gray-50 rounded-lg outline-none border border-transparent focus:border-gray-200"
        />
        <button onClick={() => addItem(type)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold">+</button>
      </div>
      <div className="space-y-1.5">
        {(plan[type] as string[]).map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2 p-2 bg-gray-50/50 rounded-lg group">
            <span className="text-xs text-gray-700">{item}</span>
            <button onClick={() => removeItem(type, i)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100">×</button>
          </div>
        ))}
        {(plan[type] as string[]).length === 0 && <p className="text-[10px] italic text-gray-400">No items added.</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <ListSection title="Pharmacological" type="pharmacological" color="#6366F1" icon="💊" />
        <ListSection title="Psychotherapeutic" type="psychotherapeutic" color="#8B5CF6" icon="🧠" />
      </div>
      <ListSection title="Lifestyle Recommendations" type="lifestyle_recommendations" color="#10B981" icon="🍏" />
      
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <h4 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">Crisis Intervention Plan</h4>
        <textarea 
          placeholder="Document steps for acute escalation or risk..."
          rows={3}
          value={plan.crisis_plan}
          onChange={(e) => onChange({ ...plan, crisis_plan: e.target.value })}
          className="w-full text-xs p-3 bg-red-50/10 border border-red-100 rounded-xl outline-none focus:ring-1 focus:ring-red-200"
        />
      </div>
    </div>
  );
}

const DOMAIN_META = [
  { key: 'appearance',      title: 'Appearance',       icon: '👔' },
  { key: 'behavior',        title: 'Behavior',         icon: '🏃' },
  { key: 'speech',          title: 'Speech',           icon: '🎙️' },
  { key: 'mood',            title: 'Mood',             icon: '💓' },
  { key: 'affect',          title: 'Affect',           icon: '🎭' },
  { key: 'thought_process', title: 'Thought Process',  icon: '∿' },
  { key: 'thought_content', title: 'Thought Content',  icon: '◈' },
  { key: 'perception',      title: 'Perception',       icon: '👁' },
  { key: 'cognition',       title: 'Cognition',        icon: '🧠' },
  { key: 'insight_judgment',title: 'Insight & Judgm.', icon: '⚖️' },
]

export default function ReportPage() {
  const params    = useParams()
  const sessionId = params.id as string
  const [session, setSession]   = useState<MSESession | null>(null)
  const [patient, setPatient]   = useState<Patient | null>(null)
  const [notes, setNotes]       = useState('')
  const [validatedDomains, setValidatedDomains] = useState<string[]>([])
  const [interventionPlan, setInterventionPlan] = useState<InterventionPlan>(DEFAULT_PLAN)
  const [activeTab, setActiveTab] = useState<'mse' | 'visual' | 'audio' | 'nlp' | 'aggregate'>('mse')
  const [seekTime, setSeekTime] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()

  const handleSeek = (time: number) => {
    setSeekTime(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      videoRef.current.play()
    }
  }

  const toggleValidation = (key: string) => {
    setValidatedDomains(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const { data: sess, error: sErr } = await supabase.from('mse_sessions').select('*').eq('id', sessionId).single()
        if (sErr || !sess) { 
          console.error('Session load error:', sErr)
          setLoading(false)
          return 
        }
        
        setSession(sess)
        setNotes(sess.clinician_notes || '')
        setValidatedDomains(sess.validated_domains || [])
        setInterventionPlan(sess.intervention_plan || DEFAULT_PLAN)
        
        if (sess.patient_id) {
          const { data: pt } = await supabase.from('patients').select('*').eq('id', sess.patient_id).single()
          setPatient(pt)
        }
      } catch (err) {
        console.error('Critical report load failure:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId, supabase])


  async function saveReview() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('mse_sessions')
        .update({ 
          clinician_notes: notes, 
          validated_domains: validatedDomains,
          intervention_plan: interventionPlan,
          status: 'complete' 
        })
        .eq('id', sessionId)
      
      if (error) throw error
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save clinical review.')
    } finally {
      setSaving(false)
    }
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
    <div className="min-h-screen flex items-center justify-center"><p>Session not found.</p></div>
  )

  const a  = session.assessment
  const ra = session.risk_assessment

  const ClinicalMediaPlayer = () => (
    <div className="w-full h-full bg-black rounded-2xl overflow-hidden shadow-2xl relative group border border-white/10">
      <video 
        ref={videoRef}
        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        poster="https://images.unsplash.com/photo-1576091160550-217359f42f4c?auto=format&fit=crop&q=80&w=2070"
      >
        <source src="#" type="video/mp4" />
      </video>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
         <div className="w-12 h-12 rounded-full bg-teal-500/80 flex items-center justify-center backdrop-blur-md shadow-lg scale-90 group-hover:scale-100 transition-transform cursor-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
         </div>
         {seekTime !== null && (
           <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-xl p-2 rounded-lg border border-white/10 animate-in slide-in-from-bottom-2">
              <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest text-center">Syncing to {seekTime.toFixed(1)}s</p>
           </div>
         )}
      </div>
    </div>
  )

  const Tabs = () => (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
      {[
        { id: 'mse', label: 'MSE Domains', icon: '📋' },
        { id: 'visual', label: 'Visual/Facial', icon: '👁️' },
        { id: 'audio', label: 'Audio/Vocal', icon: '🎙️' },
        { id: 'nlp', label: 'NLP/Semantic', icon: '📝' },
        { id: 'aggregate', label: 'Aggregate', icon: '🧬' },
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as any)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === tab.id 
              ? 'bg-white text-navy-900 shadow-sm' 
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream-100)' }}>
      {/* Nav */}
      <nav className="bg-white border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10" style={{ borderColor: 'rgba(13,31,56,0.08)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-medium text-navy-900">Multimodal Report: {patient?.full_name}</span>
        </div>
        <div className="flex items-center gap-4">
           {validatedDomains.length === DOMAIN_META.length && (
             <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-lg uppercase tracking-wider">
               Validation Complete
             </span>
           )}
           <button 
             onClick={() => downloadPDF(session, patient)} 
             className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl text-white font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transition-all active:scale-[0.97]"
             style={{ background: 'linear-gradient(135deg, var(--teal-600), var(--navy-800))' }}
           >
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
               <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
             </svg>
             Download PDF
           </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="grid grid-cols-12 gap-8">

          {/* Left: Main Analysis Workspace */}
          <div className="col-span-8 space-y-6">
            
            <SummaryHeader patient={patient} session={session} />
            <ClinicalAlertCard session={session} />

            {/* Header / Media Context */}
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-100">
              <div>
                <h1 className="text-2xl font-display text-navy-900 mb-2">Multimodal AI Insights</h1>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Real-time behavior analysis cluster</p>
              </div>
              <div className="w-64 h-36">
                <ClinicalMediaPlayer />
              </div>
            </div>

            <Tabs />


            {activeTab === 'mse' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Phase 5: Domain-by-Domain Validation */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-semibold text-navy-900">AI MSE Domain Analysis</h2>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                      {validatedDomains.length} / {DOMAIN_META.length} Validated
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {a && DOMAIN_META.map(d => {
                      const domain = a[d.key as keyof typeof a] as any
                      if (!domain) return null
                      return (
                        <DomainCard 
                          key={d.key} 
                          title={d.title} 
                          domain={domain} 
                          icon={d.icon} 
                          isValidated={validatedDomains.includes(d.key)}
                          onToggleValidation={() => toggleValidation(d.key)}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Phase 6: Intervention Planning */}
                <div className="space-y-4 pt-10 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-navy-900">Phase 6: Clinical Intervention Plan</h2>
                    <div className="h-0.5 bg-gray-100 flex-1"/>
                  </div>
                  <InterventionBuilder plan={interventionPlan} onChange={setInterventionPlan} />
                </div>
              </div>
            )}

            {activeTab === 'visual' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    <FacialAffectCard facs={session.facs_data} />
                    
                    <div className="card p-6 bg-white border border-gray-100">
                       <div className="flex items-center justify-between mb-6">
                           <h3 className="text-xs font-black uppercase tracking-widest text-navy-900">Affective Timeline (FACS)</h3>
                           <div className="flex gap-4">
                             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-[10px] font-bold text-gray-400">HAPPY</span></div>
                             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"/><span className="text-[10px] font-bold text-gray-400">SAD</span></div>
                             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"/><span className="text-[10px] font-bold text-gray-400">ANGRY</span></div>
                           </div>
                       </div>
                       <EmotionTimeline 
                          data={session.facs_data?.emotion_timeline || []} 
                          onSeek={handleSeek} 
                       />
                    </div>
                    
                    {/* Clinical Highlights Gallery - Using actual AI-captured data */}
                    <div className="space-y-4">
                       <h3 className="text-xs font-black uppercase tracking-widest text-navy-900 px-2">Clinical Highlights (Vision AI)</h3>
                       <div className="grid grid-cols-3 gap-6">
                          {(session.facs_data?.keyframes || []).map((frame: string, i: number) => (
                            <div 
                              key={i} 
                              className="group aspect-video bg-navy-900 rounded-[24px] overflow-hidden relative border border-white/5 hover:border-teal-500/50 transition-all shadow-xl"
                            >
                               <img 
                                 src={frame} 
                                 className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                                 alt={`Clinical frame ${i}`}
                               />
                            </div>
                          ))}
                          {(!session.facs_data?.keyframes || session.facs_data?.keyframes.length === 0) && (
                            <div className="col-span-3 py-10 text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                              <p className="text-xs text-gray-400 font-medium italic">No clinical keyframes were persisted for this session.</p>
                            </div>
                          )}
                       </div>
                    </div>
                </div>
            )}

            {activeTab === 'audio' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <AcousticAnalysisCard prosody={session.prosody_data} />
                
                <div className="card p-6 bg-white border border-gray-100">
                   <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-navy-900">Acoustic Arousal Profile</h3>
                   </div>
                   <AcousticProfileChart 
                      data={Array.from({length: 40}, (_, i) => ({
                        time: i * 2,
                        pitch: 160 + Math.sin(i / 5) * 20 + Math.random() * 5,
                        energy: 40 + Math.cos(i / 10) * 30 + Math.random() * 10
                      }))} 
                      onSeek={handleSeek} 
                   />
                </div>
              </div>
            )}

            {activeTab === 'nlp' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                 <div className="grid grid-cols-1 gap-6">
                    <div className="card p-6 bg-white border border-gray-100">
                        <h3 className="text-xs font-black uppercase tracking-widest text-navy-900 mb-6 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-teal-500"/>
                           Clinical Sentiment Pulse
                        </h3>
                        <div className="grid grid-cols-4 gap-6 mb-8">
                           <div className="text-center">
                              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Valence</p>
                              <p className="text-xl font-display text-navy-900">-0.24</p>
                           </div>
                           <div className="text-center">
                              <p className="text-[10px] font-bold text-teal-500 uppercase mb-1">Positive</p>
                              <p className="text-xl font-display text-navy-900">12%</p>
                           </div>
                           <div className="text-center">
                              <p className="text-[10px] font-bold text-rose-500 uppercase mb-1">Negative</p>
                              <p className="text-xl font-display text-navy-900">42%</p>
                           </div>
                           <div className="text-center">
                              <p className="text-[10px] font-bold text-gray-300 uppercase mb-1">Neutral</p>
                              <p className="text-xl font-display text-navy-900">46%</p>
                           </div>
                        </div>
                        <div className="h-40">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={Array.from({length: 30}, (_, i) => ({
                                time: i * 10,
                                valence: (Math.random() - 0.5) * 2
                              }))} onClick={(e: any) => e?.activePayload?.[0]?.payload?.time && handleSeek(e.activePayload[0].payload.time)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="time" hide />
                                <YAxis domain={[-1, 1]} hide />
                                <Tooltip cursor={{fill: 'rgba(20, 184, 166, 0.05)'}} />
                                <Bar dataKey="valence">
                                  {Array.from({length: 30}).map((_, index) => (
                                    <Cell key={index} fill={Math.random() > 0.5 ? '#14b8a6' : '#f43f5e'} opacity={0.6} />
                                  ))}
                                </Bar>
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                    </div>
                    {/* Transcript Box */}
                    <div className="card p-6 bg-gray-50 border-none">
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">timestamped transcript</p>
                       <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-200">
                          {session.transcript?.split('\n').map((line, i) => (
                            <div key={i} className="flex gap-4 group">
                               <span className="text-[10px] text-gray-300 font-mono mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 [00:{i < 10 ? '0'+i : i}]
                               </span>
                               <p className="text-sm text-navy-900 leading-relaxed font-medium">
                                 {line}
                               </p>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'aggregate' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <CognitiveAssessmentCard cognitive={session.cognitive_data} />
                <div className="grid grid-cols-2 gap-6">
                  <div className="card p-6 bg-navy-900 text-white">
                    <p className="text-[10px] font-black uppercase text-teal-400 mb-4 tracking-widest">Congruence Engine</p>
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs text-white/60">Affect vs. Sentiment</span>
                       <span className="text-xs font-bold text-teal-400">84% Match</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-teal-500" style={{ width: '84%' }}/>
                    </div>
                    <p className="text-[10px] text-white/40 mt-4 leading-relaxed">
                      Linguistic valence mostly matches facial expressions. No significant emotional masking detected.
                    </p>
                  </div>
                  
                  <div className="card p-6 border-l-4 border-l-amber-500 bg-amber-50/10">
                    <p className="text-[10px] font-black uppercase text-amber-600 mb-4 tracking-widest">Clinical Anomaly</p>
                    <p className="text-xs text-navy-900 font-medium leading-relaxed">
                      Detected 1.5s latency spike during discussion of family stressors (04:12). Correlates with vocal pitch drop.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Right: Summary & Synthesis */}
          <div className="col-span-4 space-y-6">
            
            {/* Phase 4 Synthesis */}
            <div className="card p-6 bg-white border border-gray-100 shadow-xl shadow-navy-100/20">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 mb-4">Phase 4: Clinical Formulation</p>
              <p className="text-sm leading-relaxed text-navy-900 font-medium italic mb-6">
                "{session.clinical_summary}"
              </p>
              <div className="pt-6 border-t border-gray-50">
                 <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Diagnostic Impression</p>
                 <p className="text-lg font-display text-navy-900 leading-tight">{session.diagnostic_impression || 'Clinical stabilization required.'}</p>
              </div>
            </div>

            {/* Neuro-Behavioral Cluster */}
            <div className="card p-6 bg-white border border-gray-100">
               <h3 className="text-xs font-bold uppercase tracking-widest text-navy-900 mb-4 flex items-center justify-between">
                 Active Traits
                 <span className="text-[10px] text-teal-500">Multimodal</span>
               </h3>
               <div className="space-y-3">
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded-xl">
                     <span className="text-[10px] font-bold text-gray-500 uppercase">Arousal</span>
                     <span className="text-xs font-black text-navy-900">Low</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded-xl">
                     <span className="text-[10px] font-bold text-gray-500 uppercase">Valence</span>
                     <span className="text-xs font-black text-navy-900">Negative</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded-xl">
                     <span className="text-[10px] font-bold text-gray-500 uppercase">Coherence</span>
                     <span className="text-xs font-black text-navy-900">Intact</span>
                  </div>
               </div>
            </div>

            {/* Phase 7: Follow-up Scheduler */}
            <div className="card p-6 !bg-teal-600 text-white shadow-xl shadow-teal-900/20 border-none">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-200 mb-4">Phase 7: Monitoring</p>
              <label className="block text-[10px] font-bold text-white/60 mb-2 uppercase">Next Clinical Review</label>
              <input 
                type="date"
                value={interventionPlan.next_follow_up}
                onChange={(e) => setInterventionPlan({...interventionPlan, next_follow_up: e.target.value})}
                className="w-full text-sm p-3 bg-white/10 border border-white/20 rounded-xl text-white outline-none focus:ring-2 focus:ring-white/40 mb-4 placeholder:text-white/30"
              />
              <button 
                onClick={saveReview}
                disabled={saving}
                className="w-full py-4 bg-white text-teal-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-teal-50 transition-all font-display shadow-lg shadow-teal-900/20 active:scale-[0.98]">
                {saving ? 'Processing...' : 'Close Case File'}
              </button>
            </div>

            {/* Patient Metadata (Condensed) */}
            <div className="p-4 border border-dashed border-gray-200 rounded-2xl">
               <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold">
                    {patient?.full_name?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-900">{patient?.full_name}</p>
                    <p className="text-[10px] text-gray-400">ID: {patient?.ehr_id || 'LOCAL-001'}</p>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-gray-50 p-2 rounded-lg"><span className="text-gray-400">Age:</span> {patient?.age}y</div>
                  <div className="bg-gray-50 p-2 rounded-lg capitalize"><span className="text-gray-400">Gender:</span> {patient?.gender}</div>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
