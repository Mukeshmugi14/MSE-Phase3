import { FACSAssessment, FACSFrame } from '@/types'

/**
 * FACS Analyser for AI-MSE Phase 2.
 * Processes facial landmarks and emotions to calculate clinical affect metrics.
 */

export class FACSAnalyser {
  private frames: FACSFrame[] = []
  private startTime: number = 0

  constructor() {
    this.startTime = Date.now()
  }

  public addFrame(frame: FACSFrame) {
    this.frames.push(frame)
  }

  public getSummary(): FACSAssessment {
    const framesCount = this.frames.length
    if (framesCount === 0) {
      return {
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
    }

    // 1. Determine dominant emotion
    const emotionTotals: Record<string, number> = {
      neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0
    }
    
    this.frames.forEach(f => {
      Object.entries(f.emotions).forEach(([emo, val]) => {
        emotionTotals[emo] += val
      })
    })
    
    const dominantEmotion = Object.entries(emotionTotals).reduce((a, b) => a[1] > b[1] ? a : b)[0]

    // 2. Calculate Affect Range Score (0-100)
    // Based on Standard Deviation of the dominant emotion's probability over time
    const domEmoProbs = this.frames.map(f => (f.emotions as any)[dominantEmotion])
    const mean = domEmoProbs.reduce((a, b) => a + b) / framesCount
    const variance = domEmoProbs.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / framesCount
    const stdDev = Math.sqrt(variance)
    
    // Scale StdDev to 0-100 (0.05 SD is roughly restricted, 0.2+ is labile)
    let affectRangeScore = Math.min(stdDev * 400, 100) 
    
    let affectRange: FACSAssessment['affect_range'] = 'full'
    if (affectRangeScore < 20) affectRange = 'flat'
    else if (affectRangeScore < 40) affectRange = 'restricted'
    else if (affectRangeScore < 60) affectRange = 'full'
    else if (affectRangeScore < 80) affectRange = 'blunted'
    else affectRange = 'labile'

    // 3. Clinical Pathology Score (0-100)
    let pathologyScore = 0
    const observations: string[] = []
    const flags: string[] = []

    if (affectRange === 'flat' || affectRange === 'blunted') {
      pathologyScore += 40
      observations.push(`Patient exhibited ${affectRange} affect with minimal emotional variation.`)
      flags.push('Flat/Blunted Affect')
    } else if (affectRange === 'labile') {
      pathologyScore += 50
      observations.push('Highly labile affect observed during the session.')
      flags.push('Emotional Lability')
    }

    if (dominantEmotion === 'sad' && mean > 0.3) {
      pathologyScore += 30
      observations.push('Persistently sad facial expression noted across the duration of the interview.')
      flags.push('Persistent Sadness')
    }
    
    if (dominantEmotion === 'angry' && mean > 0.2) {
      pathologyScore += 40
      observations.push('Frequent indicators of anger or irritability detected via facial expressions.')
      flags.push('Irritability/Hostility')
    }
    
    if (affectRange === 'flat' && framesCount > 60) {
      observations.push('Clinical indicator: Facial mobility is significantly reduced (Flat Affect), which may be associated with depressive or negative symptoms.')
    }

    // 4. Congruence (Initial estimate, refined by AI later)
    const congruenceScore = 100 // Default to congruent until compared with mood quality

    return {
      frames_analysed: framesCount,
      dominant_emotion: dominantEmotion,
      affect_range: affectRange,
      affect_range_score: Math.round(affectRangeScore),
      congruence_score: congruenceScore,
      emotion_timeline: this.frames.filter((_, i) => i % 5 === 0), // Sample for timeline
      score: Math.min(pathologyScore, 100),
      severity: pathologyScore > 70 ? 'severe' : pathologyScore > 40 ? 'moderate' : pathologyScore > 15 ? 'mild' : 'normal',
      observations,
      flags
    }
  }
}
