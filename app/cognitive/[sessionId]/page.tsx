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
    
    // Calculate overall cognitive score
    const scores = [
      finalResults.digit_span?.score || 0,
      finalResults.trail_making?.score || 0,
      finalResults.word_recall?.score || 0
    ]
    const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    const cognitiveData = {
      ...finalResults,
      overall_cognitive_score: overall,
      tested_at: new Date().toISOString()
    }

    try {
      const { error } = await supabase
        .from('mse_sessions')
        .update({ cognitive_data: cognitiveData })
        .eq('id', sessionId)

      if (error) throw error
      
      // Auto-redirect to report after 2s
      setTimeout(() => router.push(`/report/${sessionId}`), 2000)
    } catch (err) {
      console.error('Failed to save cognitive results:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream-100)' }}>
      {/* Progress Header */}
      <div className="h-2 bg-white/20 w-full overflow-hidden">
        <div 
          className="h-full bg-teal-500 transition-all duration-1000"
          style={{ width: currentTest === 'digit-span' ? '25%' : currentTest === 'trail-making' ? '50%' : currentTest === 'word-recall' ? '75%' : '100%' }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden border border-white/40">
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
            <div className="p-12 text-center space-y-6">
              <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--teal-600)" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="text-4xl font-display text-navy-900">All Tests Completed!</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                The results have been analyzed and added to the Mental Status Examination report.
              </p>
              <div className="pt-8">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-teal-50 rounded-full text-teal-700 font-medium">
                  <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"/>
                  Redirecting to full report...
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
