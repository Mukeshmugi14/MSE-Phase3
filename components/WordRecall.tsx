'use client'

import React, { useState, useEffect } from 'react'

interface Props {
  onComplete: (data: { recalled_words: string[]; score: number; severity: string; time_ms: number }) => void
}

const WORD_LIST = ['Apple', 'Table', 'Penny', 'Lemon', 'Clock']

export default function WordRecall({ onComplete }: Props) {
  const [stage, setStage] = useState<'intro' | 'memorize' | 'distractor' | 'recall' | 'finished'>('intro')
  const [input, setInput] = useState('')
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
    
    if (matches.length <= 1) { score = 82; severity = 'severe' }
    else if (matches.length <= 3) { score = 42; severity = 'moderate' }

    onComplete({
      recalled_words: matches,
      score,
      severity,
      time_ms: Date.now() - startTime
    })
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-12 animate-in duration-500 text-center">
      <div className="space-y-2">
        <h2 className="font-display text-4xl font-black text-navy-900 tracking-tight">Word Recall Assessment</h2>
        <div className="flex items-center justify-center gap-2">
           <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900/40">Domain: Auditory-Verbal Memory</p>
        </div>
      </div>

      {stage === 'intro' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="p-8 rounded-[32px] bg-teal-50 border border-teal-100/50 max-w-sm mx-auto">
            <p className="text-sm font-medium leading-relaxed text-teal-800">
               Memorize the clinical word list. After a temporal distraction, you will be required to reconstruct the list from memory.
            </p>
          </div>
          <button 
            onClick={startTest} 
            className="group flex items-center gap-4 px-10 py-5 rounded-2xl bg-teal-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-teal-900/20 hover:scale-105 active:scale-95 transition-all"
          >
            Commence Encoding
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {stage === 'memorize' && (
        <div className="space-y-10 w-full animate-in zoom-in-95 duration-500">
          <div className="grid grid-cols-1 gap-6">
            {WORD_LIST.map((w, i) => (
              <div key={i} className="text-5xl font-display font-black text-teal-700 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 150}ms` }}>
                {w}
              </div>
            ))}
          </div>
          <div className="pt-10 flex flex-col items-center">
             <div className="text-[10px] font-black uppercase tracking-[0.3em] text-navy-900/40 mb-3">Encoding Phase</div>
             <div className="px-6 py-2 bg-navy-900 text-white rounded-full font-mono text-xs shadow-xl">
                00:{timer < 10 ? `0${timer}` : timer}
             </div>
          </div>
        </div>
      )}

      {stage === 'distractor' && (
        <div className="space-y-10 animate-in fade-in duration-500">
          <p className="text-3xl font-display font-medium text-navy-900/30">Neutralizing Memory Trace...</p>
          <div className="relative mx-auto">
             <div className="w-20 h-20 border-4 border-teal-500/10 rounded-full mx-auto" />
             <div className="absolute inset-0 w-20 h-20 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
          <div className="flex flex-col items-center">
             <div className="text-[10px] font-black uppercase tracking-[0.3em] text-navy-900/40 mb-3">Distraction Interval</div>
             <div className="px-6 py-2 bg-navy-900 text-white rounded-full font-mono text-xs shadow-xl">
                00:{timer < 10 ? `0${timer}` : timer}
             </div>
          </div>
        </div>
      )}

      {stage === 'recall' && (
        <div className="space-y-10 w-full max-w-sm animate-in slide-in-from-bottom-6 duration-700">
          <p className="text-sm font-medium text-navy-900/60 leading-relaxed italic"> Reconstruct the encoded word list below. Use commas or spaces to separate entries.</p>
          <div className="relative group">
            <input 
              autoFocus
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full px-8 py-6 rounded-[32px] bg-white border-none shadow-2xl shadow-navy-900/5 ring-1 ring-navy-900/5 focus:ring-2 focus:ring-teal-500 outline-none text-2xl font-black text-center placeholder:opacity-20 transition-all italic"
              placeholder="Recall words..."
              onKeyDown={e => { if (e.key === 'Enter') handleRecall() }}
            />
          </div>
          <button 
            onClick={handleRecall} 
            className="w-full py-5 rounded-2xl bg-navy-900 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-navy-900/30 hover:bg-navy-800 transition-all active:scale-95"
          >
            Finalize Recovery Phase
          </button>
        </div>
      )}
    </div>
  )
}
