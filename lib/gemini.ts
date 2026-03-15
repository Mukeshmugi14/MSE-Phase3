import type { MSEAssessment, RiskAssessment, ProsodyAssessment, FACSAssessment } from '../types'
import { YOLOAnalyser } from './yolo-analyser'

export interface AssessmentResult {
  assessment: MSEAssessment
  risk_assessment: RiskAssessment
  overall_severity: number
  clinical_summary: string
  diagnostic_impression: string
}

const OLLAMA_HOST = '127.0.0.1'
const OLLAMA_PORT = 11434

/**
 * Check if Ollama is running and reachable.
 */
async function checkOllamaHealth(): Promise<void> {
  try {
    const res = await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      throw new Error(`Ollama returned status ${res.status}`)
    }
    const data = await res.json()
    console.log(`[Clinical-AI] Ollama is running. Available models: ${data.models?.map((m: any) => m.name).join(', ') || 'none'}`)
  } catch (err: any) {
    throw new Error(
      `Ollama is not running or unreachable at ${OLLAMA_HOST}:${OLLAMA_PORT}. ` +
      `Please start Ollama (https://ollama.ai) and pull gemma3 with: ollama pull gemma3:4b. ` +
      `Details: ${String(err?.message || err)}`
    )
  }
}

/**
 * Build the clinical prompt with explicit JSON schema so Llama3 returns valid AssessmentResult.
 */
function buildClinicalPrompt(
  transcript: string,
  patientContext: { age: number; gender: string; presenting_complaint: string; past_psychiatric_history?: string; substance_use?: string },
  prosodyContext?: ProsodyAssessment,
  facsContext?: FACSAssessment,
  yoloFindings?: Partial<FACSAssessment>
): string {
  return `You are a clinical psychiatrist AI. Synthesize ALL provided data into a DSM-5 Mental Status Examination.

PATIENT CONTEXT:
- Age: ${patientContext.age}, Gender: ${patientContext.gender}
- Presenting Complaint: ${patientContext.presenting_complaint}
- Psychiatric History: ${patientContext.past_psychiatric_history || 'None reported'}
- Substance Use: ${patientContext.substance_use || 'None reported'}

TRANSCRIPT (from Whisper):
${transcript || '[No speech detected — silent interaction]'}

VISION MARKERS (from YOLO/FACS):
- Psychomotor observations: ${yoloFindings?.observations?.join(', ') || 'No significant findings'}
- Dominant Emotion: ${facsContext?.dominant_emotion || yoloFindings?.dominant_emotion || 'neutral'}
- Affect Range: ${facsContext?.affect_range || 'not assessed'}
- Affect Score: ${facsContext?.affect_range_score ?? 'N/A'}

PROSODY DATA:
- Speech Rate: ${prosodyContext?.speech_rate_wpm ?? 0} WPM (${prosodyContext?.speech_rate_category || 'unknown'})
- Pitch Mean: ${prosodyContext?.pitch_mean_hz ?? 0} Hz, Variance: ${prosodyContext?.pitch_variance ?? 0}
- Pause Frequency: ${prosodyContext?.pause_frequency ?? 0}/min
- Prosody Flags: ${prosodyContext?.flags?.join(', ') || 'None'}

INSTRUCTIONS: Return ONLY a valid JSON object with EXACTLY this structure (no markdown, no explanation, just JSON):
{
  "assessment": {
    "mood_affect": {
      "score": <0-100>,
      "severity": "<normal|mild|moderate|severe>",
      "observations": ["..."],
      "flags": ["..."],
      "mood_quality": "<euthymic|depressed|anxious|irritable|euphoric|dysphoric>",
      "affect_range": "<full|restricted|flat|labile|blunted>",
      "mood_congruence": <true|false>
    },
    "speech": {
      "score": <0-100>,
      "severity": "<normal|mild|moderate|severe>",
      "observations": ["..."],
      "flags": ["..."],
      "rate": "<normal|slow|fast|pressured|mute>",
      "volume": "<normal|soft|loud>",
      "coherence": "<coherent|loosely_associated|incoherent|tangential|circumstantial>",
      "fluency": "<fluent|dysarthric|stuttering|latent>"
    },
    "thought_content": {
      "score": <0-100>,
      "severity": "<normal|mild|moderate|severe>",
      "observations": ["..."],
      "flags": ["..."],
      "suicidal_ideation": <true|false>,
      "homicidal_ideation": <true|false>,
      "delusions_present": <true|false>,
      "delusion_types": [],
      "obsessions": <true|false>,
      "paranoid_themes": <true|false>
    },
    "thought_process": {
      "score": <0-100>,
      "severity": "<normal|mild|moderate|severe>",
      "observations": ["..."],
      "flags": ["..."],
      "organization": "<organized|disorganized>",
      "flight_of_ideas": <true|false>,
      "tangentiality": <true|false>,
      "circumstantiality": <true|false>,
      "thought_blocking": <true|false>,
      "perseveration": <true|false>
    },
    "perception": {
      "score": <0-100>,
      "severity": "<normal|mild|moderate|severe>",
      "observations": ["..."],
      "flags": ["..."],
      "hallucinations_present": <true|false>,
      "hallucination_types": [],
      "illusions": <true|false>,
      "depersonalization": <true|false>,
      "derealization": <true|false>
    },
    "insight": {
      "score": <0-100>,
      "severity": "<normal|mild|moderate|severe>",
      "observations": ["..."],
      "flags": ["..."],
      "illness_awareness": "<full|partial|none>",
      "treatment_acceptance": "<willing|ambivalent|refusing>"
    },
    "judgment": {
      "score": <0-100>,
      "severity": "<normal|mild|moderate|severe>",
      "observations": ["..."],
      "flags": ["..."],
      "decision_making": "<intact|impaired|severely_impaired>",
      "social_judgment": "<intact|impaired>"
    }
  },
  "risk_assessment": {
    "suicide_risk": "<none|low|moderate|high|imminent>",
    "suicide_risk_factors": ["..."],
    "violence_risk": "<none|low|moderate|high>",
    "violence_risk_factors": ["..."],
    "psychosis_probability": <0.0-1.0>,
    "requires_immediate_action": <true|false>,
    "recommended_actions": ["..."]
  },
  "overall_severity": <0-100>,
  "clinical_summary": "<2-4 sentence clinical summary>",
  "diagnostic_impression": "<diagnostic impression based on DSM-5>"
}`
}

/**
 * Robust JSON extractor for LLM outputs.
 * Handles markdown code fences, preamble text, and trailing text.
 */
function extractJson(input: string): string {
  let text = input.trim()

  // Remove markdown code fences
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  // Find the first { and last } to extract the JSON object
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No valid JSON object found in LLM response')
  }

  return text.substring(firstBrace, lastBrace + 1)
}

/**
 * Build a safe default AssessmentResult for when LLM output is missing fields.
 */
function buildDefaultResult(): AssessmentResult {
  const defaultDomain = {
    score: 0,
    severity: 'normal' as const,
    observations: ['Unable to fully assess from available data.'],
    flags: [],
  }

  return {
    assessment: {
      mood_affect: { ...defaultDomain, mood_quality: 'euthymic', affect_range: 'full', mood_congruence: true },
      speech: { ...defaultDomain, rate: 'normal', volume: 'normal', coherence: 'coherent', fluency: 'fluent' },
      thought_content: { ...defaultDomain, suicidal_ideation: false, homicidal_ideation: false, delusions_present: false, delusion_types: [], obsessions: false, paranoid_themes: false },
      thought_process: { ...defaultDomain, organization: 'organized', flight_of_ideas: false, tangentiality: false, circumstantiality: false, thought_blocking: false, perseveration: false },
      perception: { ...defaultDomain, hallucinations_present: false, hallucination_types: [], illusions: false, depersonalization: false, derealization: false },
      insight: { ...defaultDomain, illness_awareness: 'full', treatment_acceptance: 'willing' },
      judgment: { ...defaultDomain, decision_making: 'intact', social_judgment: 'intact' },
    },
    risk_assessment: {
      suicide_risk: 'none',
      suicide_risk_factors: [],
      violence_risk: 'none',
      violence_risk_factors: [],
      psychosis_probability: 0,
      requires_immediate_action: false,
      recommended_actions: ['Routine follow-up recommended.'],
    },
    overall_severity: 0,
    clinical_summary: 'Assessment generated with limited data. Clinical review recommended.',
    diagnostic_impression: 'Insufficient data for definitive impression. Further evaluation needed.',
  }
}

/**
 * Deep-merge LLM output with defaults so every required field exists.
 */
function mergeWithDefaults(parsed: any): AssessmentResult {
  const defaults = buildDefaultResult()

  const mergeDomain = (llm: any, def: any) => {
    if (!llm || typeof llm !== 'object') return def
    return { ...def, ...llm, observations: llm.observations || def.observations, flags: llm.flags || def.flags }
  }

  const assessment = parsed.assessment || {}

  return {
    assessment: {
      mood_affect: mergeDomain(assessment.mood_affect, defaults.assessment.mood_affect),
      speech: mergeDomain(assessment.speech, defaults.assessment.speech),
      thought_content: mergeDomain(assessment.thought_content, defaults.assessment.thought_content),
      thought_process: mergeDomain(assessment.thought_process, defaults.assessment.thought_process),
      perception: mergeDomain(assessment.perception, defaults.assessment.perception),
      insight: mergeDomain(assessment.insight, defaults.assessment.insight),
      judgment: mergeDomain(assessment.judgment, defaults.assessment.judgment),
    },
    risk_assessment: {
      ...defaults.risk_assessment,
      ...(parsed.risk_assessment || {}),
    },
    overall_severity: typeof parsed.overall_severity === 'number' ? parsed.overall_severity : defaults.overall_severity,
    clinical_summary: parsed.clinical_summary || defaults.clinical_summary,
    diagnostic_impression: parsed.diagnostic_impression || defaults.diagnostic_impression,
  }
}

/**
 * 100% Offline Specialized Clinical Engine.
 * Combines Whisper (Audio) + YOLO (Vision) + Llama3 (Logic).
 */
export async function runMSEAssessment(
  transcript: string,
  patientContext: {
    age: number
    gender: string
    presenting_complaint: string
    past_psychiatric_history?: string
    substance_use?: string
  },
  prosodyContext?: ProsodyAssessment,
  facsContext?: FACSAssessment,
  images?: string[] // Base64 keyframes
): Promise<AssessmentResult> {

  console.log('[Clinical-AI/Offline] Initiating Specialized Diagnostic Cluster...')

  // 0. Health check — fail fast with a clear message
  await checkOllamaHealth()

  // 1. Run YOLO Vision Analysis (Local) — fault-tolerant
  let yoloFindings: Partial<FACSAssessment> = {}
  if (images && images.length > 0) {
    try {
      yoloFindings = await YOLOAnalyser.analyzeKeyframes(images)
    } catch (err: any) {
      console.warn('[Clinical-AI] YOLO vision analysis failed (non-fatal):', String(err?.message || err))
      yoloFindings = { observations: ['Vision analysis unavailable'], dominant_emotion: 'neutral' }
    }
  }

  // 2. Build clinical prompt with full JSON schema
  const localPrompt = buildClinicalPrompt(transcript, patientContext, prosodyContext, facsContext, yoloFindings)

  // 3. Call Ollama Llama3
  console.log('[Clinical-AI] Sending prompt to Ollama Llama3...')
  const url = `http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/generate`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:4b',
        prompt: localPrompt,
        format: 'json',
        stream: false,
        options: {
          temperature: 0.3,       // Low temperature for structured clinical output
          num_predict: 4096,      // Ensure enough tokens for full JSON
        }
      }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout for large models
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown')
      throw new Error(`Ollama returned HTTP ${response.status}: ${errorBody}`)
    }

    const data = await response.json()

    if (!data.response) {
      throw new Error('Ollama returned empty response. The model may still be loading — please try again in a moment.')
    }

    console.log(`[Clinical-AI] Raw LLM response length: ${data.response.length} chars`)

    // 4. Parse and validate
    const jsonStr = extractJson(data.response)
    let parsed: any

    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('[Clinical-AI] JSON parse failed. Raw response:', data.response.substring(0, 500))
      throw new Error('Llama3 returned malformed JSON. Retrying may help.')
    }

    // 5. Merge with defaults to guarantee all fields exist
    const result = mergeWithDefaults(parsed)
    console.log(`[Clinical-AI] Assessment complete. Overall severity: ${result.overall_severity}`)
    return result

  } catch (err: any) {
    const msg = String(err?.message || err || 'Unknown error')
    console.error('[Clinical-AI] Ollama generate failed:', msg)
    throw new Error(`Offline specialized engine failure: ${msg}`)
  }
}
