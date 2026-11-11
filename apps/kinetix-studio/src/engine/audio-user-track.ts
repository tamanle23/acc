// ============================================================================
// KINETIX STUDIO v5.0 - USER AUDIO TRACK & 3-BAND FFT STEM ENGINE
// Manages external audio files (.mp3, .wav, .aac), offline stem pre-calculation,
// timeline waveform display, and real-time playback synchronization.
// ============================================================================

import type { AudioTelemetry } from '@/types/motion';
import { saveAsset, getAsset } from '@/lib/asset-store';

export interface UserAudioAnalysis {
  durationSec: number;
  sampleRate: number;
  channels: number;
  waveformPoints: number[]; // 128 normalized points [0, 1] for timeline UI
  // Pre-calculated RMS envelopes indexed per frame (at 60fps)
  bassEnvelope: Float32Array;
  midEnvelope: Float32Array;
  highEnvelope: Float32Array;
}

export class UserAudioTrackManager {
  private audioCtx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private analysis: UserAudioAnalysis | null = null;
  private activeKey: string | null = null;
  private startTime = 0;
  private isPlaying = false;
  private isUserGestureUnlocked = false;
  private isResuming = false;

  /**
   * Resumes the AudioContext upon user gesture.
   */
  public async resume(): Promise<boolean> {
    this.isUserGestureUnlocked = true;
    if (typeof window === 'undefined') return false;
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        return true;
      } catch {
        return false;
      }
    }
    return ctx?.state === 'running';
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.audioCtx.state === 'suspended' && this.isUserGestureUnlocked && !this.isResuming) {
      this.isResuming = true;
      this.audioCtx
        .resume()
        .then(() => {
          this.isResuming = false;
        })
        .catch(() => {
          this.isResuming = false;
        });
    }
    return this.audioCtx;
  }

  /**
   * Imports an audio File or Blob, caches it in IndexedDB, and analyzes stems.
   */
  public async loadAudioFile(file: Blob, fileName?: string): Promise<UserAudioAnalysis> {
    const ctx = this.getAudioContext();
    if (!ctx) throw new Error('Web Audio not supported');

    const effectiveName =
      fileName ||
      (file instanceof File ? file.name : '') ||
      'audio_track.mp3';

    const arrayBuffer = await file.arrayBuffer();
    const decodedBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

    this.audioBuffer = decodedBuffer;
    this.activeKey = `audio_${Date.now()}`;

    // Cache in IndexedDB for session persistence
    await saveAsset(this.activeKey, file, 'audio', effectiveName, file.type || 'audio/mpeg');

    // Pre-calculate 3-Band FFT RMS Envelopes & Timeline Waveform
    this.analysis = this.analyzeAudioBuffer(decodedBuffer);
    return this.analysis;
  }

  /**
   * Fetches an audio file from a URL, decodes stems, and caches in IndexedDB.
   * If network fetch fails or is offline, synthesizes an offline audio stem gracefully.
   */
  public async loadAudioFromUrl(url: string, name = 'audio_track.mp3'): Promise<UserAudioAnalysis | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const blob = await response.blob();
      return await this.loadAudioFile(blob, name);
    } catch (err) {
      console.warn('[UserAudioTrackManager] Failed to load audio from URL, synthesizing offline fallback stem:', url, err);
      const ctx = this.getAudioContext();
      if (!ctx) return null;

      try {
        const duration = 4;
        const sampleRate = ctx.sampleRate || 44100;
        const frameCount = sampleRate * duration;
        const buffer = ctx.createBuffer(2, frameCount, sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = buffer.getChannelData(ch);
          const freq = ch === 0 ? 220 : 440;
          for (let i = 0; i < frameCount; i++) {
            const t = i / sampleRate;
            const envelope = Math.sin((Math.PI * i) / frameCount);
            data[i] = Math.sin(2 * Math.PI * freq * t) * 0.12 * envelope;
          }
        }
        this.audioBuffer = buffer;
        this.activeKey = `offline_synth_${Date.now()}`;
        this.analysis = this.analyzeAudioBuffer(buffer);
        return this.analysis;
      } catch (synthErr) {
        console.warn('[UserAudioTrackManager] Offline synthesis failed:', synthErr);
        return null;
      }
    }
  }

  /**
   * Hydrates from cached IndexedDB asset if key exists.
   */
  public async loadFromAssetKey(key: string): Promise<UserAudioAnalysis | null> {
    const record = await getAsset(key);
    if (!record || !(record.data instanceof Blob)) return null;

    const ctx = this.getAudioContext();
    if (!ctx) return null;

    const arrayBuffer = await record.data.arrayBuffer();
    const decodedBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

    this.audioBuffer = decodedBuffer;
    this.activeKey = key;
    this.analysis = this.analyzeAudioBuffer(decodedBuffer);
    return this.analysis;
  }

  public getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }

  public getWaveformPoints(): number[] {
    return this.analysis?.waveformPoints ?? [];
  }

  public hasAudio(): boolean {
    return this.audioBuffer !== null && this.analysis !== null;
  }

  /**
   * Deterministically evaluates 3-band energy at any second offset.
   */
  public getTelemetryAtTime(timeSec: number): AudioTelemetry {
    if (!this.analysis) {
      return { level: 0, bass: 0, mid: 0, high: 0, beatPulse: 0 };
    }

    const fps = 60;
    const frameIdx = Math.max(0, Math.floor(timeSec * fps));
    const maxFrames = this.analysis.bassEnvelope.length;
    const idx = frameIdx % maxFrames;

    const bass = this.analysis.bassEnvelope[idx] ?? 0;
    const mid = this.analysis.midEnvelope[idx] ?? 0;
    const high = this.analysis.highEnvelope[idx] ?? 0;
    const level = Math.min(1, bass * 0.5 + mid * 0.35 + high * 0.15);
    const beatPulse = bass > 0.65 ? 1 : bass * 1.2;

    return { level, bass, mid, high, beatPulse };
  }

  /**
   * Starts playback synchronized with Kinetix Studio playhead.
   */
  public play(startOffsetSec = 0, loopRange?: [number, number]): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended' && !this.isUserGestureUnlocked) {
      return;
    }
    const ctx = this.getAudioContext();
    if (!ctx || ctx.state === 'suspended' || !this.audioBuffer) return;

    this.stop();

    const duration = this.audioBuffer.duration;
    const effectiveLoopRange = loopRange ?? [0, duration];

    const source = ctx.createBufferSource();
    source.buffer = this.audioBuffer;
    source.loop = true;
    source.loopStart = Math.max(0, effectiveLoopRange[0]);
    source.loopEnd = Math.min(duration, Math.max(effectiveLoopRange[0] + 0.05, effectiveLoopRange[1]));

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    source.connect(analyser);
    analyser.connect(ctx.destination);

    const safeStart = Math.max(source.loopStart, Math.min(source.loopEnd, startOffsetSec));
    source.start(0, safeStart);

    this.currentSourceNode = source;
    this.analyserNode = analyser;
    this.isPlaying = true;
    this.startTime = ctx.currentTime - safeStart;
  }

  /**
   * Stops playback immediately.
   */
  public stop(): void {
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
      } catch { }
      this.currentSourceNode = null;
    }
    this.isPlaying = false;
  }

  /**
   * Pauses / halts playback immediately. Alias for stop() for Web Audio buffer sources.
   */
  public pause(): void {
    this.stop();
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getStartTime(): number {
    return this.startTime;
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getAnalysis(): UserAudioAnalysis | null {
    return this.analysis;
  }

  public getActiveKey(): string | null {
    return this.activeKey;
  }

  /**
   * Offline 3-band stem calculation across the entire AudioBuffer.
   */
  private analyzeAudioBuffer(buffer: AudioBuffer): UserAudioAnalysis {
    const duration = buffer.duration;
    const sampleRate = buffer.sampleRate;
    const channelData = buffer.getChannelData(0);
    const totalSamples = channelData.length;

    // 1. Generate 128-point waveform overview for timeline UI
    const waveformPoints: number[] = [];
    const waveBucketSize = Math.max(1, Math.floor(totalSamples / 128));
    for (let i = 0; i < 128; i++) {
      let sum = 0;
      const start = i * waveBucketSize;
      const end = Math.min(totalSamples, start + waveBucketSize);
      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j]!);
      }
      waveformPoints.push(Math.min(1, (sum / (end - start)) * 2.5));
    }

    // 2. Pre-calculate frame-indexed RMS envelopes at 60 FPS
    const fps = 60;
    const totalFrames = Math.max(1, Math.floor(duration * fps));
    const samplesPerFrame = Math.max(1, Math.floor(sampleRate / fps));

    const bassEnvelope = new Float32Array(totalFrames);
    const midEnvelope = new Float32Array(totalFrames);
    const highEnvelope = new Float32Array(totalFrames);

    // Simple IIR Filter state variables for 3-band frequency division
    let lpState = 0;
    let bpState = 0;
    const dt = 1 / sampleRate;
    const lpAlpha = dt / (dt + 1 / (2 * Math.PI * 220)); // ~220Hz cutoff
    const bpAlpha = dt / (dt + 1 / (2 * Math.PI * 1800)); // ~1800Hz cutoff

    for (let f = 0; f < totalFrames; f++) {
      const fStart = f * samplesPerFrame;
      const fEnd = Math.min(totalSamples, fStart + samplesPerFrame);

      let bSum = 0;
      let mSum = 0;
      let hSum = 0;

      for (let s = fStart; s < fEnd; s++) {
        const raw = channelData[s]!;
        // Lowpass (Bass)
        lpState += lpAlpha * (raw - lpState);
        // Bandpass (Mid)
        bpState += bpAlpha * (raw - bpState);
        const midSample = bpState - lpState;
        // Highpass (High)
        const highSample = raw - bpState;

        bSum += lpState * lpState;
        mSum += midSample * midSample;
        hSum += highSample * highSample;
      }

      const count = Math.max(1, fEnd - fStart);
      bassEnvelope[f] = Math.min(1, Math.sqrt(bSum / count) * 4.2);
      midEnvelope[f] = Math.min(1, Math.sqrt(mSum / count) * 3.8);
      highEnvelope[f] = Math.min(1, Math.sqrt(hSum / count) * 5.5);
    }

    return {
      durationSec: duration,
      sampleRate,
      channels: buffer.numberOfChannels,
      waveformPoints,
      bassEnvelope,
      midEnvelope,
      highEnvelope,
    };
  }
}

// Global Singleton Instance
export const userAudioTrack = new UserAudioTrackManager();
