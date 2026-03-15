'use client'

import React, { useState, useEffect, useRef } from 'react'

interface Props {
  onComplete: (data: { completion_time_ms: number | null; error_count: number; score: number; severity: string; sequence_path: number[] }) => void
}

export default function TrailMaking({ onComplete }: Props) {
  const [stage, setStage] = useState<'intro' | 'test' | 'finished'>('intro')
  const [nodes, setNodes] = useState<{ id: number; x: number; y: number }[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [errors, setErrors] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [completed, setCompleted] = useState<number[]>([])
  
  const containerRef = useRef<HTMLDivElement>(null)

  const startTest = () => {
    generateNodes()
    setStage('test')
    setStartTime(Date.now())
  }

  const generateNodes = () => {
    const newNodes = []
    const count = 13
    
    for (let i = 1; i <= count; i++) {
      let x, y, overlap
      let attempts = 0
      do {
        overlap = false
        x = Math.random() * 70 + 15
        y = Math.random() * 70 + 15
        
        for (const node of newNodes) {
          const dx = node.x - x
          const dy = node.y - y
          if (Math.sqrt(dx*dx + dy*dy) < 18) overlap = true
        }
        attempts++
      } while (overlap && attempts < 100)
      
      newNodes.push({ id: i, x, y })
    }
    setNodes(newNodes)
  }

  const handleNodeClick = (id: number) => {
    if (id === currentIndex + 1) {
      const nextIdx = currentIndex + 1
      setCurrentIndex(nextIdx)
      setCompleted(prev => [...prev, id])
      
      if (nextIdx === nodes.length) {
        finish(false)
      }
    } else if (!completed.includes(id)) {
      setErrors(e => e + 1)
    }
  }

  const finish = (isTimeout: boolean) => {
    const endTime = Date.now()
    const duration = isTimeout ? null : endTime - startTime
    
    let score = 5
    let severity = 'normal'
    
    if (isTimeout) {
      score = 88
      severity = 'severe'
    } else {
      const seconds = (duration || 0) / 1000
      if (seconds > 90 || errors > 2) { score = 61; severity = 'moderate' }
      else if (seconds > 60) { score = 31; severity = 'mild' }
    }

    onComplete({
      completion_time_ms: duration,
      error_count: errors,
      score,
      severity,
      sequence_path: completed
    })
  }

  useEffect(() => {
    if (stage === 'test') {
      const t = setTimeout(() => finish(true), 90000)
      return () => clearTimeout(t)
    }
  }, [stage])

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-10 animate-in duration-500 w-full h-full">
      <div className="text-center space-y-2">
        <h2 className="font-display text-4xl font-black text-navy-900 tracking-tight">Trail Making (Level A)</h2>
        <div className="flex items-center justify-center gap-2">
           <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900/40">Domain: Executive Function & Motor Speed</p>
        </div>
      </div>

      {stage === 'intro' && (
        <div className="text-center space-y-8 animate-in slide-in-from-bottom-4">
          <div className="p-8 rounded-[32px] bg-teal-50 border border-teal-100/50 max-w-sm mx-auto">
            <p className="text-sm font-medium leading-relaxed text-teal-800">
               Connect the numeric markers sequentially from <span className="font-black underline underline-offset-4 decoration-teal-300">1 through 13</span>. Prioritize speed and accuracy.
            </p>
          </div>
          <button 
            onClick={startTest} 
            className="group flex items-center gap-4 px-10 py-5 rounded-2xl bg-teal-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-teal-900/20 hover:scale-105 active:scale-95 transition-all"
          >
            Launch Visual Trail
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {stage === 'test' && (
        <div ref={containerRef} className="relative w-full max-w-xl aspect-square bg-navy-50/30 rounded-[48px] shadow-inner border border-navy-900/5 overflow-hidden animate-in zoom-in-95 duration-700">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {completed.map((id, i) => {
              if (i === 0) return null
              const from = nodes.find(n => n.id === completed[i-1])!
              const to = nodes.find(n => n.id === id)!
              return (
                <line 
                  key={i}
                  x1={`${from.x}%`} y1={`${from.y}%`}
                  x2={`${to.x}%`} y2={`${to.y}%`}
                  stroke="var(--teal-500)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="animate-in fade-in transition-all duration-500"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(20,184,166,0.3))' }}
                />
              )
            })}
          </svg>

          {nodes.map(node => (
            <button
              key={node.id}
              onClick={() => handleNodeClick(node.id)}
              className={`absolute w-14 h-14 -ml-7 -mt-7 rounded-full flex items-center justify-center font-black transition-all shadow-xl group ${
                completed.includes(node.id) 
                  ? 'bg-teal-600 border-4 border-teal-400 text-white scale-90' 
                  : 'bg-white border-2 border-navy-900/10 text-navy-900 hover:border-teal-500 hover:scale-110'
              }`}
              style={{ left: `${node.x}%`, top: `${node.y}%`, zIndex: 10 }}
            >
              {node.id}
              {completed[completed.length-1] === node.id && (
                 <div className="absolute inset-[-4px] rounded-full border-2 border-teal-500 animate-ping opacity-30" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
