import type { MSEAssessment, RiskAssessment, ProsodyAssessment, FACSAssessment } from '../types'
import { YOLOAnalyser } from './yolo-analyser'

export interface AssessmentResult {
  assessment: MSEAssessment
  risk_assessment: RiskAssessment
  overall_severity: number
  clinical_summary: string
  diagnostic_impression: string
}

// Use a function to get the host at runtime to avoid Next.js build-time capture
const getOllamaHost = () => process.env.OLLAMA_HOST || 'ollama'
const OLLAMA_PORT = 11434

/**
 * Check if Ollama is running and reachable.
 */
async function checkOllamaHealth(): Promise<void> {
  const host = getOllamaHost()
  const port = OLLAMA_PORT
  const urls = [`http://${host}:${port}/api/tags`]
  
  // Fallback for local development if running outside Docker
  if (host === 'ollama') {
    urls.push(`http://localhost:${port}/api/tags`)
  }

  console.log(`[Clinical-AI] Probing Ollama endpoints: ${urls.join(', ')}`)
  
  let attempts = 0;
  const maxAttempts = 15;
  const retryDelay = 2000;
  
  while (attempts < maxAttempts) {
    attempts++;
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(3000),
        })
        if (res.ok) {
          const data = await res.json()
          console.log(`[Clinical-AI] Connection established to ${url}. Available models: ${data.models?.map((m: any) => m.name).join(', ') || 'none'}`)
          return;
        }
      } catch (err: any) {
        // Continue to check other URL or retry
      }
    }
    
    console.log(`[Clinical-AI] Attempt ${attempts}/${maxAttempts}: Ollama unreachable on all endpoints. Retrying in ${retryDelay/1000}s...`);
    
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw new Error(
    `Ollama unreachable at ${host}:${port} after ${maxAttempts} attempts. ` +
    `Ensure Docker container is running and healthy.`
  )
}

/**
 * Build the clinical prompt with explicit JSON schema so Llama3 returns valid AssessmentResult.
 */
function buildClinicalPrompt(
  transcript: string,
  patientContext: any,
  prosodyContext?: ProsodyAssessment,
  facsContext?: FACSAssessment,
  yoloFindings?: Partial<FACSAssessment>
): string {
  return `You are an expert clinical psychiatrist AI. Your goal is to synthesize multimodal behavior data into a precise, professional Mental Status Examination (MSE).

CLINICAL REASONING INSTRUCTIONS:
1. **Mood vs Affect**: Evaluate congruence between the patient's reported mood in transcript and the CV-captured Facial Affect.
2. **Cognitive Logic**: Look for formal thought disorders (tangentiality, circumstantiality) in the Whisper transcript.
3. **Risk Profile**: If there are ANY mentions of self-harm, hopelessness, or violence, escalate Risk to Moderate or High immediately.
4. **Severity Scoring**: Scores from 0 (Normal) to 100 (Pathological). Use a conservative approach: >70 requires significant evidence of pathology.

PATIENT CLINICAL CONTEXT:
- Age: ${patientContext.age}, Gender: ${patientContext.gender}
- Chief Complaint: ${patientContext.presenting_complaint}
- Psychosocial Stressors: ${patientContext.current_stressors || 'None reported'}

TRANSCRIPT (Whisper ASR):
${transcript || '[No speech detected]'}

VISION BIOMARKERS (YOLO/FACS):
- General Psychomotor: ${yoloFindings?.observations?.join(', ') || 'Normal'}
- Dominant Emotion: ${facsContext?.dominant_emotion || yoloFindings?.dominant_emotion || 'neutral'}
- Affect Range: ${facsContext?.affect_range || 'not assessed'}

PROSODY DATA:
- Speech Rate: ${prosodyContext?.speech_rate_wpm ?? 0} WPM (${prosodyContext?.speech_rate_category || 'unknown'})

RESPONSE SCHEMA (Return ONLY valid JSON):
{
  "assessment": {
    "appearance": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "grooming": "", "dress": "", "physical_characteristics": [] },
    "behavior": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "activity_level": "", "eye_contact": "", "rapport": "", "abnormal_movements": [] },
    "speech": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "rate": "normal|slow|fast|pressured|mute", "volume": "normal|soft|loud", "coherence": "coherent|loosely_associated|incoherent|tangential|circumstantial", "fluency": "fluent|dysarthric|stuttering|latent" },
    "mood": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "quality": "euthymic|depressed|anxious|irritable|euphoric|dysphoric", "intensity": "" },
    "affect": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "range": "full|restricted|flat|labile|blunted", "congruence": true, "stability": "" },
    "thought_process": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "organization": "organized|disorganized", "flight_of_ideas": false, "tangentiality": false, "circumstantiality": false, "thought_blocking": false, "perseveration": false },
    "thought_content": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "suicidal_ideation": false, "homicidal_ideation": false, "delusions_present": false, "delusion_types": [], "obsessions": false, "paranoid_themes": false },
    "perception": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "hallucinations_present": false, "hallucination_types": [], "illusions": false, "depersonalization": false, "derealization": false },
    "cognition": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "orientation": [], "attention_concentration": "", "memory_recall": "" },
    "insight_judgment": { "score": 0-100, "severity": "normal|mild|moderate|severe", "observations": [], "flags": [], "illness_awareness": "full|partial|none", "treatment_acceptance": "willing|ambivalent|refusing", "decision_making": "intact|impaired|severely_impaired", "social_judgment": "intact|impaired" }
  },
  "risk_assessment": { "suicide_risk": "none|low|moderate|high|imminent", "violence_risk": "none|low|moderate|high", "psychosis_probability": 0.0-1.0, "requires_immediate_action": false, "recommended_actions": [] },
  "overall_severity": 0-100,
  "clinical_summary": "...",
  "diagnostic_impression": "..."
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
      appearance: { ...defaultDomain, grooming: 'adequate', dress: 'appropriate', physical_characteristics: [] },
      behavior: { ...defaultDomain, activity_level: 'normal', eye_contact: 'appropriate', rapport: 'cooperative', abnormal_movements: [] },
      speech: { ...defaultDomain, rate: 'normal', volume: 'normal', coherence: 'coherent', fluency: 'fluent' },
      mood: { ...defaultDomain, quality: 'euthymic', intensity: 'normal' },
      affect: { ...defaultDomain, range: 'full', congruence: true, stability: 'stable' },
      thought_process: { ...defaultDomain, organization: 'organized', flight_of_ideas: false, tangentiality: false, circumstantiality: false, thought_blocking: false, perseveration: false },
      thought_content: { ...defaultDomain, suicidal_ideation: false, homicidal_ideation: false, delusions_present: false, delusion_types: [], obsessions: false, paranoid_themes: false },
      perception: { ...defaultDomain, hallucinations_present: false, hallucination_types: [], illusions: false, depersonalization: false, derealization: false },
      cognition: { ...defaultDomain, orientation: ['time', 'place', 'person'], attention_concentration: 'normal', memory_recall: 'normal' },
      insight_judgment: { ...defaultDomain, illness_awareness: 'full', treatment_acceptance: 'willing', decision_making: 'intact', social_judgment: 'intact' },
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
      appearance: mergeDomain(assessment.appearance, defaults.assessment.appearance),
      behavior: mergeDomain(assessment.behavior, defaults.assessment.behavior),
      speech: mergeDomain(assessment.speech, defaults.assessment.speech),
      mood: mergeDomain(assessment.mood, defaults.assessment.mood),
      affect: mergeDomain(assessment.affect, defaults.assessment.affect),
      thought_process: mergeDomain(assessment.thought_process, defaults.assessment.thought_process),
      thought_content: mergeDomain(assessment.thought_content, defaults.assessment.thought_content),
      perception: mergeDomain(assessment.perception, defaults.assessment.perception),
      cognition: mergeDomain(assessment.cognition, defaults.assessment.cognition),
      insight_judgment: mergeDomain(assessment.insight_judgment, defaults.assessment.insight_judgment),
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
  const host = getOllamaHost()
  console.log(`[Clinical-AI] Sending prompt to Ollama Llama3 at ${host}...`)
  const url = `http://${host}:${OLLAMA_PORT}/api/generate`

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
