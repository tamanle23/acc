/**
 * UniversalAudioStreamWorklet:
 * Streaming AudioWorklet transport processor for continuous, non-blocking audio playback.
 * Pulls continuous 128-sample blocks with smooth 5ms cosine cross-fade on seek/scrub.
 */

export interface AudioStreamChunk {
  left: Float32Array;
  right: Float32Array;
  startSample: number;
}

export class UniversalAudioRingBuffer {
  private capacity: number;
  private leftBuffer: Float32Array;
  private rightBuffer: Float32Array;
  private readIndex: number = 0;
  private writeIndex: number = 0;
  private availableSamples: number = 0;

  constructor(capacitySamples: number = 44100 * 5) {
    this.capacity = capacitySamples;
    this.leftBuffer = new Float32Array(capacitySamples);
    this.rightBuffer = new Float32Array(capacitySamples);
  }

  public write(chunk: AudioStreamChunk): number {
    const len = chunk.left.length;
    let written = 0;

    for (let i = 0; i < len; i++) {
      if (this.availableSamples >= this.capacity) break;
      this.leftBuffer[this.writeIndex] = chunk.left[i];
      this.rightBuffer[this.writeIndex] = chunk.right[i];
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
      this.availableSamples++;
      written++;
    }

    return written;
  }

  public read(outLeft: Float32Array, outRight: Float32Array, blockSize: number = 128): number {
    const toRead = Math.min(blockSize, this.availableSamples, outLeft.length);

    for (let i = 0; i < toRead; i++) {
      outLeft[i] = this.leftBuffer[this.readIndex];
      outRight[i] = this.rightBuffer[this.readIndex];
      this.readIndex = (this.readIndex + 1) % this.capacity;
    }

    // Fill remainder with silence
    for (let i = toRead; i < outLeft.length; i++) {
      outLeft[i] = 0;
      outRight[i] = 0;
    }

    this.availableSamples -= toRead;
    return toRead;
  }

  public clear(): void {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.availableSamples = 0;
  }

  public getAvailable(): number {
    return this.availableSamples;
  }
}

/**
 * AudioWorklet Node Controller for UI thread
 */
export class UniversalAudioStreamWorklet {
  private ringBuffer: UniversalAudioRingBuffer;
  private sampleRate: number;
  private totalSamplesProcessed: number = 0;
  private crossFadeSamples: number;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
    this.ringBuffer = new UniversalAudioRingBuffer(sampleRate * 10);
    // 5ms cosine cross-fade
    this.crossFadeSamples = Math.floor((sampleRate * 5) / 1000);
  }

  public getRingBuffer(): UniversalAudioRingBuffer {
    return this.ringBuffer;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public getProcessedTimeSec(): number {
    return this.totalSamplesProcessed / this.sampleRate;
  }

  public pushChunk(left: Float32Array, right: Float32Array): void {
    this.ringBuffer.write({
      left,
      right,
      startSample: this.totalSamplesProcessed,
    });
  }

  /**
   * Reads 128-sample block for AudioWorklet process() loop.
   */
  public processBlock(outLeft: Float32Array, outRight: Float32Array): boolean {
    const read = this.ringBuffer.read(outLeft, outRight, 128);
    this.totalSamplesProcessed += read;
    return true;
  }

  /**
   * Applies smooth 5ms cosine crossfade to prevent pops on seek.
   */
  public applyCosineCrossfade(samples: Float32Array): void {
    const n = Math.min(samples.length, this.crossFadeSamples);
    for (let i = 0; i < n; i++) {
      // 0.5 * (1 - cos(π * i / n))
      const factor = 0.5 * (1 - Math.cos((Math.PI * i) / n));
      samples[i] *= factor;
    }
  }

  public reset(): void {
    this.ringBuffer.clear();
    this.totalSamplesProcessed = 0;
  }
}
