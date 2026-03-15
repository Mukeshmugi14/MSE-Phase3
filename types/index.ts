export type UserRole = 'psychiatrist' | 'resident' | 'counsellor'

export interface ClinicianProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  hospital: string
  registration_number: string
  created_at: string
}

export interface Patient {
  id: string
  clinician_id: string
  full_name: string
  age: number
  gender: 'male' | 'female' | 'other'
  phone?: string
  presenting_complaint: string
  referral_source?: string
  past_psychiatric_history?: string
  past_medical_history?: string
  substance_use?: string
  family_history?: string
  education?: string
  occupation?: string
  consent_obtained: boolean
  created_at: string
  updated_at: string
}

export interface MSEDomainScore {
  score: number          // 0–100, higher = more pathological
  severity: 'normal' | 'mild' | 'moderate' | 'severe'
  observations: string[] // key clinical observations
  flags: string[]        // specific clinical flags
}

export interface MSEAssessment {
  mood_affect: MSEDomainScore & {
    mood_quality: string
    affect_range: 'full' | 'restricted' | 'flat' | 'labile' | 'blunted'
    mood_congruence: boolean
  }
  speech: MSEDomainScore & {
    rate: 'normal' | 'slow' | 'fast' | 'pressured' | 'mute'
    volume: 'normal' | 'soft' | 'loud'
    coherence: 'coherent' | 'loosely_associated' | 'incoherent' | 'tangential' | 'circumstantial'
    fluency: 'fluent' | 'dysarthric' | 'stuttering' | 'latent'
  }
  thought_content: MSEDomainScore & {
    suicidal_ideation: boolean
    suicidal_ideation_detail?: string
    homicidal_ideation: boolean
    delusions_present: boolean
    delusion_types: string[]
    obsessions: boolean
    paranoid_themes: boolean
  }
  thought_process: MSEDomainScore & {
    organization: 'organized' | 'disorganized'
    flight_of_ideas: boolean
    tangentiality: boolean
    circumstantiality: boolean
    thought_blocking: boolean
    perseveration: boolean
  }
  perception?: MSEDomainScore & {
    hallucinations_present: boolean
    hallucination_types: string[]
    illusions: boolean
    depersonalization: boolean
    derealization: boolean
  }
  insight: MSEDomainScore & {
    illness_awareness: 'full' | 'partial' | 'none'
    treatment_acceptance: 'willing' | 'ambivalent' | 'refusing'
  }
  judgment: MSEDomainScore & {
    decision_making: 'intact' | 'impaired' | 'severely_impaired'
    social_judgment: 'intact' | 'impaired'
  }
}

export interface RiskAssessment {
  suicide_risk: 'none' | 'low' | 'moderate' | 'high' | 'imminent'
  suicide_risk_factors: string[]
  violence_risk: 'none' | 'low' | 'moderate' | 'high'
  violence_risk_factors: string[]
  psychosis_probability: number  // 0–1
  requires_immediate_action: boolean
  recommended_actions: string[]
}

export interface MSESession {
  id: string
  patient_id: string
  clinician_id: string
  transcript: string
  audio_duration_seconds?: number
  assessment: MSEAssessment | null
  risk_assessment: RiskAssessment | null
  overall_severity: number   // 0–100
  clinical_summary: string
  diagnostic_impression?: string
  clinician_notes?: string
  clinician_overrides?: Partial<MSEAssessment>
  session_date: string
  status: 'recording' | 'transcribing' | 'assessing' | 'complete' | 'error'
  facs_data?: FACSAssessment
  prosody_data?: ProsodyAssessment
  cognitive_data?: CognitiveAssessment
  created_at: string
  updated_at: string
}

export interface FACSFrame {
  timestamp: number
  landmarks: number[][]
  emotions: {
    neutral: number
    happy: number
    sad: number
    angry: number
    fearful: number
    disgusted: number
    surprised: number
  }
  affect_range_score: number
  congruence_flag: boolean
}

export interface FACSAssessment {
  frames_analysed: number
  dominant_emotion: string
  affect_range: 'full' | 'restricted' | 'flat' | 'labile' | 'blunted'
  affect_range_score: number
  congruence_score: number
  emotion_timeline: FACSFrame[]
  score: number
  severity: 'normal' | 'mild' | 'moderate' | 'severe'
  observations: string[]
  flags: string[]
}

export interface ProsodyAssessment {
  speech_rate_wpm: number
  speech_rate_category: 'mute' | 'slow' | 'normal' | 'fast' | 'pressured'
  pause_frequency: number
  pause_mean_duration_ms: number
  pitch_mean_hz: number
  pitch_variance: number
  energy_mean: number
  energy_variance: number
  latency_first_response_ms: number
  prosody_score: number
  severity: 'normal' | 'mild' | 'moderate' | 'severe'
  observations: string[]
  flags: string[]
}

export interface CognitiveAssessment {
  digit_span: {
    max_span: number
    score: number
    severity: string
    trials: number[][]
    time_ms: number
  }
  trail_making: {
    completion_time_ms: number | null
    error_count: number
    score: number
    severity: string
    sequence_path: number[]
  }
  word_recall: {
    words_presented: string[]
    words_recalled: string[]
    score_raw: number
    score: number
    severity: string
    intrusions: string[]
  }
  composite_score: number
  severity: 'normal' | 'mild' | 'moderate' | 'severe'
  observations: string[]
  flags: string[]
  completed_at: string
}

export interface DashboardStats {
  total_patients: number
  sessions_this_week: number
  high_risk_patients: number
  avg_session_duration: number
}
