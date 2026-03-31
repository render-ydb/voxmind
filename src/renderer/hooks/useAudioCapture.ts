import { useRef, useCallback } from 'react'

const TARGET_SAMPLE_RATE = 16000

export function useAudioCapture() {
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true
      }
    })
    streamRef.current = stream

    const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
    contextRef.current = ctx

    const source = ctx.createMediaStreamSource(stream)
    // 4096 samples at 16kHz = 256ms per callback
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    processorRef.current = processor

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      // Copy because the buffer is reused
      const samples = new Float32Array(input.length)
      samples.set(input)
      window.electronAPI.sendAudioChunk(samples)
    }

    source.connect(processor)
    processor.connect(ctx.destination)
  }, [])

  const stop = useCallback(() => {
    processorRef.current?.disconnect()
    processorRef.current = null

    contextRef.current?.close()
    contextRef.current = null

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  return { start, stop }
}
