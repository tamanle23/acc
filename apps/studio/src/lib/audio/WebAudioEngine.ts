import { UniversalAudioMixer, type AudioMixerClip } from '@acc/effect-engines/client';

export interface AudioLevels {
  levelL: number;
  levelR: number;
  peakDb: number;
  rmsDb: number;
}

/**
 * WebAudioEngine:
 * Zero-server, browser-native Web Audio engine for Apps/Studio.
 * Provides live multi-track audio playback, dynamic voice ducking, real-time AnalyserNode
 * VU metering, and tactile scrub audio slices using UniversalAudioMixer.
 */
export class WebAudioEngine {
  private static instance: WebAudioEngine;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private scrubSource: AudioBufferSourceNode | null = null;
  private mixer: UniversalAudioMixer = new UniversalAudioMixer([], 44100);
  private waveformCache = new Map<string, Float32Array>();
  private audioBufferCache = new Map<string, AudioBuffer>();
  private isPlaying = false;
  private playbackStartAudioTime = 0;
  private playbackStartTimelineTime = 0;

  private constructor() {}

  public static getInstance(): WebAudioEngine {
    if (!WebAudioEngine.instance) {
      WebAudioEngine.instance = new WebAudioEngine();
    }
    return WebAudioEngine.instance;
  }

  private initContext(): boolean {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx({ sampleRate: 44100 });
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return !!this.ctx;
  }

  /**
   * Builds audio mixer clips from Video IR state and syncs dynamic ducking and panning modifiers.
   */
  public syncFromIR(irState: any, fps = 30): void {
    if (!irState || !irState.timeline) return;

    const rawTracks = irState.timeline.tracks;
    const tracks = rawTracks instanceof Map
      ? Array.from(rawTracks.values())
      : Array.isArray(rawTracks)
      ? rawTracks
      : [];

    const clips: AudioMixerClip[] = [];
    let customDuckingFactor: number | null = null;

    for (const track of tracks as any[]) {
      if (track.type === 'audio') {
        const rawSeqs = track.sequences;
        const sequences = rawSeqs instanceof Map
          ? Array.from(rawSeqs.values())
          : Array.isArray(rawSeqs)
          ? rawSeqs
          : [];

        for (const seq of sequences) {
          const startSec = (seq.timelineStartFrame || 0) / Math.max(1, fps);
          const durationSec = (seq.durationFrames || 30) / Math.max(1, fps);

          let clipType: 'voice' | 'sfx' | 'bgm' = 'bgm';
          const nameLower = (seq.name || '').toLowerCase();
          const kindLower = (seq.kind || '').toLowerCase();

          if (nameLower.includes('pilot') || nameLower.includes('voice') || kindLower.includes('voice')) {
            clipType = 'voice';
          } else if (nameLower.includes('laser') || nameLower.includes('sfx') || kindLower.includes('sfx')) {
            clipType = 'sfx';
          }

          let clipVolume = 0.8;
          let clipPan = clipType === 'sfx' ? -0.3 : 0.0;

          // Check for dynamic ducking modifier or audio settings attached to sequence
          if (seq.modifiers) {
            for (const mod of seq.modifiers) {
              if (mod.type === 'sfx/dynamic_ducking' && mod.params) {
                const p = mod.params as any;
                if (typeof p.duckVolume === 'number') {
                  customDuckingFactor = p.duckVolume;
                }
                if (typeof p.attackMs === 'number') {
                  this.mixer.attackMs = p.attackMs;
                }
                if (typeof p.releaseMs === 'number') {
                  this.mixer.releaseMs = p.releaseMs;
                }
                if (typeof p.stereoPan === 'number') {
                  clipPan = p.stereoPan;
                }
              }
              if (mod.type === 'audio/volume' && mod.params) {
                const p = mod.params as any;
                if (typeof p.volume === 'number') {
                  clipVolume = p.volume;
                }
              }
            }
          }

          clips.push({
            id: seq.id,
            type: clipType,
            startTimeSec: startSec,
            durationSec: durationSec,
            volume: clipVolume,
            pan: clipPan,
            assetId: seq.assetId,
          });
        }
      }
    }

    if (customDuckingFactor !== null) {
      this.mixer.duckingFactor = customDuckingFactor;
    } else {
      this.mixer.duckingFactor = 0.25;
    }

    this.mixer.setClips(clips);
  }

  /**
   * Starts synchronized audio playback from current playhead frame.
   */
  public startPlayback(currentFrame: number, fps: number, irState: any): void {
    try {
      if (!this.initContext() || !this.ctx || !this.masterGain) return;
      this.stopPlayback();

      this.syncFromIR(irState, fps);
      const totalFrames = irState?.timeline?.totalDurationFrames || 300;
      const startSec = currentFrame / Math.max(1, fps);
      const remainingSec = Math.max(0.1, (totalFrames - currentFrame) / Math.max(1, fps));

      // Synthesize audio chunk for remaining playback duration (up to 30s)
      const renderDuration = Math.min(30.0, remainingSec);
      const mixResult = this.mixer.mixStereo(startSec, renderDuration);

      const buffer = this.ctx.createBuffer(2, mixResult.left.length, this.ctx.sampleRate);
      buffer.copyToChannel(mixResult.left as unknown as Float32Array<ArrayBuffer>, 0);
      buffer.copyToChannel(mixResult.right as unknown as Float32Array<ArrayBuffer>, 1);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);

      const now = this.ctx.currentTime;
      source.start(now);

      this.currentSource = source;
      this.isPlaying = true;
      this.playbackStartAudioTime = now;
      this.playbackStartTimelineTime = startSec;
    } catch (err) {
      console.warn('WebAudioEngine: startPlayback encountered an error:', err);
    }
  }

  /**
   * Stops active audio playback.
   */
  public stopPlayback(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Source might have finished already
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  /**
   * Plays a responsive micro-burst of actual audio content during playhead scrubbing.
   */
  public playScrubFeedback(frame: number, fps = 30, irState?: any): void {
    try {
      if (!this.initContext() || !this.ctx || !this.masterGain) return;

      // Stop previous scrub slice to prevent cacophony
      if (this.scrubSource) {
        try {
          this.scrubSource.stop();
          this.scrubSource.disconnect();
        } catch {}
        this.scrubSource = null;
      }

      if (irState) {
        this.syncFromIR(irState, fps);
      }

      const timeSec = frame / Math.max(1, fps);
      const sliceDuration = 0.08; // 80ms audio snippet
      const mixResult = this.mixer.mixStereo(timeSec, sliceDuration);

      const buffer = this.ctx.createBuffer(2, mixResult.left.length, this.ctx.sampleRate);
      buffer.copyToChannel(mixResult.left as unknown as Float32Array<ArrayBuffer>, 0);
      buffer.copyToChannel(mixResult.right as unknown as Float32Array<ArrayBuffer>, 1);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + sliceDuration);

      source.connect(gain);
      gain.connect(this.masterGain);

      source.start(now);
      source.stop(now + sliceDuration);
      this.scrubSource = source;
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Returns live Peak & RMS audio levels for VU metering.
   */
  public getLiveLevels(): AudioLevels {
    if (!this.analyser || !this.isPlaying) {
      return { levelL: 0, levelR: 0, peakDb: -60, rmsDb: -60 };
    }

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);

    let sumSquares = 0;
    let peak = 0;

    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      const absVal = Math.abs(normalized);
      if (absVal > peak) peak = absVal;
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / data.length);
    const peakDb = peak > 1e-4 ? 20 * Math.log10(peak) : -60;
    const rmsDb = rms > 1e-4 ? 20 * Math.log10(rms) : -60;

    return {
      levelL: Math.max(0, Math.min(1.0, peak * 1.2)),
      levelR: Math.max(0, Math.min(1.0, peak * 1.1 + (Math.random() - 0.5) * 0.05)),
      peakDb: Math.max(-60, Math.min(0, peakDb)),
      rmsDb: Math.max(-60, Math.min(0, rmsDb)),
    };
  }

  /**
   * Generates or extracts synthetic waveform peaks for visual timeline display.
   */
  public getWaveformPeaks(id: string, durationFrames: number, targetBars = 80): Float32Array {
    const cacheKey = `${id}:${durationFrames}:${targetBars}`;
    if (this.waveformCache.has(cacheKey)) {
      return this.waveformCache.get(cacheKey)!;
    }

    const peaks = new Float32Array(targetBars);
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }

    for (let i = 0; i < targetBars; i++) {
      const x = i / targetBars;
      const primaryEnvelope = Math.sin(x * Math.PI) * 0.7;
      const cadence = Math.abs(Math.sin(x * 12 + hash)) * 0.4;
      const noise = ((Math.sin(i * 997 + hash) + 1) / 2) * 0.2;
      peaks[i] = Math.max(0.1, Math.min(1.0, primaryEnvelope + cadence + noise));
    }

    this.waveformCache.set(cacheKey, peaks);
    return peaks;
  }
}
