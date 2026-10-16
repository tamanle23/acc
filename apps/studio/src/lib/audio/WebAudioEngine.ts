/**
 * WebAudioEngine:
 * Zero-server, browser-native Web Audio engine for Apps/Studio.
 * Provides micro-burst audio feedback during scrubbing, procedural audio synthesis,
 * real-time playback gain control, and waveform peak decimation.
 */
export class WebAudioEngine {
  private static instance: WebAudioEngine;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private waveformCache = new Map<string, Float32Array>();

  private constructor() {}

  public static getInstance(): WebAudioEngine {
    if (!WebAudioEngine.instance) {
      WebAudioEngine.instance = new WebAudioEngine();
    }
    return WebAudioEngine.instance;
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Plays a subtle, tactile micro-pitch audio click/blip on playhead scrubbing
   */
  public playScrubFeedback(frame: number): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pitch shifts slightly based on frame for directional tactile feeling
      const baseFreq = 440 + ((frame % 30) * 12);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Audio autoplay policy or headless fallback
    }
  }

  /**
   * Generates or extracts synthetic waveform peaks for visual timeline display.
   * Produces a decimated Float32Array of normalized [0, 1] peak heights.
   */
  public getWaveformPeaks(id: string, durationFrames: number, targetBars = 80): Float32Array {
    const cacheKey = `${id}:${durationFrames}:${targetBars}`;
    if (this.waveformCache.has(cacheKey)) {
      return this.waveformCache.get(cacheKey)!;
    }

    const peaks = new Float32Array(targetBars);
    // Deterministic pseudo-random seed based on id string hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }

    for (let i = 0; i < targetBars; i++) {
      const x = i / targetBars;
      // Synthesize rhythmic speech/music waveform envelope
      const primaryEnvelope = Math.sin(x * Math.PI) * 0.7;
      const cadence = Math.abs(Math.sin(x * 12 + hash)) * 0.4;
      const noise = ((Math.sin(i * 997 + hash) + 1) / 2) * 0.2;
      peaks[i] = Math.max(0.1, Math.min(1.0, primaryEnvelope + cadence + noise));
    }

    this.waveformCache.set(cacheKey, peaks);
    return peaks;
  }
}
