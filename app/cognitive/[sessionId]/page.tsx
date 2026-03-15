'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import DigitSpan from '@/components/DigitSpan'
import TrailMaking from '@/components/TrailMaking'
import WordRecall from '@/components/WordRecall'

type TestType = 'digit-span' | 'trail-making' | 'word-recall' | 'complete'

export default function CognitivePage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [currentTest, setCurrentTest] = useState<TestType>('digit-span')
  const [results, setResults] = useState<any>({})
  const [saving, setSaving] = useState(false)
  
  const supabase = createClient()
  const router = useRouter()

  const handleTestComplete = (test: TestType, data: any) => {
    const newResults = { ...results, [test.replace('-', '_')]: data }
    setResults(newResults)
    
    if (test === 'digit-span') setCurrentTest('trail-making')
    else if (test === 'trail-making') setCurrentTest('word-recall')
    else if (test === 'word-recall') {
       setCurrentTest('complete')
       saveResults(newResults)
    }
  }

  const saveResults = async (finalResults: any) => {
    setSaving(true)
    
    const scores = [
      finalResults.digit_span?.score || 0,
      finalResults.trail_making?.score || 0,
      finalResults.word_recall?.score || 0
    ]
    const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    const cognitiveData = {
      ...finalResults,
      composite_score: overall,
      completed_at: new Date().toISOString()
    }

    try {
      const { error } = await supabase
        .from('mse_sessions')
        .update({ status: 'complete', cognitive_data: cognitiveData })
        .eq('id', sessionId)

      if (error) throw error
      
      // Redirect after delay
      setTimeout(() => router.push(`/report/${sessionId}`), 2500)
    } catch (err) {
      console.error('Failed to save cognitive results:', err)
    } finally {
      setSaving(false)
    }
  }

  const progress = currentTest === 'digit-span' ? 25 : currentTest === 'trail-making' ? 50 : currentTest === 'word-recall' ? 75 : 100

  return (
    <div className="min-h-screen flex flex-col selection:bg-teal-100 selection:text-teal-900" style={{ background: 'var(--cream-100)' }}>
      {/* Progress Header */}
      <div className="h-2 bg-navy-900/5 w-full overflow-hidden relative">
        <div 
          className="h-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(20,184,166,0.3)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <nav className="px-8 py-6 flex items-center justify-between bg-white/40 backdrop-blur-md border-b border-navy-900/5">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-navy-900 flex items-center justify-center text-white">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M9.5 14.5L12 17l5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
               </svg>
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900/40">Clinical HUD</p>
               <p className="text-sm font-black text-navy-900">Cognitive Screening Protocol</p>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 px-3 py-1 bg-teal-50 rounded-full border border-teal-100">Live Assessment</span>
         </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-2xl bg-white/60 backdrop-blur-2xl rounded-[48px] shadow-2xl shadow-navy-900/10 overflow-hidden border border-white relative">
          {/* Abstract Decorations */}
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-teal-500/5 blur-[80px] rounded-full" />
          <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-navy-500/5 blur-[80px] rounded-full" />

          <div className="relative z-10 min-h-[500px] flex flex-col">
            {currentTest === 'digit-span' && (
              <DigitSpan onComplete={(data) => handleTestComplete('digit-span', data)} />
            )}
            {currentTest === 'trail-making' && (
              <TrailMaking onComplete={(data) => handleTestComplete('trail-making', data)} />
            )}
            {currentTest === 'word-recall' && (
              <WordRecall onComplete={(data) => handleTestComplete('word-recall', data)} />
            )}
            {currentTest === 'complete' && (
              <div className="p-16 text-center flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 duration-700">
                <div className="w-24 h-24 bg-teal-500 rounded-[32px] flex items-center justify-center shadow-2xl shadow-teal-500/40 mb-10 relative">
                  <div className="absolute inset-0 rounded-[32px] bg-teal-500 animate-ping opacity-25" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 className="font-display text-5xl font-black text-navy-900 mb-4 tracking-tight">Protocol Finalized</h2>
                <p className="text-gray-500 max-w-xs mx-auto font-medium leading-relaxed">
                  Baseline cognitive markers successfully synthesized and integrated into clinical report.
                </p>
                <div className="mt-12">
                  <div className="inline-flex items-center gap-4 px-8 py-4 bg-navy-900 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-navy-900/20">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/>
                    Transmitting to Analytics Module...
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
