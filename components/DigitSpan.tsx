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
  
  const timerRef = useRef<NodeJS.Timeout>()

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
    }, 1200)
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
        }, 1000)
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
          }, 1000)
        }
      }
    }
  }

  const finish = () => {
    const finalSpan = span - (errors > 0 ? 0 : 0) // adjusted
    let score = 5
    let severity = 'normal'
    
    if (finalSpan <= 2) { score = 90; severity = 'severe' }
    else if (finalSpan <= 4) { score = 65; severity = 'moderate' }
    else if (finalSpan <= 6) { score = 30; severity = 'mild' }

    onComplete({
      max_span: finalSpan,
      trials,
      score,
      severity,
      time_ms: Date.now() - startTime
    })
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-8 animate-in">
      <div className="text-center">
        <h2 className="font-display text-3xl mb-2" style={{ color: 'var(--navy-900)' }}>Digit Span Test</h2>
        <p className="text-sm text-gray-500">Attention & Working Memory</p>
      </div>

      {stage === 'intro' && (
        <div className="text-center space-y-6">
          <p className="max-w-md text-gray-600">
            You will see a sequence of numbers. Remember them and type them back in the same order.
          </p>
          <button onClick={startTest} className="px-10 py-3 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors">
            Start Test
          </button>
        </div>
      )}

      {stage === 'show' && (
        <div className="w-32 h-32 flex items-center justify-center bg-white rounded-3xl shadow-xl border border-teal-100">
          <span className="text-6xl font-display text-teal-600 animate-pulse">
            {currentIdx === -1 ? '' : sequence[currentIdx]}
          </span>
        </div>
      )}

      {stage === 'input' && (
        <div className="space-y-6 flex flex-col items-center">
          <div className="flex gap-2 mb-4">
            {sequence.map((_, i) => (
              <div key={i} className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-bold ${
                inputSequence[i] !== undefined ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-gray-200'
              }`}>
                {inputSequence[i] !== undefined ? inputSequence[i] : ''}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6,7,8,9,0].map(d => (
              <button 
                key={d} 
                onClick={() => handleDigit(d)}
                className="w-16 h-16 rounded-2xl bg-white border border-gray-200 text-2xl font-medium hover:bg-teal-50 hover:border-teal-300 transition-all active:scale-95"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === 'feedback' && (
        <div className="text-center">
          <p className={`text-2xl font-bold ${errors > 0 ? 'text-red-500' : 'text-teal-600'}`}>
            {errors > 0 ? 'Incorrect' : 'Correct!'}
          </p>
          <p className="text-gray-400 mt-2">Preparing next sequence...</p>
        </div>
      )}
    </div>
  )
}
