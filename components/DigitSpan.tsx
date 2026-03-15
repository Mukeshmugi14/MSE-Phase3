'use client'

import React, { useState, useEffect, useRef } from 'react'

interface Props {
  onComplete: (data: { max_span: number; trials: number[][]; score: number; severity: string; time_ms: number }) => void
}

export default function DigitSpan({ onComplete }: Props) {
  const [stage, setStage] = useState<'intro' | 'show' | 'input' | 'feedback' | 'finished'>('intro')
  const [sequence, setSequence] = useState<number[]>([])
  const [inputSequence, setInputSequence] = useState<number[]>([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [span, setSpan] = useState(3)
  const [errors, setErrors] = useState(0)
  const [trials, setTrials] = useState<number[][]>([])
  const [startTime] = useState(Date.now())
  
  const startTest = () => {
    setStage('show')
    generateSequence(3)
  }

  const generateSequence = (len: number) => {
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 10))
    setSequence(seq)
    setTrials(prev => [...prev, seq])
    setCurrentIdx(-1)
    
    let idx = -1
    const interval = setInterval(() => {
      idx++
      if (idx >= len) {
        clearInterval(interval)
        setTimeout(() => setStage('input'), 500)
      } else {
        setCurrentIdx(idx)
      }
    }, 1000)
  }

  const handleDigit = (d: number) => {
    const next = [...inputSequence, d]
    setInputSequence(next)
    
    if (next.length === sequence.length) {
      const isCorrect = next.every((v, i) => v === sequence[i])
      if (isCorrect) {
        setSpan(s => s + 1)
        setErrors(0)
        setInputSequence([])
        setStage('feedback')
        setTimeout(() => {
          setStage('show')
          generateSequence(span + 1)
        }, 800)
      } else {
        const nextErrors = errors + 1
        setErrors(nextErrors)
        setInputSequence([])
        if (nextErrors >= 2 || span >= 9) {
          finish()
        } else {
          setStage('feedback')
          setTimeout(() => {
            setStage('show')
            generateSequence(span)
          }, 800)
        }
      }
    }
  }

  const finish = () => {
    const finalSpan = span - (errors > 0 ? 0 : 0)
    let score = 5
    let severity = 'normal'
    
    if (finalSpan <= 2) { score = 88; severity = 'severe' }
    else if (finalSpan <= 4) { score = 62; severity = 'moderate' }
    else if (finalSpan <= 6) { score = 32; severity = 'mild' }

    onComplete({
      max_span: finalSpan,
      trials,
      score,
      severity,
      time_ms: Date.now() - startTime
    })
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-12 animate-in duration-500">
      <div className="text-center space-y-2">
        <h2 className="font-display text-4xl font-black text-navy-900 tracking-tight">Digit Span Assessment</h2>
        <div className="flex items-center justify-center gap-2">
           <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900/40">Domain: Auditory Working Memory</p>
        </div>
      </div>

      {stage === 'intro' && (
        <div className="text-center space-y-8 animate-in slide-in-from-bottom-4">
          <div className="p-8 rounded-[32px] bg-teal-50 border border-teal-100/50 max-w-sm mx-auto">
            <p className="text-sm font-medium leading-relaxed text-teal-800">
              Observe the numeric sequence carefully. Reconstruct the sequence in the same chronological order.
            </p>
          </div>
          <button 
            onClick={startTest} 
            className="group flex items-center gap-4 px-10 py-5 rounded-2xl bg-teal-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-teal-900/20 hover:scale-105 active:scale-95 transition-all"
          >
            Initialize Sequence
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {stage === 'show' && (
        <div className="relative">
          <div className="absolute inset-0 bg-teal-500/20 blur-[60px] rounded-full animate-pulse" />
          <div className="w-40 h-40 flex items-center justify-center bg-white rounded-[40px] shadow-2xl border border-teal-100 relative z-10 transition-all duration-300">
            <span className="text-8xl font-display font-black text-teal-600 animate-in zoom-in-75 duration-300">
              {currentIdx === -1 ? '' : sequence[currentIdx]}
            </span>
          </div>
        </div>
      )}

      {stage === 'input' && (
        <div className="space-y-10 flex flex-col items-center w-full animate-in fade-in duration-500">
          <div className="flex gap-3">
            {sequence.map((_, i) => (
              <div key={i} className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-xl font-black transition-all ${
                inputSequence[i] !== undefined 
                  ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-lg shadow-teal-900/5 scale-110' 
                  : 'border-navy-900/5 bg-navy-50/50 opacity-40'
              }`}>
                {inputSequence[i] !== undefined ? inputSequence[i] : ''}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3,4,5,6,7,8,9,0].map(d => (
              <button 
                key={d} 
                onClick={() => handleDigit(d)}
                className="w-20 h-20 rounded-3xl bg-white border border-navy-900/5 text-2xl font-black text-navy-900 hover:bg-teal-50 hover:border-teal-500 hover:text-teal-600 hover:shadow-xl hover:shadow-teal-900/5 transition-all active:scale-90"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === 'feedback' && (
        <div className="text-center animate-in zoom-in-95">
          <div className={`text-4xl font-black italic tracking-tight mb-4 ${errors > 0 ? 'text-red-500' : 'text-teal-600'}`}>
            {errors > 0 ? 'Mismatch Detected' : 'Sequence Verified!'}
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-navy-900/30">Loading Next Domain Layer...</p>
        </div>
      )}
    </div>
  )
}
