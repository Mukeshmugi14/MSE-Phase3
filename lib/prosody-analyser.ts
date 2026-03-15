import { ProsodyAssessment } from '@/types'

/**
 * Acoustic and Prosody Analyser for AI-MSE Phase 2.
 * Uses Web Audio API for client-side signal processing.
 */

export async function analyseProsody(
  audioBlob: Blob,
  transcriptWordCount: number,
  audioDurationSeconds: number
): Promise<ProsodyAssessment> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  
  const channelData = audioBuffer.getChannelData(0) // Use mono channel
  const sampleRate = audioBuffer.sampleRate
  
  // 1. Compute RMS energy in 100ms windows
  const windowSize = Math.floor(sampleRate * 0.1)
  const energies: number[] = []
  
  for (let i = 0; i < channelData.length; i += windowSize) {
    let sum = 0
    const end = Math.min(i + windowSize, channelData.length)
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j]
    }
    energies.push(Math.sqrt(sum / (end - i)))
  }
  
  // 2. Detect pauses (> 500ms where RMS < 0.01)
  const pauseThreshold = 0.005 // Slightly lower than 0.01 for better sensitivity
  const minPauseWindows = 5 // 5 * 100ms = 500ms
  let pauseCount = 0
  let totalPauseDuration = 0
  let currentPauseLength = 0
  
  energies.forEach((energy) => {
    if (energy < pauseThreshold) {
      currentPauseLength++
    } else {
      if (currentPauseLength >= minPauseWindows) {
        pauseCount++
        totalPauseDuration += currentPauseLength * 0.1
      }
      currentPauseLength = 0
    }
  })
  
  const pauseFrequency = (pauseCount / (audioDurationSeconds / 60)) || 0
  const pauseMeanDuration = (totalPauseDuration / pauseCount) * 1000 || 0
  
  // 3. Estimate Speech Rate (WPM)
  const speechRateWpm = (transcriptWordCount / (audioDurationSeconds / 60)) || 0
  let speechRateCategory: ProsodyAssessment['speech_rate_category'] = 'normal'
  if (speechRateWpm === 0) speechRateCategory = 'mute'
  else if (speechRateWpm < 80) speechRateCategory = 'slow'
  else if (speechRateWpm > 220) speechRateCategory = 'pressured'
  else if (speechRateWpm > 180) speechRateCategory = 'fast'
  
  // 4. Estimate Pitch (Basic Autocorrelation / Simplified YIN)
  // We sample 1s segments every 5s to save CPU
  const pitches: number[] = []
  const step = Math.floor(sampleRate * 5)
  const segmentLength = Math.floor(sampleRate * 1)
  
  for (let i = 0; i < channelData.length - segmentLength; i += step) {
    const segment = channelData.slice(i, i + segmentLength)
    const pitch = autoCorrelate(segment, sampleRate)
    if (pitch > 50 && pitch < 500) { // Clinical human range
      pitches.push(pitch)
    }
  }
  
  const pitchMean = pitches.length > 0 ? pitches.reduce((a, b) => a + b) / pitches.length : 0
  const pitchVar = pitches.length > 1 
    ? Math.sqrt(pitches.map(x => Math.pow(x - pitchMean, 2)).reduce((a, b) => a + b) / (pitches.length - 1)) 
    : 0

  // 5. Energy Variance
  const energyMean = energies.reduce((a, b) => a + b) / energies.length
  const energyVar = energies.map(x => Math.pow(x - energyMean, 2)).reduce((a, b) => a + b) / energies.length

  // 6. Latency to first response (approximate)
  let latency = 0
  for (let i = 0; i < energies.length; i++) {
    if (energies[i] > pauseThreshold) {
      latency = i * 100
      break
    }
  }

  // 7. Scoring & Observations
  const observations: string[] = []
  const flags: string[] = []
  let score = 0
  
  if (speechRateCategory === 'pressured') {
    score += 40
    flags.push('Pressured speech detected')
    observations.push('Rapid, forced speech rate suggesting possible mania or anxiety.')
  } else if (speechRateCategory === 'slow') {
    score += 20
    observations.push('Reduced speech rate possible indicator of psychomotor retardation.')
  }
  
  if (pitchVar < 10 && audioDurationSeconds > 10) {
    score += 15
    flags.push('Flat prosody / Monotone')
    observations.push('Restricted pitch variance suggesting blunted affect.')
  }
  
  if (pauseFrequency > 10) {
    score += 10
    flags.push('Frequent hesitations')
    observations.push('High frequency of pauses may indicate thought blocking or guardedness.')
  }

  const result: ProsodyAssessment = {
    speech_rate_wpm: Math.round(speechRateWpm),
    speech_rate_category: speechRateCategory,
    pause_frequency: Number(pauseFrequency.toFixed(1)),
    pause_mean_duration_ms: Math.round(pauseMeanDuration),
    pitch_mean_hz: Math.round(pitchMean),
    pitch_variance: Number(pitchVar.toFixed(2)),
    energy_mean: Number(energyMean.toFixed(4)),
    energy_variance: Number(energyVar.toFixed(4)),
    latency_first_response_ms: latency,
    prosody_score: Math.min(score, 100),
    severity: score > 70 ? 'severe' : score > 40 ? 'moderate' : score > 15 ? 'mild' : 'normal',
    observations,
    flags
  }

  await audioContext.close()
  return result
}

/**
 * Simple Autocorrelation for pitch detection
 */
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let SIZE = buf.length
  let rms = 0

  for (let i = 0; i < SIZE; i++) {
    rms += buf[i] * buf[i]
  }
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.01) return -1

  let r1 = 0, r2 = SIZE - 1, thres = 0.2
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) { r1 = i; break }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break }
  }

  const subBuf = buf.slice(r1, r2)
  SIZE = subBuf.length

  const c = new Array(SIZE).fill(0)
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + subBuf[j] * subBuf[j + i]
    }
  }

  let d = 0
  while (c[d] > c[d + 1]) d++
  let maxval = -1, maxpos = -1
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i]
      maxpos = i
    }
  }

  let T0 = maxpos
  return sampleRate / T0
}
