/**
 * UniversalAudioStreamWorklet:
 * Streaming AudioWorklet transport processor for continuous, non-blocking audio playback.
 * Pulls continuous 128-sample blocks with smooth 5ms cosine cross-fade on seek/scrub.
 * Backed by SharedArrayRingBuffer for lock-free zero-allocation audio streaming.
 */

import { SharedArrayRingBuffer, type IAudioStreamTransport } from './SharedArrayRingBuffer';

export interface AudioStreamChunk {
  left: Float32Array;
  right: Float32Array;
  startSample: number;
}

/**
 * UniversalAudioStreamWorklet:
 * AudioWorklet Node Controller for UI thread and Audio DSP pipeline.
 */
export class UniversalAudioStreamWorklet {
  private ringBuffer: SharedArrayRingBuffer;
  private sampleRate: number;
  private totalSamplesProcessed: number = 0;
  private crossFadeSamples: number;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
    this.ringBuffer = new SharedArrayRingBuffer({ sampleRate, capacitySeconds: 10 });
    // 5ms cosine cross-fade
    this.crossFadeSamples = Math.floor((sampleRate * 5) / 1000);
  }

  public getRingBuffer(): SharedArrayRingBuffer {
    return this.ringBuffer;
  }

  public getTransport(): IAudioStreamTransport {
    return this.ringBuffer;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public getProcessedTimeSec(): number {
    return this.totalSamplesProcessed / this.sampleRate;
  }

  public pushChunk(left: Float32Array, right: Float32Array): number {
    const written = this.ringBuffer.write(left, right);
    this.totalSamplesProcessed += written;
    return written;
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
    this.ringBuffer.reset();
    this.totalSamplesProcessed = 0;
  }
}

export { SharedArrayRingBuffer };
