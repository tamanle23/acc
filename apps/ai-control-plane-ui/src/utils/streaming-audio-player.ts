/**
 * Ultra-low latency Real-Time Streaming Audio Player using Web Audio API.
 *
 * Consumes chunked binary WAV streams or raw PCM chunks, decodes them sequentially via
 * AudioContext.decodeAudioData(), schedules gap-free timeline playback,
 * and feeds raw FFT/time-domain data into an AnalyserNode for live visualization.
 */

export interface StreamingAudioMetrics {
  ttfaMs: number | null;
  chunksReceived: number;
  totalBytes: number;
  playbackDurationSec: number;
  rtf: number | null;
}

function toArrayBuffer(buf: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

function buildWavHeader(
  pcmByteLength: number,
  sampleRate: number,
  numChannels: number = 1,
  bitsPerSample: number = 16
): ArrayBuffer {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;

  // "RIFF"
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + pcmByteLength, true);
  // "WAVE"
  view.setUint32(8, 0x57415645, false);
  // "fmt "
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // "data"
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, pcmByteLength, true);

  return buffer;
}

export class StreamingAudioPlayer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private scheduledEndTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isPlaying: boolean = false;
  private abortController: AbortController | null = null;
  private accumulatedBytes: Uint8Array = new Uint8Array(0);
  private tStart: number = 0;

  // Default audio parameters parsed from stream
  private detectedSampleRate: number = 48000;
  private detectedChannels: number = 1;
  private detectedBitsPerSample: number = 16;
  private hasSeenWavHeader: boolean = false;

  public metrics: StreamingAudioMetrics = {
    ttfaMs: null,
    chunksReceived: 0,
    totalBytes: 0,
    playbackDurationSec: 0,
    rtf: null,
  };

  private onMetricsUpdate?: (m: StreamingAudioMetrics) => void;

  constructor(onMetrics?: (m: StreamingAudioMetrics) => void) {
    this.onMetricsUpdate = onMetrics;
  }

  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  get active(): boolean {
    return this.isPlaying;
  }

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    if (!this.analyser) {
      const an = this.ctx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.8;
      an.connect(this.ctx.destination);
      this.analyser = an;
    }
    return this.ctx;
  }

  /**
   * Reset timeline and state for a fresh streaming execution.
   */
  startStream(expectedRtf?: number, defaultSampleRate?: number): void {
    this.stop();
    const ctx = this.initContext();
    this.isPlaying = true;
    this.abortController = new AbortController();
    this.scheduledEndTime = ctx.currentTime;
    this.accumulatedBytes = new Uint8Array(0);
    this.hasSeenWavHeader = false;
    if (defaultSampleRate) {
      this.detectedSampleRate = defaultSampleRate;
    }

    this.metrics = {
      ttfaMs: null,
      chunksReceived: 0,
      totalBytes: 0,
      playbackDurationSec: 0,
      rtf: expectedRtf ?? null,
    };
    this.tStart = performance.now();
    this.onMetricsUpdate?.({ ...this.metrics });
  }

  /**
   * Feed a new raw binary chunk from an async streaming response.
   */
  async feedChunk(value: Uint8Array): Promise<void> {
    if (!this.isPlaying || !this.ctx) return;
    if (!value || value.length === 0) return;

    this.metrics.totalBytes += value.length;
    this.metrics.chunksReceived += 1;

    if (this.metrics.ttfaMs === null) {
      this.metrics.ttfaMs = Math.round(performance.now() - this.tStart);
    }

    // Append to accumulated buffer
    const merged = new Uint8Array(this.accumulatedBytes.length + value.length);
    merged.set(this.accumulatedBytes);
    merged.set(value, this.accumulatedBytes.length);
    this.accumulatedBytes = merged;

    // Process all ready chunks
    this.accumulatedBytes = await this.processWavChunks(this.accumulatedBytes, this.ctx);
    this.onMetricsUpdate?.({ ...this.metrics });
  }

  /**
   * Conclude the active stream, scheduling any remaining tail PCM bytes.
   */
  async finishStream(): Promise<void> {
    if (!this.ctx) return;

    if (this.accumulatedBytes.length > 0) {
      if (this.accumulatedBytes.length >= 44 && this.isRiffHeader(this.accumulatedBytes, 0)) {
        await this.scheduleChunk(toArrayBuffer(this.accumulatedBytes), this.ctx);
      } else if (this.accumulatedBytes.length > 0) {
        // Wrap tail PCM in WAV container
        const header = buildWavHeader(
          this.accumulatedBytes.length,
          this.detectedSampleRate,
          this.detectedChannels,
          this.detectedBitsPerSample
        );
        const combined = new Uint8Array(header.byteLength + this.accumulatedBytes.length);
        combined.set(new Uint8Array(header), 0);
        combined.set(this.accumulatedBytes, header.byteLength);
        await this.scheduleChunk(toArrayBuffer(combined), this.ctx);
      }
      this.accumulatedBytes = new Uint8Array(0);
    }

    this.isPlaying = false;
    this.onMetricsUpdate?.({ ...this.metrics });
  }

  /**
   * Stream and play chunked audio response directly from a fetch Response.
   */
  async playStream(response: Response, defaultSampleRate?: number): Promise<void> {
    const rtfHeader = response.headers.get("X-Real-Time-Factor");
    const rtf = rtfHeader ? parseFloat(rtfHeader) : undefined;
    this.startStream(rtf, defaultSampleRate);

    if (!response.body) {
      throw new Error("Response body is empty.");
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        if (this.abortController?.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length > 0) {
          await this.feedChunk(value);
        }
      }
      await this.finishStream();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.warn("[StreamingAudioPlayer] stream read error:", err);
      }
    }
  }

  private isRiffHeader(buf: Uint8Array, offset: number): boolean {
    return (
      offset + 4 <= buf.length &&
      buf[offset] === 0x52 && // R
      buf[offset + 1] === 0x49 && // I
      buf[offset + 2] === 0x46 && // F
      buf[offset + 3] === 0x46 // F
    );
  }

  /**
   * Parse concatenated or individual WAV headers in byte buffer and schedule complete chunks.
   */
  private async processWavChunks(buffer: Uint8Array, ctx: AudioContext): Promise<Uint8Array> {
    let offset = 0;

    while (offset + 44 <= buffer.length) {
      // Case 1: Standard RIFF WAV chunk
      if (this.isRiffHeader(buffer, offset)) {
        const view = new DataView(
          buffer.buffer,
          buffer.byteOffset + offset,
          Math.min(44, buffer.length - offset)
        );
        const riffSize = view.getUint32(4, true);
        const totalWavSize = riffSize + 8;

        // Extract metadata if available
        if (view.byteLength >= 36) {
          this.detectedChannels = view.getUint16(22, true) || 1;
          this.detectedSampleRate = view.getUint32(24, true) || 48000;
          this.detectedBitsPerSample = view.getUint16(34, true) || 16;
          this.hasSeenWavHeader = true;
        }

        if (offset + totalWavSize <= buffer.length) {
          const chunkBytes = buffer.slice(offset, offset + totalWavSize);
          await this.scheduleChunk(toArrayBuffer(chunkBytes), ctx);
          offset += totalWavSize;
          continue;
        } else {
          // Incomplete WAV chunk; wait for more network frames
          break;
        }
      } else if (this.hasSeenWavHeader && buffer.length - offset >= 4096) {
        // Case 2: Subsequent raw PCM stream following an initial WAV header
        // Package 4096-byte PCM chunk into synthetic WAV and schedule
        const pcmSlice = buffer.slice(offset, offset + 4096);
        const header = buildWavHeader(
          pcmSlice.length,
          this.detectedSampleRate,
          this.detectedChannels,
          this.detectedBitsPerSample
        );
        const combined = new Uint8Array(header.byteLength + pcmSlice.length);
        combined.set(new Uint8Array(header), 0);
        combined.set(pcmSlice, header.byteLength);
        await this.scheduleChunk(toArrayBuffer(combined), ctx);
        offset += 4096;
        continue;
      } else {
        offset++;
      }
    }

    return offset > 0 ? buffer.slice(offset) : buffer;
  }

  /**
   * Decode single WAV ArrayBuffer and schedule sequentially on timeline.
   */
  private async scheduleChunk(arrayBuffer: ArrayBuffer, ctx: AudioContext): Promise<void> {
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (!this.isPlaying || !this.analyser) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.analyser);

      // Schedule gap-free: start at current time or immediately when previous chunk ends
      const startTime = Math.max(ctx.currentTime + 0.015, this.scheduledEndTime);
      source.start(startTime);
      this.scheduledEndTime = startTime + audioBuffer.duration;
      this.metrics.playbackDurationSec += audioBuffer.duration;

      this.activeSources.push(source);
      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) this.activeSources.splice(idx, 1);
      };
    } catch {
      // Silently ignore corrupted sub-chunk headers
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources = [];
    this.isPlaying = false;
    this.scheduledEndTime = 0;
    this.accumulatedBytes = new Uint8Array(0);
  }
}
