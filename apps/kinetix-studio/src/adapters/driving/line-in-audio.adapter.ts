// ============================================================================
// KINETIX STUDIO - DRIVING ADAPTER: LINE-IN AUDIO ADAPTER (ECMA-429)
// Real-time microphone and DJ mixer line-in telemetry follower using Web Audio API
// AnalyserNode, frequency bin isolation, and transient kick detection.
// ============================================================================

import type { AudioTelemetry } from '@/types/motion';

export type AudioTelemetrySubscriber = (telemetry: AudioTelemetry) => void;

export class LineInAudioAdapter {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private readonly subscribers = new Set<AudioTelemetrySubscriber>();

  private isRunning = false;
  private lastBassEnergy = 0;
  private beatPulseDecay = 0;

  public static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof AudioContext !== 'undefined'
    );
  }

  public async start(): Promise<boolean> {
    if (this.isRunning) return true;
    if (!LineInAudioAdapter.isSupported()) return false;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });

      this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.65;
      this.sourceNode.connect(this.analyser);

      this.isRunning = true;
      this.loop();
      return true;
    } catch (err) {
      console.warn('LineInAudioAdapter microphone access failed or denied:', err);
      this.stop();
      return false;
    }
  }

  private loop = (): void => {
    if (!this.isRunning || !this.analyser || !this.audioCtx) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    const telemetry = this.computeTelemetry(dataArray, this.audioCtx.sampleRate);
    for (const sub of this.subscribers) {
      sub(telemetry);
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  };

  /**
   * Computes normalized bass, mid, high energy and beat pulse from FFT data.
   */
  public computeTelemetry(dataArray: Uint8Array, sampleRate = 44100): AudioTelemetry {
    const binCount = dataArray.length;
    const binWidth = (sampleRate / 2) / binCount;

    // Bass: 40Hz - 250Hz
    const bassStart = Math.max(1, Math.floor(40 / binWidth));
    const bassEnd = Math.min(binCount - 1, Math.ceil(250 / binWidth));

    // Mid: 250Hz - 2000Hz
    const midStart = bassEnd;
    const midEnd = Math.min(binCount - 1, Math.ceil(2000 / binWidth));

    // High: 2000Hz - 16000Hz
    const highStart = midEnd;
    const highEnd = Math.min(binCount - 1, Math.ceil(16000 / binWidth));

    const calcAverage = (start: number, end: number) => {
      if (start >= end) return 0;
      let sum = 0;
      for (let i = start; i <= end; i++) {
        sum += dataArray[i] ?? 0;
      }
      return sum / ((end - start + 1) * 255);
    };

    const bass = calcAverage(bassStart, bassEnd);
    const mid = calcAverage(midStart, midEnd);
    const high = calcAverage(highStart, highEnd);
    const level = (bass * 0.5 + mid * 0.35 + high * 0.15);

    // Transient Kick Detection: sharp rise in low-end energy
    const bassDelta = bass - this.lastBassEnergy;
    if (bassDelta > 0.15 && bass > 0.3) {
      this.beatPulseDecay = 1.0;
    } else {
      this.beatPulseDecay = Math.max(0, this.beatPulseDecay * 0.88);
    }
    this.lastBassEnergy = bass;

    return {
      level: Math.min(1, Math.max(0, level)),
      bass: Math.min(1, Math.max(0, bass)),
      mid: Math.min(1, Math.max(0, mid)),
      high: Math.min(1, Math.max(0, high)),
      beatPulse: Number(this.beatPulseDecay.toFixed(3)),
    };
  }

  public subscribe(callback: AudioTelemetrySubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.subscribers.clear();
  }

  public [Symbol.dispose](): void {
    this.stop();
  }
}
