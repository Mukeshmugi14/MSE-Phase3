'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import type { Patient } from '@/types'
import { FacsOverlay } from '@/components/FacsOverlay'
import { analyseProsody } from '@/lib/prosody-analyser'

type Stage = 'ready' | 'recording' | 'transcribing' | 'assessing' | 'complete' | 'error'

const STAGE_LABELS: Record<Stage, string> = {
  ready:       'Ready to record',
  recording:   'Recording session…',
  transcribing:'Transcribing audio…',
  assessing:   'Running AI assessment…',
  complete:    'Assessment complete',
  error:       'Error occurred',
}

const STAGE_SUBSTEPS: Partial<Record<Stage, string[]>> = {
  transcribing: ['Converting audio to text via Whisper', 'Extracting clinical keywords', 'Preparing transcript for analysis'],
  assessing:    ['Analysing mood and affect patterns', 'Evaluating speech coherence and rate', 'Screening thought content for risk', 'Assessing thought process organisation', 'Computing insight and judgment scores', 'Generating risk stratification', 'Composing clinical summary'],
}

export default function SessionPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const sessionId    = params.id as string
  const patientId    = searchParams.get('patientId')

  const [stage, setStage]           = useState<Stage>('ready')
  const [patient, setPatient]       = useState<Patient | null>(null)
  const [transcript, setTranscript] = useState('')
  const [substepIdx, setSubstepIdx] = useState(0)
  const [elapsed, setElapsed]       = useState(0)
  const [error, setError]           = useState('')
  const [audioBlob, setAudioBlob]   = useState<Blob | null>(null)
  const [waveData, setWaveData]     = useState<number[]>(Array(40).fill(0.1))
  const [selectedLanguage, setSelectedLanguage] = useState('en')

  const mediaRef   = useRef<MediaRecorder | null>(null)
  const chunksRef  = useRef<Blob[]>([])
  const timerRef   = useRef<NodeJS.Timeout>()
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>()
  const facsRef = useRef<any>(null)

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    if (!patientId) return
    supabase.from('patients').select('*').eq('id', patientId).single()
      .then(({ data }) => { if (data) setPatient(data) })
  }, [patientId])

  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    if (stage === 'ready') {
      navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(stream => setMediaStream(stream))
        .catch(err => setError('Camera/Microphone access denied.'))
    }

    if (stage === 'recording') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => {
      clearInterval(timerRef.current)
    }
  }, [stage])

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach(t => t.stop())
    }
  }, [mediaStream])

  // Cycle through sub-steps during long-running stages
  useEffect(() => {
    const steps = STAGE_SUBSTEPS[stage]
    if (!steps) return
    setSubstepIdx(0)
    const iv = setInterval(() => setSubstepIdx(i => (i + 1) % steps.length), 2200)
    return () => clearInterval(iv)
  }, [stage])

  // Waveform animation during recording
  const animateWave = useCallback(() => {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.fftSize)
    analyserRef.current.getByteTimeDomainData(data)
    const bars = Array.from({ length: 40 }, (_, i) => {
      const v = data[Math.floor(i * data.length / 40)]
      return Math.max(0.05, Math.abs((v - 128) / 128))
    })
    setWaveData(bars)
    animFrameRef.current = requestAnimationFrame(animateWave)
  }, [])

  async function startRecording() {
    try {
      let stream = mediaStream
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        setMediaStream(stream)
      }
      
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser

      // Use video/webm for combined recording
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') 
        ? 'video/webm;codecs=vp8,opus' 
        : 'video/webm'
        
      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(t => t.stop())
        setMediaStream(null)
        cancelAnimationFrame(animFrameRef.current!)
        analyserRef.current = null
      }
      mr.start(100)
      mediaRef.current = mr
      setStage('recording')
      setElapsed(0)
      animFrameRef.current = requestAnimationFrame(animateWave)
    } catch (e) {
      setError('Microphone access denied. Please allow microphone access and try again.')
    }
  }

  async function stopAndProcess() {
    if (!mediaRef.current) return
    
    // 1. FACS Assessment (Extract immediately before unmount)
    const facsData = facsRef.current?.getFACSAssessment() || {
      frames_analysed: 0,
      dominant_emotion: 'neutral',
      affect_range: 'flat',
      affect_range_score: 0,
      congruence_score: 100,
      emotion_timeline: [],
      score: 0,
      severity: 'normal',
      observations: ['No facial data captured.'],
      flags: []
    }
    const images = facsRef.current?.getFrames() || [] // Captured Google Vision keyframes
    
    // Now stop the stream and change UI state
    mediaRef.current.stop()
    setStage('transcribing')

    // Wait for onstop to fire
    await new Promise(r => setTimeout(r, 600))
    const blob = chunksRef.current.length > 0
      ? new Blob(chunksRef.current, { type: 'video/webm' })
      : audioBlob

    if (!blob) { setError('No audio recorded.'); setStage('error'); return }

    try {
      // 2. Decode audio and downsample to 16kHz for Whisper
      const ctx = new AudioContext({ sampleRate: 16000 })
      const arrayBuffer = await blob.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const float32Array = audioBuffer.getChannelData(0)

      // 3. Prosody Analyser
      // Use original blob for prosody because it needs standard sample rate
      const prosodyData = await analyseProsody(blob, textCount(transcript), elapsed)

      // 4. Transcribe
      const fd = new FormData()
      const pcmBlob = new Blob([float32Array], { type: 'application/octet-stream' })
      fd.append('audio', pcmBlob, 'session.raw')
      fd.append('language', selectedLanguage)

      const tr = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const { transcript: text, error: trErr } = await tr.json()
      if (trErr) throw new Error(trErr)
      setTranscript(text || '')
      
      const wordCount = (text || '').trim().split(/\s+/).length
      // Re-run prosody with accurate word count if transcript is ready
      const finalProsody = await analyseProsody(blob, wordCount, elapsed)

      // Save transcript and preliminary data
      await supabase.from('mse_sessions').update({ 
        transcript: text, 
        status: 'assessing', 
        audio_duration_seconds: elapsed,
        facs_data: facsData,
        prosody_data: finalProsody 
      })
      .eq('id', sessionId)

      // 5. Assess (Google Clinical Vision)
      setStage('assessing')
      const ar = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          transcript: text,
          facs_data: facsData,
          prosody_data: finalProsody,
          images, // Multimodal keyframes
          patientContext: patient ? {
            age: patient.age,
            gender: patient.gender,
            presenting_complaint: patient.presenting_complaint,
            past_psychiatric_history: patient.past_psychiatric_history,
            substance_use: patient.substance_use,
          } : { age: 30, gender: 'unknown', presenting_complaint: 'Not specified' },
        }),
      })
      const { error: arErr } = await ar.json()
      if (arErr) throw new Error(arErr)

      setStage('complete')
      setTimeout(() => router.push(`/report/${sessionId}`), 1200)
    } catch (e: any) {
      setError(e.message || 'Assessment failed.')
      setStage('error')
      await supabase.from('mse_sessions').update({ status: 'error' }).eq('id', sessionId)
    }
  }

  function textCount(t: string) {
    return t ? t.split(' ').length : 0
  }

  function fmt(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream-100)' }}>
      {/* Nav */}
      <nav className="bg-white border-b px-8 py-4 flex items-center gap-4"
           style={{ borderColor: 'rgba(13,31,56,0.08)' }}>
        <button onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 text-sm"
                style={{ color: 'rgba(13,31,56,0.5)' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </button>
        <span style={{ color: 'rgba(13,31,56,0.2)' }}>/</span>
        <span className="text-sm font-medium" style={{ color: 'var(--navy-900)' }}>MSE Session</span>
        {stage === 'recording' && (
          <span className="ml-auto flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--risk-high)' }}>
            <span className="w-2 h-2 rounded-full bg-red-600 recording-dot"/>
            {fmt(elapsed)}
          </span>
        )}
      </nav>

      <div className="flex-1 flex flex-col items-center justify-start px-8 pt-10 pb-20">
        <div className={`w-full transition-all duration-700 ease-in-out ${
          (stage === 'ready' || stage === 'recording') 
            ? 'max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-10' 
            : 'max-w-2xl flex flex-col'
        } items-stretch min-h-[500px]`}>
          
          {/* Left Column: AI Clinical Monitor */}
          {(stage === 'ready' || stage === 'recording') && (
            <div className="flex flex-col h-full rounded-[40px] overflow-hidden bg-black/5 border border-black/5 p-2 min-h-[400px] animate-in slide-in-from-left-10 duration-700">
              <FacsOverlay 
                ref={facsRef} 
                stream={mediaStream} 
                isActive={stage === 'recording' || (stage === 'ready' && mediaStream !== null)} 
              />
            </div>
          )}

          {/* Right Column: Clinical Controls */}
          <div className={`flex flex-col justify-center ${(stage !== 'ready' && stage !== 'recording') ? 'w-full' : ''}`}>
            {/* Patient card */}
            {patient && (
              <div className="card p-5 mb-6 flex items-center gap-4 animate-in">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-medium text-white flex-shrink-0"
                     style={{ background: 'var(--teal-600)' }}>
                  {patient.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium" style={{ color: 'var(--navy-900)' }}>{patient.full_name}</p>
                  <p className="text-sm" style={{ color: 'rgba(13,31,56,0.5)' }}>
                    {patient.age}y · {patient.gender} · {patient.presenting_complaint}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-100 text-teal-800 border border-teal-200 uppercase tracking-tighter">
                  Vision Active
                </span>
              </div>
            )}

            {/* Main session card */}
            <div className="card p-10 text-center animate-in min-h-[400px] flex flex-col justify-center shadow-xl">
              <div className="mb-8">
                {stage === 'error' ? (
                  <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-6 bg-red-50 text-red-500">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                ) : (
                  <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-6 transition-all ${stage === 'recording' ? 'recording-dot' : ''}`}
                    style={{
                      background: stage === 'recording' ? '#FEE2E2' : (stage === 'complete' ? 'var(--teal-50)' : 'var(--cream-200)')
                    }}>
                    {stage === 'ready' && (
                      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
                        <circle cx="18" cy="18" r="8" stroke="rgba(13,31,56,0.3)" strokeWidth="1.5"/>
                        <path d="M18 6v3M18 27v3" stroke="rgba(13,31,56,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    )}
                    {stage === 'recording' && <div className="w-4 h-4 rounded-sm" style={{ background: 'var(--risk-high)' }}/>}
                    {(stage === 'transcribing' || stage === 'assessing') && (
                      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(13,31,56,0.15)', borderTopColor: 'var(--teal-600)' }}/>
                    )}
                    {stage === 'complete' && (
                      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
                        <path d="M10 18l6 6 10-12" stroke="var(--teal-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                )}

                <h2 className="font-display text-2xl font-medium mb-2" style={{ color: 'var(--navy-900)' }}>
                  {STAGE_LABELS[stage]}
                </h2>

                {stage === 'error' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-sm mb-6 text-red-600/80 font-medium max-w-sm mx-auto">
                      {error || "An unexpected error occurred during the clinical session."}
                    </p>
                    <button onClick={() => setStage('ready')}
                      className="px-6 py-2 rounded-xl text-sm font-medium bg-red-600 text-white shadow-lg shadow-red-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                      Try Again
                    </button>
                  </div>
                )}

                {STAGE_SUBSTEPS[stage] && (
                  <p className="text-sm transition-all" style={{ color: 'rgba(13,31,56,0.5)', minHeight: '1.4rem' }}>
                    {STAGE_SUBSTEPS[stage]![substepIdx]}
                  </p>
                )}

                {stage === 'ready' && (
                  <div className="flex flex-col items-center">
                    <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'rgba(13,31,56,0.5)' }}>
                      Start the interview. The AI will analyze clinical markers in the background.
                    </p>
                    <div className="flex items-center justify-center gap-2 mb-2 animate-in flex-wrap">
                      {[{ id: 'en', label: 'English' }, { id: 'hi', label: 'Hindi' }, { id: 'auto', label: 'Auto Detect' }].map((lang) => (
                        <button key={lang.id} onClick={() => setSelectedLanguage(lang.id)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${selectedLanguage === lang.id ? 'bg-white shadow-sm ring-1 ring-black/5' : 'text-black/40'}`}
                          style={{ background: selectedLanguage === lang.id ? 'white' : 'transparent' }}>
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Waveform */}
              {stage === 'recording' && (
                <div className="flex items-center justify-center gap-0.5 h-12 mb-8 px-4">
                  {waveData.map((v, i) => (
                    <div key={i} className="flex-1 rounded-full bg-red-600/20" style={{ height: `${Math.max(4, v * 50)}px`, maxWidth: '6px' }}/>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-3">
                {stage === 'ready' && (
                  <>
                    <button onClick={startRecording}
                      className="flex items-center gap-3 px-8 py-3.5 rounded-xl font-medium text-white shadow-lg shadow-red-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: 'var(--risk-high)' }}>
                      <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"/>
                      Start Clinical Interview
                    </button>
                    <button onClick={() => router.push('/dashboard')}
                      className="px-8 py-3.5 rounded-xl font-medium transition-all hover:bg-black/5"
                      style={{ color: 'rgba(13,31,56,0.5)', border: '1px solid rgba(13,31,56,0.1)' }}>
                      Cancel & Return
                    </button>
                  </>
                )}
                {stage === 'recording' && (
                  <button onClick={stopAndProcess}
                    className="flex items-center gap-3 px-10 py-4 rounded-xl font-medium text-white shadow-lg shadow-teal-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'var(--teal-600)' }}>
                    <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor"/>
                    Stop & Assess
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
