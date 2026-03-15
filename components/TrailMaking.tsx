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
    const padding = 60
    
    for (let i = 1; i <= count; i++) {
      let x, y, overlap
      let attempts = 0
      do {
        overlap = false
        x = Math.random() * 80 + 10 // 10% to 90%
        y = Math.random() * 80 + 10
        
        for (const node of newNodes) {
          const dx = node.x - x
          const dy = node.y - y
          if (Math.sqrt(dx*dx + dy*dy) < 15) overlap = true
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
      // Highlight error briefly
    }
  }

  const finish = (isTimeout: boolean) => {
    const endTime = Date.now()
    const duration = isTimeout ? null : endTime - startTime
    
    let score = 5
    let severity = 'normal'
    
    if (isTimeout) {
      score = 90
      severity = 'severe'
    } else {
      const seconds = (duration || 0) / 1000
      if (seconds > 90 || errors > 2) { score = 65; severity = 'moderate' }
      else if (seconds > 60) { score = 35; severity = 'mild' }
    }

    onComplete({
      completion_time_ms: duration,
      error_count: errors,
      score,
      severity,
      sequence_path: completed
    })
  }

  // Timeout after 90s
  useEffect(() => {
    if (stage === 'test') {
      const t = setTimeout(() => finish(true), 90000)
      return () => clearTimeout(t)
    }
  }, [stage])

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-8 animate-in h-full w-full">
      <div className="text-center">
        <h2 className="font-display text-3xl mb-2" style={{ color: 'var(--navy-900)' }}>Trail Making Test</h2>
        <p className="text-sm text-gray-500">Executive Function & Processing Speed</p>
      </div>

      {stage === 'intro' && (
        <div className="text-center space-y-6">
          <p className="max-w-md text-gray-600">
            Tap the numbers in order as fast as you can: 1 → 2 → 3 ... up to 13.
          </p>
          <button onClick={startTest} className="px-10 py-3 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors">
            Start Test
          </button>
        </div>
      )}

      {stage === 'test' && (
        <div ref={containerRef} className="relative w-full max-w-xl aspect-square bg-white rounded-3xl shadow-inner border border-gray-100 overflow-hidden">
          {/* Lines */}
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
                  stroke="var(--teal-400)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="animate-in fade-in"
                />
              )
            })}
          </svg>

          {/* Nodes */}
          {nodes.map(node => (
            <button
              key={node.id}
              onClick={() => handleNodeClick(node.id)}
              className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center font-bold transition-all shadow-sm border-2 ${
                completed.includes(node.id) 
                  ? 'bg-teal-600 border-teal-600 text-white' 
                  : 'bg-white border-gray-200 text-gray-700 hover:border-teal-400'
              }`}
              style={{ left: `${node.x}%`, top: `${node.y}%`, zIndex: 10 }}
            >
              {node.id}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
