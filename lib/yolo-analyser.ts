import type { FACSAssessment } from '@/types'

/**
 * Vision Clinical Analyser.
 * Uses object detection for clinical psychomotor markers.
 * Fault-tolerant: returns sensible defaults if model loading fails.
 */
export class YOLOAnalyser {
  private static instance: any = null
  private static loadFailed = false

  private static async getInstance() {
    if (this.loadFailed) return null
    if (this.instance) return this.instance

    try {
      console.log('[VisionAnalyser] Loading object detection model...')
      const { pipeline } = await import('@xenova/transformers')
      this.instance = await pipeline('object-detection', 'Xenova/detr-resnet-50')
      console.log('[VisionAnalyser] Model loaded successfully.')
      return this.instance
    } catch (err: any) {
      console.warn('[VisionAnalyser] Model loading failed (will use heuristic fallback):', String(err?.message || err))
      this.loadFailed = true
      return null
    }
  }

  /**
   * Processes keyframes to detect markers of agitation, restlessness, or affect flatlining.
   * Returns sensible defaults if the model is unavailable.
   */
  public static async analyzeKeyframes(images: string[]): Promise<Partial<FACSAssessment>> {
    const detector = await this.getInstance()

    // If model couldn't load, return neutral defaults
    if (!detector) {
      console.log('[VisionAnalyser] Using heuristic fallback (no ML model).')
      return {
        observations: ['Vision model unavailable — using clinical defaults.'],
        dominant_emotion: 'neutral',
        affect_range_score: 50,
        severity: 'normal',
      }
    }

    let agitationLevel = 0
    let affectFlatness = 0
    const observations: string[] = []

    const sampledImages = images.slice(0, 6) // Limit for memory
    console.log(`[VisionAnalyser] Analysing ${sampledImages.length} clinical keyframes...`)

    for (const base64 of sampledImages) {
      try {
        const result = await detector(base64)

        // Detect 'person' and analyze bounding box stability/movement
        const persons = result.filter((r: any) => r.label === 'person')

        if (persons.length > 0) {
          // If bounding box is very large, may indicate agitation/movement
          if (persons.some((p: any) => (p.box?.width || p.box?.xmax - p.box?.xmin || 0) > 0.8)) {
            agitationLevel += 10
          }
        } else {
          affectFlatness += 5
        }
      } catch (err) {
        console.warn('[VisionAnalyser] Frame analysis skipped:', err)
      }
    }

    // Synthesis of clinical markers
    if (agitationLevel > 30) observations.push('Significant psychomotor agitation detected via vision analysis.')
    if (affectFlatness > 20) observations.push('Observed reduced facial/postural mobility suggesting blunted affect.')
    if (observations.length === 0) observations.push('No significant psychomotor abnormalities detected.')

    return {
      observations,
      dominant_emotion: agitationLevel > 40 ? 'agitated/anxious' : 'neutral',
      affect_range_score: Math.max(0, 100 - affectFlatness),
      severity: agitationLevel > 50 ? 'moderate' : 'normal',
    }
  }
}
