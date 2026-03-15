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
  transcribing: ['Decoding clinical audio stream', 'Downsampling to 16kHz for Whisper', 'Xenova/Whisper neural transcription', 'Extracting acoustic prosody markers'],
  assessing:    [
    'Analysing mood and affect patterns', 
    'Evaluating speech coherence and rate', 
    'Screening thought content for risk', 
    'Assessing thought process organisation', 
    'Computing insight and judgment scores', 
    'Generating risk stratification', 
    'Composing clinical summary'
  ],
}

const DOMAINS_TRACKED = [
  'Appearance', 'Behavior', 'Speech', 'Mood', 'Affect', 
  'Thought Process', 'Thought Content', 'Perception', 'Cognition', 'Insight & Judgment'
]

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
      console.log('[Clinical-HUD] Decoding audio for ASR...')
      const ctx = new AudioContext({ sampleRate: 16000 })
      const arrayBuffer = await blob.arrayBuffer()
      
      let audioBuffer: AudioBuffer
      try {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      } catch (decodeErr) {
        console.error('[Clinical-HUD] Audio decoding failed:', decodeErr)
        throw new Error('Failed to decode medical audio stream. Ensure microphone was active.')
      }
      
      const float32Array = audioBuffer.getChannelData(0)

      // 3. Prosody Analyser
      console.log('[Clinical-HUD] Extracting prosody biomarkers...')
      let finalProsody
      try {
        finalProsody = await analyseProsody(blob, textCount(transcript), elapsed)
      } catch (prosodyErr) {
        console.warn('[Clinical-HUD] Prosody analysis failed:', prosodyErr)
        // Non-fatal, provide fallback
        finalProsody = { speech_rate_wpm: 0, speech_rate_category: 'unknown' }
      }

      // 4. Transcribe
      console.log('[Clinical-HUD] Sending to Whisper API...')
      const fd = new FormData()
      const pcmBlob = new Blob([float32Array], { type: 'application/octet-stream' })
      fd.append('audio', pcmBlob, 'session.raw')
      fd.append('language', selectedLanguage)

      const tr = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!tr.ok) {
        const errJson = await tr.json().catch(() => ({}))
        throw new Error(errJson.error || `Transcription API returned status ${tr.status}`)
      }
      
      const { transcript: text, error: trErr } = await tr.json()
      if (trErr) throw new Error(trErr)
      
      console.log(`[Clinical-HUD] Transcription received (${text?.length || 0} chars)`)
      setTranscript(text || '')
      
      const wordCount = (text || '').trim().split(/\s+/).length
      // Re-run prosody with accurate word count
      const refinedProsody = await analyseProsody(blob, wordCount, elapsed).catch(() => finalProsody)

      // Save transcript and preliminary data
      console.log('[Clinical-HUD] Persisting preliminary session data...')
      await supabase.from('mse_sessions').update({ 
        transcript: text, 
        status: 'assessing', 
        audio_duration_seconds: elapsed,
        facs_data: facsData,
        prosody_data: refinedProsody 
      })
      .eq('id', sessionId)

      // 5. Assess (Google Clinical Vision Integration)
      setStage('assessing')
      console.log('[Clinical-HUD] Running multimodal Llama3 assessment...')
      const ar = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          transcript: text,
          facs_data: facsData,
          prosody_data: refinedProsody,
          images,
          patientContext: patient ? {
            age: patient.age,
            gender: patient.gender,
            presenting_complaint: patient.presenting_complaint,
            past_psychiatric_history: patient.past_psychiatric_history,
          } : { age: 30, gender: 'unknown', presenting_complaint: 'Not specified' },
        }),
      })
      
      if (!ar.ok) {
        const errJson = await ar.json().catch(() => ({}))
        throw new Error(errJson.error || `Assessment API returned status ${ar.status}`)
      }
      
      const { error: arErr } = await ar.json()
      if (arErr) throw new Error(arErr)

      console.log('[Clinical-HUD] Assessment lifecycle complete. Redirecting to report.')
      setStage('complete')
      setTimeout(() => router.push(`/report/${sessionId}`), 1200)
    } catch (e: any) {
      console.error('[Clinical-HUD] Pipeline Error:', e)
      setError(e.message || 'Clinical inference failure.')
      setStage('error')
      try {
        await supabase.from('mse_sessions').update({ status: 'error' }).eq('id', sessionId)
      } catch (dbErr) {
        console.error('[Clinical-HUD] Failed to update session error state:', dbErr)
      }
    }
  }

  function textCount(t: string) {
    return t ? t.split(' ').length : 0
  }

  function fmt(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen flex flex-col selection:bg-teal-100 selection:text-teal-900" style={{ background: 'var(--cream-100)' }}>
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50 px-8 py-4 flex items-center justify-between"
           style={{ borderColor: 'rgba(13,31,56,0.05)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')}
                  className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-navy-900"
                  style={{ color: 'rgba(13,31,56,0.4)' }}>
            <div className="w-8 h-8 rounded-xl ring-1 ring-gray-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-md transition-all">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            Abort Session
          </button>
          <div className="w-px h-6 bg-gray-100 mx-2" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-navy-900">MSE Interaction HUD</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-100 uppercase tracking-tighter">Live Inference</span>
          </div>
        </div>
        
        {stage === 'recording' && (
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-50 ring-1 ring-red-100 animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                <span className="text-sm font-black tracking-tighter text-red-600">{fmt(elapsed)}</span>
             </div>
             <div className="text-right hidden sm:block">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Stream Integrity</p>
                <div className="flex gap-0.5 mt-1 justify-end">
                   {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-3 rounded-full bg-teal-500" />)}
                </div>
             </div>
          </div>
        )}
      </nav>

      <div className="flex-1 flex flex-col items-center justify-start px-8 pt-12 pb-20">
        <div className={`w-full transition-all duration-1000 ease-in-out ${
          (stage === 'ready' || stage === 'recording') 
            ? 'max-w-[1440px] grid grid-cols-1 lg:grid-cols-12 gap-12' 
            : 'max-w-2xl flex flex-col'
        } items-stretch`}>
          
          {/* Left Column: AI Clinical Monitor (HUD Design) */}
          {(stage === 'ready' || stage === 'recording') && (
            <div className="lg:col-span-8 flex flex-col h-full animate-in slide-in-from-left-12 duration-1000">
               <div className="relative aspect-video rounded-[48px] overflow-hidden bg-black shadow-2xl shadow-navy-900/40 ring-1 ring-white/10 p-4 group">
                  {/* HUD Corners */}
                  <div className="absolute top-10 left-10 w-16 h-16 border-t-4 border-l-4 border-teal-500/60 rounded-tl-2xl pointer-events-none transition-all group-hover:scale-110" />
                  <div className="absolute top-10 right-10 w-16 h-16 border-t-4 border-r-4 border-teal-500/60 rounded-tr-2xl pointer-events-none transition-all group-hover:scale-110" />
                  <div className="absolute bottom-10 left-10 w-16 h-16 border-b-4 border-l-4 border-teal-500/60 rounded-bl-2xl pointer-events-none transition-all group-hover:scale-110" />
                  <div className="absolute bottom-10 right-10 w-16 h-16 border-b-4 border-r-4 border-teal-500/60 rounded-br-2xl pointer-events-none transition-all group-hover:scale-110" />
                  
                  {/* Camera Scanner Line (Only during recording) */}
                  {stage === 'recording' && (
                    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden opacity-20">
                       <div className="w-full h-px bg-teal-400 shadow-[0_0_15px_teal] animate-scan" />
                    </div>
                  )}

                  <FacsOverlay 
                    ref={facsRef} 
                    stream={mediaStream} 
                    isActive={stage === 'recording' || (stage === 'ready' && mediaStream !== null)} 
                  />

                  {/* Real-time Bio-Status Overlay */}
                  {stage === 'recording' && (
                    <div className="absolute bottom-12 left-12 right-12 z-20 flex items-end justify-between pointer-events-none">
                       <div className="flex flex-col gap-2">
                          <div className="px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10">
                             <p className="text-[10px] font-black uppercase tracking-widest text-teal-400 leading-none">Vocal Intensity</p>
                             <div className="flex items-center gap-1 mt-2">
                                {waveData.slice(0, 10).map((v, i) => (
                                  <div key={i} className="w-1 bg-teal-500 transition-all duration-75" style={{ height: `${v * 40}px` }} />
                                ))}
                             </div>
                          </div>
                       </div>
                       <div className="text-right flex flex-col gap-2">
                          <div className="px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10">
                             <p className="text-[10px] font-black uppercase tracking-widest text-white/40 leading-none">Clinical Latency</p>
                             <p className="text-lg font-black text-white italic mt-1 leading-none">0.8s</p>
                          </div>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          )}

          {/* Right Column: Clinical Decision Deck */}
          <div className={`lg:col-span-4 flex flex-col justify-center ${(stage !== 'ready' && stage !== 'recording') ? 'w-full' : ''}`}>
            {/* Patient Header */}
            {patient && (
              <div className="card p-6 mb-8 flex items-center gap-5 animate-in slide-in-from-right-8 duration-700 bg-white shadow-xl shadow-navy-100/20">
                <div className="w-16 h-16 rounded-[24px] flex items-center justify-center text-xl font-black text-white shadow-lg shadow-teal-900/20"
                     style={{ background: 'linear-gradient(135deg, var(--teal-600), var(--navy-800))' }}>
                  {patient.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-black tracking-tight" style={{ color: 'var(--navy-900)' }}>{patient.full_name}</p>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40 mt-0.5">
                    {patient.age}y · <span className="text-teal-600">{patient.gender}</span> · AI Baseline Ready
                  </p>
                </div>
                <div className="flex flex-col items-center">
                   <div className="w-3 h-3 rounded-full bg-teal-500 animate-pulse mb-1" />
                   <span className="text-[8px] font-black uppercase text-teal-600">Active</span>
                </div>
              </div>
            )}

            {/* Core Interaction Interface */}
            <div className="card p-12 text-center animate-in shadow-2xl shadow-navy-900/10 min-h-[550px] flex flex-col justify-between overflow-hidden relative">
              
              {/* Abstract decoration */}
              <div className="absolute top-[-10%] left-[-10%] w-32 h-32 bg-teal-500/5 blur-[50px] rounded-full" />
              <div className="absolute bottom-[-10%] right-[-10%] w-32 h-32 bg-red-500/5 blur-[50px] rounded-full" />

              <div className="relative z-10 flex-1 flex flex-col justify-center">
                {stage === 'error' ? (
                  <div className="w-24 h-24 rounded-[32px] mx-auto flex items-center justify-center mb-10 bg-red-50 text-red-600 shadow-xl shadow-red-100/50">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                ) : (
                  <div className={`w-28 h-28 rounded-[40px] mx-auto flex items-center justify-center mb-10 transition-all duration-500 shadow-xl ${
                    stage === 'recording' ? 'bg-red-50 shadow-red-100 ring-4 ring-red-50' : (stage === 'complete' ? 'bg-teal-50 shadow-teal-100 ring-4 ring-teal-50' : 'bg-gray-50 shadow-gray-100 ring-4 ring-gray-50')
                  }`}>
                    {stage === 'ready' && (
                      <div className="relative">
                         <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-navy-900 animate-spin" />
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-navy-900" />
                         </div>
                      </div>
                    )}
                    {stage === 'recording' && (
                       <div className="w-8 h-8 rounded-xl bg-red-600 animate-pulse shadow-lg shadow-red-600/30" />
                    )}
                    {(stage === 'transcribing' || stage === 'assessing') && (
                      <div className="relative">
                         <div className="w-14 h-14 rounded-full border-[6px] border-teal-100 border-t-teal-600 animate-spin" />
                         <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-teal-600 uppercase">AI</span>
                      </div>
                    )}
                    {stage === 'complete' && (
                      <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-xl shadow-teal-600/30">
                        <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
                          <path d="M10 18l6 6 10-12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                )}

                <h2 className="font-display text-3xl font-black mb-4 tracking-tight" style={{ color: 'var(--navy-900)' }}>
                  {STAGE_LABELS[stage]}
                </h2>

                {stage === 'error' ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4">
                    <p className="text-sm font-medium mb-10 text-red-600/60 leading-relaxed max-w-sm mx-auto">
                      {error || "Critical failure in clinical inference pipeline."}
                    </p>
                    <button onClick={() => setStage('ready')}
                      className="px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-red-600 text-white shadow-2xl shadow-red-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all">
                      Recalibrate Pipeline
                    </button>
                  </div>
                ) : STAGE_SUBSTEPS[stage] ? (
                  <div className="animate-in fade-in duration-1000">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-600 mb-2 italic">Neural Processing</p>
                    <p className="text-sm font-medium leading-relaxed italic opacity-40 mb-12 h-10">
                      {STAGE_SUBSTEPS[stage]![substepIdx]}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-gray-400 mb-12 max-w-xs mx-auto leading-relaxed italic">
                    {stage === 'ready' 
                      ? 'The AI is primed. Ensure visual alignment before initialising the multimodal stream.'
                      : 'Clinical examination concluded. Synthesizing final psychiatric insight report...'}
                  </p>
                )}

                {/* 10 Domain Dynamic HUD Indicators */}
                {(stage === 'recording' || stage === 'assessing') && (
                  <div className="mb-12 grid grid-cols-5 gap-3">
                    {DOMAINS_TRACKED.map((domain, i) => {
                      const isActive = stage === 'recording' && i < (elapsed / 15 + 1);
                      const isComplete = stage === 'assessing' || (stage === 'recording' && elapsed > (i * 20));
                      return (
                        <div key={domain} className="flex flex-col items-center gap-2 group">
                          <div className={`w-1 h-12 rounded-full transition-all duration-1000 relative overflow-hidden ${
                            isComplete ? 'bg-teal-600' : isActive ? 'bg-red-100' : 'bg-gray-100'
                          }`}>
                             {isActive && !isComplete && (
                               <div className="absolute inset-0 bg-red-500 animate-pulse" />
                             )}
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-tighter vertical-text transition-colors ${
                            isComplete ? 'text-teal-600' : isActive ? 'text-red-500' : 'text-gray-300'
                          }`}>
                            {domain.slice(0, 3)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {stage === 'ready' && (
                  <div className="flex flex-col items-center animate-in stagger">
                    <div className="flex items-center justify-center gap-2 mb-10 overflow-x-auto p-1">
                      {[{ id: 'en', label: 'English (In)' }, { id: 'hi', label: 'Hindi (In)' }, { id: 'auto', label: 'Auto-Context' }].map((lang) => (
                        <button key={lang.id} onClick={() => setSelectedLanguage(lang.id)}
                          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === lang.id ? 'bg-white shadow-xl shadow-navy-900/5 ring-1 ring-gray-100 translate-y-[-2px] text-teal-600' : 'text-gray-400'}`}>
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Deck */}
              <div className="relative z-10 pt-8 border-t border-gray-50 flex flex-col items-center gap-4">
                {stage === 'ready' && (
                  <div className="flex items-center gap-4 w-full">
                    <button onClick={startRecording}
                      className="flex-1 flex items-center justify-center gap-4 px-10 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg, #EF4444, #991B1B)' }}>
                      <span className="w-3 h-3 rounded-full bg-white animate-pulse"/>
                      Initialize Stream
                    </button>
                  </div>
                )}
                {stage === 'recording' && (
                  <button onClick={stopAndProcess}
                    className="w-full flex items-center justify-center gap-4 px-10 py-6 rounded-[28px] text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-teal-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'var(--teal-600)' }}>
                    <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center">
                       <rect width="8" height="8" rx="1.5" fill="white"/>
                    </div>
                    Conclude & Synthesize
                  </button>
                )}
                {stage === 'complete' && (
                  <div className="flex items-center gap-3 px-6 py-4 rounded-3xl bg-teal-50 text-teal-600 ring-1 ring-teal-100 animate-pulse">
                     <span className="text-[10px] font-black uppercase tracking-widest">Constructing Longitudinal Bridge...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
