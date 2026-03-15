'use client'

import React, { useState, useEffect } from 'react'

interface Props {
  onComplete: (data: { recalled_words: string[]; score: number; severity: string; time_ms: number }) => void
}

const WORD_LIST = ['Apple', 'Table', 'Penny', 'Lemon', 'Clock']

export default function WordRecall({ onComplete }: Props) {
  const [stage, setStage] = useState<'intro' | 'memorize' | 'distractor' | 'recall' | 'finished'>('intro')
  const [input, setInput] = useState('')
  const [recalled, setRecalled] = useState<string[]>([])
  const [timer, setTimer] = useState(15)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (stage === 'memorize' || stage === 'distractor') {
      interval = setInterval(() => {
        setTimer(t => {
          if (t <= 1) {
            clearInterval(interval)
            if (stage === 'memorize') { setStage('distractor'); return 10 }
            if (stage === 'distractor') { setStage('recall'); return 0 }
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [stage])

  const startTest = () => {
    setStage('memorize')
    setTimer(15)
  }

  const handleRecall = () => {
    const words = input.toLowerCase().split(/[ ,]+/).map(w => w.trim()).filter(w => w.length > 0)
    const matches = WORD_LIST.filter(target => words.includes(target.toLowerCase()))
    
    let score = 5
    let severity = 'normal'
    
    if (matches.length <= 1) { score = 85; severity = 'severe' }
    else if (matches.length <= 3) { score = 45; severity = 'moderate' }

    onComplete({
      recalled_words: matches,
      score,
      severity,
      time_ms: Date.now() - startTime
    })
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-8 animate-in text-center">
      <div className="">
        <h2 className="font-display text-3xl mb-2" style={{ color: 'var(--navy-900)' }}>Word Recall Test</h2>
        <p className="text-sm text-gray-500">Verbal Memory & Retention</p>
      </div>

      {stage === 'intro' && (
        <div className="space-y-6">
          <p className="max-w-md text-gray-600">
            You will be shown a list of 5 words. Memorize them, wait for a short distraction, and then recall as many as you can.
          </p>
          <button onClick={startTest} className="px-10 py-3 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors">
            Start Test
          </button>
        </div>
      )}

      {stage === 'memorize' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {WORD_LIST.map((w, i) => (
              <div key={i} className="text-4xl font-display text-teal-700 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 100}ms` }}>
                {w}
              </div>
            ))}
          </div>
          <p className="text-sm font-bold text-teal-500 uppercase tracking-widest mt-8">
            Memorize: {timer}s
          </p>
        </div>
      )}

      {stage === 'distractor' && (
        <div className="space-y-6">
          <p className="text-2xl font-display text-gray-400">Wait a moment...</p>
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
            Recall starts in: {timer}s
          </p>
        </div>
      )}

      {stage === 'recall' && (
        <div className="space-y-6 w-full max-w-sm">
          <p className="text-gray-600">Type all the words you remember, separated by commas or spaces.</p>
          <input 
            autoFocus
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border-2 border-teal-100 focus:border-teal-500 outline-none text-xl text-center"
            placeholder="e.g. apple, clock..."
            onKeyDown={e => { if (e.key === 'Enter') handleRecall() }}
          />
          <button onClick={handleRecall} className="w-full py-4 rounded-2xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition-all">
            Finish & Submit
          </button>
        </div>
      )}
    </div>
  )
}
