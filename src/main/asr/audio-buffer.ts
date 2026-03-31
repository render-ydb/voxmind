/**
 * Ring buffer that accumulates PCM samples and yields 512-sample aligned windows
 * for Silero VAD consumption.
 */
export class AudioBuffer {
  private buffer: Float32Array
  private writePos = 0
  private readPos = 0
  private readonly windowSize: number

  constructor(windowSize = 512) {
    this.windowSize = windowSize
    // 60 seconds at 16kHz
    this.buffer = new Float32Array(16000 * 60)
  }

  write(samples: Float32Array): void {
    if (this.writePos + samples.length > this.buffer.length) {
      // Compact: move unread data to the beginning
      const unread = this.writePos - this.readPos
      this.buffer.copyWithin(0, this.readPos, this.writePos)
      this.readPos = 0
      this.writePos = unread
    }
    this.buffer.set(samples, this.writePos)
    this.writePos += samples.length
  }

  /** Returns the next window of `windowSize` samples, or null if not enough data. */
  readWindow(): Float32Array | null {
    if (this.writePos - this.readPos < this.windowSize) return null
    const window = this.buffer.slice(this.readPos, this.readPos + this.windowSize)
    this.readPos += this.windowSize
    return window
  }

  /** Drain all remaining samples (may be less than windowSize). */
  drain(): Float32Array | null {
    const remaining = this.writePos - this.readPos
    if (remaining <= 0) return null
    const data = this.buffer.slice(this.readPos, this.writePos)
    this.readPos = this.writePos
    return data
  }

  reset(): void {
    this.writePos = 0
    this.readPos = 0
  }
}
