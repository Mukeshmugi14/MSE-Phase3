'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import type { MSESession, Patient } from '@/types'

export default function PatientLongitudinalPage() {
  const params = useParams()
  const patientId = params.id as string
  const [patient, setPatient] = useState<Patient | null>(null)
  const [sessions, setSessions] = useState<MSESession[]>([])
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: pt } = await supabase.from('patients').select('*').eq('id', patientId).single()
      const { data: sess } = await supabase.from('mse_sessions')
        .select('*')
        .eq('patient_id', patientId)
        .order('session_date', { ascending: true })
      
      if (pt) setPatient(pt)
      if (sess) setSessions(sess)
      setLoading(false)
    }
    load()
  }, [patientId])

  if (loading) return <div className="p-20 text-center">Loading longitudinal data...</div>

  const chartData = sessions.map(s => ({
    date: s.session_date ? new Date(s.session_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A',
    severity: s.overall_severity || 0,
    mood: (s.assessment?.mood as any)?.score || 0,
    insight: (s.assessment?.insight_judgment as any)?.score || 0,
  }))

  return (
    <div className="min-h-screen p-8 space-y-8" style={{ background: 'var(--cream-100)' }}>
      <nav className="flex items-center gap-4 mb-4">
        <button onClick={() => router.push('/dashboard')} className="text-sm opacity-50">← Dashboard</button>
        <span className="opacity-20">/</span>
        <span className="text-sm font-medium">Patient Trends</span>
      </nav>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-display text-navy-900 mb-2">{patient?.full_name}</h1>
          <p className="text-gray-500">{patient?.age}y · {patient?.gender} · Clinical History</p>
        </div>
        <button 
          onClick={() => router.push(`/session/new?patientId=${patientId}`)}
          className="px-6 py-3 bg-teal-600 text-white rounded-xl font-medium shadow-lg hover:bg-teal-700 transition-all"
        >
          New Assessment Session
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Severity Trend */}
        <div className="col-span-2 card p-6 h-[400px]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Overall Severity Trend</h3>
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--risk-high)" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="var(--risk-high)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="severity" stroke="var(--risk-high)" fillOpacity={1} fill="url(#colorSev)" strokeWidth={3} dot={{ r: 4, fill: 'var(--risk-high)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Clinical Snapshot */}
        <div className="card p-6 space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">At a Glance</h3>
          <div className="space-y-4">
            <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100">
              <p className="text-[10px] font-bold text-teal-600 uppercase mb-1">Last Severity</p>
              <p className="text-3xl font-display text-teal-900">{sessions[sessions.length-1]?.overall_severity}%</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
              <p className="text-[10px] font-bold text-purple-600 uppercase mb-1">Total Sessions</p>
              <p className="text-3xl font-display text-purple-900">{sessions.length}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Risk Profile</p>
              <p className="text-lg font-medium text-orange-900 capitalize">
                {(sessions[sessions.length-1]?.risk_assessment as any)?.suicide_risk || 'None'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Trends */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card p-6 h-[300px]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Mood & Insight Progression</h3>
          <ResponsiveContainer width="100%" height="80%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="mood" stroke="#8884d8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="insight" stroke="#82ca9d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Session Log */}
        <div className="card p-6 overflow-hidden flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Historical Sessions</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {[...sessions].reverse().map(s => (
              <button 
                key={s.id}
                onClick={() => router.push(`/report/${s.id}`)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white border border-transparent hover:border-gray-100 transition-all text-left"
              >
                <div>
                  <p className="text-xs font-bold text-navy-900">
                    {new Date(s.session_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{s.diagnostic_impression || 'No impression'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-bold" style={{ color: s.overall_severity > 50 ? 'var(--risk-high)' : 'var(--teal-600)' }}>
                    {s.overall_severity}%
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
