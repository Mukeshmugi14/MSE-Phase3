import { NextRequest, NextResponse } from 'next/server'
import { pipeline, env } from '@xenova/transformers'

// Disable local models since we want it to seamlessly download the model cache
env.allowLocalModels = false
env.useBrowserCache = false // Node.js does not have a browser cache

// Load the model centrally to avoid reloading it on every request
// We use a singleton pattern for the pipeline
class PipelineSingleton {
  static task = 'automatic-speech-recognition'
  static model = 'Xenova/whisper-small' // Optimized for 3GB VRAM (prevents OOM crashes)
  static instance: any = null

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline(this.task as any, this.model)
    }
    return this.instance
  }
}

export async function POST(req: NextRequest) {
  console.log('[API/Transcribe] Start transcription request...')
  try {
    const formData = await req.formData()
    const audioBlob = formData.get('audio') as Blob | null
    const language = formData.get('language') as string || 'en'

    if (!audioBlob) {
      console.error('[API/Transcribe] No audio blob found in form data')
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    console.log(`[API/Transcribe] Audio blob size: ${audioBlob.size} bytes | Language: ${language}`)

    // Convert the Blob to a Float32Array
    const arrayBuffer = await audioBlob.arrayBuffer()
    
    // Safety check: Ensure the buffer is a multiple of 4 for Float32Array
    const float32Length = Math.floor(arrayBuffer.byteLength / 4)
    const audioData = new Float32Array(arrayBuffer, 0, float32Length)
    
    console.log(`[API/Transcribe] Buffer decoded. Byte length: ${arrayBuffer.byteLength}, Float32 length: ${audioData.length}`)

    if (audioData.length === 0) {
      console.error('[API/Transcribe] Audio data is empty after decoding')
      return NextResponse.json({ error: 'Audio data is empty' }, { status: 400 })
    }

    // Load pipeline
    console.log('[API/Transcribe] Loading Whisper small singleton...')
    const transcriber = await PipelineSingleton.getInstance()
    console.log('[API/Transcribe] Whisper model initialized and ready.')

    // Pass the raw float32array to Whisper
    console.log('[API/Transcribe] Running inference...')
    const output = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: language === 'auto' ? undefined : language,
      task: 'transcribe',
      no_repeat_ngram_size: 4,
      repetition_penalty: 1.1,
      num_beams: 1, 
    })

    console.log(`[API/Transcribe] Transcription success. Length: ${output.text?.length || 0}`)
    return NextResponse.json({ transcript: output.text })
  } catch (error: any) {
    console.error('[API/Transcribe] CRITICAL ERROR:', error)
    return NextResponse.json({ error: `Transcription failed: ${error.message || 'Unknown error'}` }, { status: 500 })
  }
}

