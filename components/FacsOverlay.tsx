'use client'

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import * as faceapi from 'face-api.js'
import { FACSAnalyser } from '@/lib/facs-analyser'
import { FACSFrame, FACSAssessment } from '@/types'

/**
 * FacsOverlay Component — Clinical AI Vision Monitor
 * Real-time face detection, emotion recognition, and FACS analysis overlay.
 */
interface FacsOverlayProps {
  stream?: MediaStream | null
  isActive?: boolean
}

const EMOTION_COLORS: Record<string, string> = {
  neutral: '#94A3B8',
  happy: '#34D399',
  sad: '#60A5FA',
  angry: '#F87171',
  fearful: '#FBBF24',
  disgusted: '#A78BFA',
  surprised: '#FB923C',
}

const EMOTION_ICONS: Record<string, string> = {
  neutral: '😐',
  happy: '😊',
  sad: '😢',
  angry: '😠',
  fearful: '😨',
  disgusted: '🤢',
  surprised: '😲',
}

export const FacsOverlay = forwardRef<any, FacsOverlayProps>(({ stream, isActive: externalActive }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<FACSAnalyser>(new FACSAnalyser())
  const [isActive, setIsActive] = useState(externalActive ?? true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (externalActive !== undefined) {
      setIsActive(externalActive)
    }
  }, [externalActive])

  const [dominantEmotion, setDominantEmotion] = useState('neutral')
  const [confidence, setConfidence] = useState(0)
  const [emotionScores, setEmotionScores] = useState<Record<string, number>>({
    neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0,
  })
  const [faceDetected, setFaceDetected] = useState(false)
  const [framesAnalyzed, setFramesAnalyzed] = useState(0)
  const [frames, setFrames] = useState<string[]>([])
  const [affectLabel, setAffectLabel] = useState('Initializing...')
  const lastCaptureRef = useRef<number>(0)
  const emotionHistoryRef = useRef<string[]>([])

  useImperativeHandle(ref, () => ({
    getFACSAssessment: () => analyserRef.current.getSummary(),
    getFrames: () => frames,
    stop: () => setIsActive(false),
    start: () => setIsActive(true),
  }))

  useEffect(() => {
    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models/face-api'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models/face-api'),
        ])
        setIsLoaded(true)
        console.log('[FacsOverlay] Face-API models loaded successfully.')
      } catch (err) {
        console.error('[FacsOverlay] Failed to load FaceAPI models:', err)
        setLoadError(true)
      }
    }
    loadModels()
  }, [])

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // Draw face detection box on canvas
  const drawDetection = useCallback((detection: faceapi.WithFaceExpressions<{ detection: faceapi.FaceDetection }>) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Make canvas match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const box = detection.detection.box
    const scaleX = canvas.width / video.videoWidth
    const scaleY = canvas.height / video.videoHeight

    // Draw face bounding box
    ctx.strokeStyle = '#34D399'
    ctx.lineWidth = 2.5
    ctx.shadowColor = '#34D399'
    ctx.shadowBlur = 8

    // Rounded rectangle
    const x = box.x * scaleX
    const y = box.y * scaleY
    const w = box.width * scaleX
    const h = box.height * scaleY
    const r = 8

    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.stroke()

    // Draw corner brackets for a clinical/scanner look
    ctx.shadowBlur = 0
    ctx.lineWidth = 3
    ctx.strokeStyle = '#10B981'
    const bracketLen = 18

    // Top-left
    ctx.beginPath()
    ctx.moveTo(x, y + bracketLen); ctx.lineTo(x, y); ctx.lineTo(x + bracketLen, y)
    ctx.stroke()
    // Top-right
    ctx.beginPath()
    ctx.moveTo(x + w - bracketLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bracketLen)
    ctx.stroke()
    // Bottom-left
    ctx.beginPath()
    ctx.moveTo(x, y + h - bracketLen); ctx.lineTo(x, y + h); ctx.lineTo(x + bracketLen, y + h)
    ctx.stroke()
    // Bottom-right
    ctx.beginPath()
    ctx.moveTo(x + w - bracketLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bracketLen)
    ctx.stroke()
  }, [])

  useEffect(() => {
    if (!isLoaded || !isActive) return

    let requestRef: number
    let frameCount = 0

    const processFrame = async () => {
      if (!videoRef.current || !canvasRef.current || !isActive) return

      const video = videoRef.current
      if (video.readyState < 2 || video.videoWidth === 0) {
        requestRef = requestAnimationFrame(processFrame)
        return
      }

      // Only detect every 3rd frame for performance
      frameCount++
      if (frameCount % 3 !== 0) {
        requestRef = requestAnimationFrame(processFrame)
        return
      }

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceExpressions()

        if (detection) {
          setFaceDetected(true)

          // Draw bounding box
          drawDetection(detection)

          const emotions = detection.expressions
          const sorted = Object.entries(emotions).sort((a, b) => (b[1] as number) - (a[1] as number))
          const topEmotion = sorted[0][0]
          const topConfidence = sorted[0][1] as number

          setDominantEmotion(topEmotion)
          setConfidence(Math.round(topConfidence * 100))
          setEmotionScores({
            neutral: emotions.neutral,
            happy: emotions.happy,
            sad: emotions.sad,
            angry: emotions.angry,
            fearful: emotions.fearful,
            disgusted: emotions.disgusted,
            surprised: emotions.surprised,
          })

          // Track emotion history for affect range
          emotionHistoryRef.current.push(topEmotion)
          if (emotionHistoryRef.current.length > 100) emotionHistoryRef.current.shift()
          const uniqueEmotions = new Set(emotionHistoryRef.current).size
          if (uniqueEmotions <= 1) setAffectLabel('Flat Affect')
          else if (uniqueEmotions <= 2) setAffectLabel('Restricted Range')
          else if (uniqueEmotions <= 4) setAffectLabel('Full Range')
          else setAffectLabel('Labile')

          setFramesAnalyzed(prev => prev + 1)

          // Record frame data
          const frame: FACSFrame = {
            timestamp: Date.now(),
            landmarks: [],
            emotions: {
              neutral: emotions.neutral,
              happy: emotions.happy,
              sad: emotions.sad,
              angry: emotions.angry,
              fearful: emotions.fearful,
              disgusted: emotions.disgusted,
              surprised: emotions.surprised,
            },
            affect_range_score: 0,
            congruence_flag: false,
          }
          analyserRef.current.addFrame(frame)

          // Capture keyframes for vision analysis
          const now = Date.now()
          if (now - lastCaptureRef.current > 4000 && frames.length < 6) {
            const offscreen = document.createElement('canvas')
            offscreen.width = video.videoWidth
            offscreen.height = video.videoHeight
            const ctx = offscreen.getContext('2d')
            if (ctx) {
              ctx.drawImage(video, 0, 0)
              const base64 = offscreen.toDataURL('image/jpeg', 0.8)
              setFrames(prev => [...prev.slice(-5), base64])
              lastCaptureRef.current = now
            }
          }
        } else {
          setFaceDetected(false)
          // Clear canvas when no face detected
          const canvas = canvasRef.current
          if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx?.clearRect(0, 0, canvas.width, canvas.height)
          }
        }
      } catch (err) {
        // Silently continue on detection errors
      }

      requestRef = requestAnimationFrame(processFrame)
    }

    processFrame()
    return () => {
      if (requestRef) cancelAnimationFrame(requestRef)
    }
  }, [isLoaded, isActive, frames.length, drawDetection])

  // Sorted emotions for bar chart
  const sortedEmotions = Object.entries(emotionScores)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className={`relative w-full h-full transition-all duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
      <div className="h-full relative overflow-hidden bg-black rounded-[32px] shadow-2xl group border border-white/10">
        {/* Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Face Detection Canvas Overlay — NOW VISIBLE */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10 }}
        />

        {/* Top-left: Clinical Monitor Badge */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase"
               style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', color: faceDetected ? '#34D399' : '#fbbf24' }}>
            <span className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-emerald-400' : 'bg-yellow-400'}`}
                  style={{ animation: faceDetected ? 'facsPulse 2s infinite' : 'none' }} />
            {isLoaded ? (faceDetected ? 'Face Detected' : 'Searching...') : (loadError ? 'Model Error' : 'Loading AI...')}
          </div>
        </div>

        {/* Top-right: Frames counter */}
        <div className="absolute top-4 right-4 z-20">
          <div className="px-3 py-1.5 rounded-full text-[11px] font-medium"
               style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', color: '#94A3B8' }}>
            🎞️ {frames.length}/6 keyframes · {framesAnalyzed} analyzed
          </div>
        </div>

        {/* Bottom: Emotion HUD Panel */}
        {faceDetected && (
          <div className="absolute bottom-0 left-0 right-0 z-20 p-4"
               style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
            
            {/* Dominant Emotion + Affect */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{EMOTION_ICONS[dominantEmotion] || '😐'}</span>
                <div>
                  <p className="text-white text-sm font-semibold capitalize">
                    {dominantEmotion}
                    <span className="ml-2 text-xs font-normal" style={{ color: EMOTION_COLORS[dominantEmotion] }}>
                      {confidence}%
                    </span>
                  </p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Dominant Emotion
                  </p>
                </div>
              </div>

              {/* Affect Range Badge */}
              <div className="px-3 py-1 rounded-full text-[11px] font-semibold"
                   style={{
                     background: affectLabel === 'Flat Affect' ? 'rgba(248,113,113,0.2)' :
                                 affectLabel === 'Labile' ? 'rgba(251,191,36,0.2)' :
                                 'rgba(52,211,153,0.2)',
                     color: affectLabel === 'Flat Affect' ? '#F87171' :
                            affectLabel === 'Labile' ? '#FBBF24' :
                            '#34D399',
                     border: `1px solid ${affectLabel === 'Flat Affect' ? 'rgba(248,113,113,0.3)' :
                              affectLabel === 'Labile' ? 'rgba(251,191,36,0.3)' :
                              'rgba(52,211,153,0.3)'}`,
                   }}>
                {affectLabel}
              </div>
            </div>

            {/* Emotion Bars */}
            <div className="grid grid-cols-7 gap-1.5">
              {sortedEmotions.map(([emotion, score]) => (
                <div key={emotion} className="text-center">
                  <div className="h-12 relative rounded-md overflow-hidden mb-1"
                       style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-md transition-all duration-300"
                      style={{
                        height: `${Math.max(2, score * 100)}%`,
                        background: EMOTION_COLORS[emotion],
                        opacity: score > 0.1 ? 0.9 : 0.3,
                      }}
                    />
                  </div>
                  <p className="text-[9px] font-medium capitalize truncate block"
                     style={{ color: score === Math.max(...Object.values(emotionScores)) && score > 0.1
                       ? EMOTION_COLORS[emotion] : 'rgba(255,255,255,0.4)' }}>
                    {emotion.slice(0, 3)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No face — scanning animation */}
        {isLoaded && !faceDetected && isActive && (
          <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full border-2 border-dashed mx-auto mb-3 flex items-center justify-center"
                   style={{ borderColor: 'rgba(251,191,36,0.4)', animation: 'facsSpin 4s linear infinite' }}>
                <div className="w-16 h-16 rounded-full border border-dashed"
                     style={{ borderColor: 'rgba(251,191,36,0.2)', animation: 'facsSpin 6s linear infinite reverse' }} />
              </div>
              <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Position face in frame
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {!isLoaded && !loadError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center"
               style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="text-center">
              <div className="w-10 h-10 border-2 rounded-full mx-auto mb-3 animate-spin"
                   style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#34D399' }} />
              <p className="text-xs text-white/60">Loading AI Vision Models...</p>
            </div>
          </div>
        )}
      </div>

      {/* Global keyframe styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes facsPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes facsSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  )
})

FacsOverlay.displayName = 'FacsOverlay'
