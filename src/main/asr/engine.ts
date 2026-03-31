import { getSenseVoiceModelPath, getSenseVoiceTokensPath, getSileroVadPath } from '../model-manager.js'
import { AudioBuffer } from './audio-buffer.js'

// sherpa-onnx-node is a CJS module; use createRequire for ESM compat
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const sherpa = require('sherpa-onnx-node')

type ResultCallback = (text: string) => void

export class ASREngine {
  private vad: any
  private recognizer: any
  private audioBuffer: AudioBuffer
  private running = false
  private accumulatedText = ''
  private onPartial: ResultCallback | null = null

  constructor() {
    this.audioBuffer = new AudioBuffer(512)

    // Initialize Silero VAD
    const vadConfig = {
      sileroVad: {
        model: getSileroVadPath(),
        threshold: 0.5,
        minSilenceDuration: 0.5,
        minSpeechDuration: 0.25,
        windowSize: 512,
        maxSpeechDuration: 10
      },
      sampleRate: 16000,
      numThreads: 1,
      debug: 0
    }
    this.vad = new sherpa.Vad(vadConfig, 60)
    console.log('[asr] VAD initialized')

    // Initialize SenseVoice offline recognizer
    const recognizerConfig = {
      modelConfig: {
        senseVoice: {
          model: getSenseVoiceModelPath(),
          language: '',  // auto-detect
          useInverseTextNormalization: 1
        },
        tokens: getSenseVoiceTokensPath(),
        numThreads: 2,
        debug: 0,
        provider: 'cpu'
      }
    }
    this.recognizer = new sherpa.OfflineRecognizer(recognizerConfig)
    console.log('[asr] SenseVoice recognizer initialized')
  }

  setPartialCallback(cb: ResultCallback): void {
    this.onPartial = cb
  }

  start(): void {
    this.running = true
    this.accumulatedText = ''
    this.audioBuffer.reset()
    this.vad.reset()
    console.log('[asr] Recording started')
  }

  feedAudio(samples: Float32Array): string | null {
    if (!this.running) return null

    this.audioBuffer.write(samples)

    let resultChanged = false

    // Feed 512-sample windows to VAD
    let window: Float32Array | null
    while ((window = this.audioBuffer.readWindow()) !== null) {
      this.vad.acceptWaveform(window)

      // Drain any completed speech segments
      while (!this.vad.isEmpty()) {
        const segment = this.vad.front(false)
        this.vad.pop()

        // Transcribe the segment
        const text = this.transcribeSegment(segment.samples)
        if (text) {
          this.accumulatedText += (this.accumulatedText ? ' ' : '') + text
          resultChanged = true
        }
      }
    }

    if (resultChanged) {
      this.onPartial?.(this.accumulatedText)
      return this.accumulatedText
    }
    return null
  }

  stop(): string {
    this.running = false
    console.log('[asr] Recording stopped, flushing...')

    // Flush any remaining audio through VAD
    // Pad with silence to ensure VAD emits the last segment
    const silence = new Float32Array(512 * 4) // ~128ms of silence
    for (let i = 0; i < 4; i++) {
      this.vad.acceptWaveform(silence.subarray(i * 512, (i + 1) * 512))
    }
    this.vad.flush()

    // Drain remaining segments
    while (!this.vad.isEmpty()) {
      const segment = this.vad.front(false)
      this.vad.pop()

      const text = this.transcribeSegment(segment.samples)
      if (text) {
        this.accumulatedText += (this.accumulatedText ? ' ' : '') + text
      }
    }

    console.log('[asr] Final result:', this.accumulatedText)
    return this.accumulatedText.trim()
  }

  private transcribeSegment(samples: Float32Array): string {
    const stream = this.recognizer.createStream()
    stream.acceptWaveform({ sampleRate: 16000, samples })
    this.recognizer.decode(stream)
    const result = this.recognizer.getResult(stream)
    const text = (result.text || '').trim()
    if (text) {
      console.log('[asr] Segment transcribed:', text)
    }
    return text
  }
}
