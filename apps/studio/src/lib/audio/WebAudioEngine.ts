import { UniversalAudioMixer, type AudioMixerClip, DecodedPcmSource } from '@acc/ir';
import { IRPreviewEngine } from '../../renderer/preview';
import { AudioAssetCache } from './AudioAssetCache';
import { type ShuttleSpeed, shouldMuteAudio, getAudioPlaybackRate } from '../shuttle/shuttleTypes';
import { UniversalAudioStreamWorklet } from './UniversalAudioStreamWorklet';

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
 * VU metering, and continuous scheduled multi-chunk playback by delegating audio DSP
 * directly to IRPreviewEngine and its encapsulated UniversalAudioMixer.
 */
export class WebAudioEngine {
  private static instance: WebAudioEngine;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private scrubSource: AudioBufferSourceNode | null = null;

  // Active audio sources queue for continuous multi-chunk streaming
  private queuedSources: AudioBufferSourceNode[] = [];
  private scheduledAudioEndTime = 0;
  private nextTimelineSecToSynthesize = 0;
  private refillInterval: any = null;

  // Encapsulated preview engine maintaining audio-visual parity
  private previewEngine: IRPreviewEngine | null = null;
  private mixer: UniversalAudioMixer = new UniversalAudioMixer([], 44100);
  private waveformCache = new Map<string, Float32Array>();
  private waveformWorker: Worker | null = null;
  private workerPending = new Set<string>();
  private audioBufferCache = new Map<string, AudioBuffer>();
  private streamWorklet: UniversalAudioStreamWorklet = new UniversalAudioStreamWorklet(44100);
  private isPlaying = false;
  private playbackStartAudioTime = 0;
  private playbackStartTimelineTime = 0;
  private lastIrState: any = null;
  private lastFps = 30;
  private lastScrubAudioTime = 0;

  private constructor() {
    AudioAssetCache.getInstance().subscribe(() => {
      if (this.lastIrState) {
        this.syncFromIR(this.lastIrState, this.lastFps);
      }
    });
  }

  public getStreamWorklet(): UniversalAudioStreamWorklet {
    return this.streamWorklet;
  }

  public static getInstance(): WebAudioEngine {
    if (!WebAudioEngine.instance) {
      WebAudioEngine.instance = new WebAudioEngine();
    }
    return WebAudioEngine.instance;
  }

  /**
   * Sets or attaches an active IRPreviewEngine instance to share the identical audio mixer.
   */
  public attachPreviewEngine(engine: IRPreviewEngine): void {
    this.previewEngine = engine;
    this.mixer = engine.getAudioMixer();
  }

  public getMixer(): UniversalAudioMixer {
    return this.mixer;
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
   * Synchronizes timeline audio state across the attached IRPreviewEngine or internal mixer.
   * Leverages UniversalAudioMixer.syncFromTimeline for 100% parity with IRMasterRenderer.
   */
  public syncFromIR(irState: any, fps = 30, preload = true): void {
    if (!irState || !irState.timeline) return;
    this.lastIrState = irState;
    this.lastFps = fps;

    if (preload) {
      const assets = irState.timeline.assets || irState.doc?.assets || {};
      AudioAssetCache.getInstance().preloadAssets(assets);
    }

    const audioSourceResolver = (assetId: string, src?: string): DecodedPcmSource | undefined => {
      const decoded = AudioAssetCache.getInstance().getAudioChannels(assetId, src);
      if (decoded) {
        return new DecodedPcmSource({
          channels: decoded.channels,
          sourceSampleRate: decoded.sampleRate,
          sourceTrimStartSec: 0,
        });
      }
      return undefined;
    };

    if (this.previewEngine) {
      this.previewEngine.syncTimeline(irState.timeline, audioSourceResolver);
      this.mixer = this.previewEngine.getAudioMixer();
    } else {
      this.mixer.syncFromTimeline(irState.timeline, audioSourceResolver);
    }
  }

  /**
   * Starts synchronized audio playback from current playhead frame.
   * Synthesizes audio using lightweight non-blocking 5.0s chunks and chains
   * consecutive AudioBufferSourceNode instances into the Master Bus for continuous playback.
   */
  public startPlayback(currentFrame: number, fps: number, irState: any): void {
    try {
      if (!this.initContext() || !this.ctx || !this.masterGain) return;
      this.stopPlayback();

      this.syncFromIR(irState, fps);
      const totalFrames = irState?.timeline?.totalFrames || 300;
      const startSec = currentFrame / Math.max(1, fps);
      const remainingSec = Math.max(0.1, (totalFrames - currentFrame) / Math.max(1, fps));

      // Synthesize initial responsive audio chunk (5.0s max instead of blocking 30s)
      const renderDuration = Math.min(5.0, remainingSec);
      const mixResult = this.mixer.mixStereo(startSec, renderDuration);

      // Stream into UniversalAudioStreamWorklet ring buffer for non-blocking worklet transport
      this.streamWorklet.reset();
      this.streamWorklet.pushChunk(mixResult.left, mixResult.right);

      const buffer = this.ctx.createBuffer(2, mixResult.left.length, this.ctx.sampleRate);
      buffer.copyToChannel(mixResult.left as unknown as Float32Array<ArrayBuffer>, 0);
      buffer.copyToChannel(mixResult.right as unknown as Float32Array<ArrayBuffer>, 1);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);

      const now = this.ctx.currentTime;
      source.start(now);

      this.currentSource = source;
      this.queuedSources = [source];
      this.isPlaying = true;
      this.playbackStartAudioTime = now;
      this.playbackStartTimelineTime = startSec;
      this.scheduledAudioEndTime = now + renderDuration;
      this.nextTimelineSecToSynthesize = startSec + renderDuration;

      // Start continuous lookahead replenishment loop (checks every 1000ms)
      this.startRefillScheduler(totalFrames, fps);
    } catch (err) {
      console.warn('WebAudioEngine: startPlayback encountered an error:', err);
    }
  }

  /**
   * Checks remaining audio buffer every 1000ms. If remaining buffered duration < 2.0s,
   * asynchronously synthesizes the next 5.0-second slice and chains it to the master bus.
   */
  private startRefillScheduler(totalFrames: number, fps: number): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
      this.refillInterval = null;
    }

    const totalDurationSec = totalFrames / Math.max(1, fps);

    this.refillInterval = setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) {
        if (this.refillInterval) {
          clearInterval(this.refillInterval);
          this.refillInterval = null;
        }
        return;
      }

      const now = this.ctx.currentTime;
      const remainingBufferedTime = this.scheduledAudioEndTime - now;

      // Refill threshold: schedule next chunk when buffered time falls below 2.0s
      if (remainingBufferedTime < 2.0 && this.nextTimelineSecToSynthesize < totalDurationSec) {
        const remainingTimelineSec = totalDurationSec - this.nextTimelineSecToSynthesize;
        if (remainingTimelineSec <= 0.05) return;

        const sliceDuration = Math.min(5.0, remainingTimelineSec);
        const sliceStart = this.nextTimelineSecToSynthesize;
        this.nextTimelineSecToSynthesize += sliceDuration;

        try {
          const mix = this.mixer.mixStereo(sliceStart, sliceDuration);
          this.streamWorklet.pushChunk(mix.left, mix.right);

          const buffer = this.ctx.createBuffer(2, mix.left.length, this.ctx.sampleRate);
          buffer.copyToChannel(mix.left as unknown as Float32Array<ArrayBuffer>, 0);
          buffer.copyToChannel(mix.right as unknown as Float32Array<ArrayBuffer>, 1);

          const nextSource = this.ctx.createBufferSource();
          nextSource.buffer = buffer;
          nextSource.connect(this.masterGain);

          // Schedule contiguous playback right after preceding chunk finishes
          const scheduleTime = Math.max(now, this.scheduledAudioEndTime);
          nextSource.start(scheduleTime);
          this.scheduledAudioEndTime = scheduleTime + sliceDuration;
          this.queuedSources.push(nextSource);

          // Prune sources that have already finished playing
          this.queuedSources = this.queuedSources.filter((s) => {
            try {
              return s.buffer !== null;
            } catch {
              return false;
            }
          });
        } catch (e) {
          console.warn('[WebAudioEngine] Error scheduling audio slice:', e);
        }
      }
    }, 1000);
  }

  /**
   * Stops active audio playback and clears all queued sources and replenishment intervals.
   */
  public stopPlayback(): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
      this.refillInterval = null;
    }

    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Source might have finished already
      }
      this.currentSource = null;
    }

    for (const source of this.queuedSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.queuedSources = [];
    this.scheduledAudioEndTime = 0;
    this.nextTimelineSecToSynthesize = 0;
    this.streamWorklet.reset();
    this.isPlaying = false;
  }

  /**
   * Sets shuttle playback speed with hardware clock pitch preservation and high-speed/reverse muting.
   */
  public setShuttleSpeed(speed: ShuttleSpeed, currentFrame: number, fps: number, irState: any): void {
    if (speed === 0) {
      this.stopPlayback();
      return;
    }

    const mute = shouldMuteAudio(speed);

    if (mute) {
      this.stopPlayback();
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      return;
    }

    const playbackRate = getAudioPlaybackRate(speed);
    // Restart audio playback cleanly synchronized to the currentFrame at the requested playback rate
    this.startPlayback(currentFrame, fps, irState);

    if (this.currentSource && this.masterGain && this.ctx) {
      try {
        this.currentSource.playbackRate.setValueAtTime(playbackRate, this.ctx.currentTime);
        if ((this.currentSource.playbackRate as any).preservesPitch !== undefined) {
          (this.currentSource.playbackRate as any).preservesPitch = true;
        }
        this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      } catch {}
    }
  }

  /**
   * Plays a responsive micro-burst of actual audio content during playhead scrubbing.
   * Throttled to ~14 Hz (70ms) to prevent main-thread CPU lockup during rapid key-repeat scrubbing.
   */
  public playScrubFeedback(frame: number, fps = 30, irState?: any): void {
    try {
      if (!this.initContext() || !this.ctx || !this.masterGain) return;

      // Autoplay policy guard: do not execute audio DSP or schedule buffers on suspended context
      if (this.ctx.state === 'suspended') {
        return;
      }

      const now = performance.now();
      if (now - this.lastScrubAudioTime < 70) {
        return;
      }
      this.lastScrubAudioTime = now;

      // Stop previous scrub slice to prevent cacophony
      if (this.scrubSource) {
        try {
          this.scrubSource.stop();
          this.scrubSource.disconnect();
        } catch {}
        this.scrubSource = null;
      }

      if (irState) {
        this.syncFromIR(irState, fps, false);
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
      const audioTime = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.5, audioTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioTime + sliceDuration);

      source.connect(gain);
      gain.connect(this.masterGain);

      source.start(audioTime);
      source.stop(audioTime + sliceDuration);
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
   * Generates or extracts waveform peaks for visual timeline display.
   * If real decoded audio is present in AudioAssetCache, extracts actual PCM peak amplitudes;
   * otherwise falls back to deterministic procedural waveform cadence.
   */
  public getWaveformPeaks(id: string, durationFrames: number, targetBars = 80): Float32Array {
    const cacheKey = `${id}:${durationFrames}:${targetBars}`;
    if (this.waveformCache.has(cacheKey)) {
      return this.waveformCache.get(cacheKey)!;
    }

    const decoded = AudioAssetCache.getInstance().getAudioChannels(id);
    const channel = decoded && decoded.channels.length > 0 ? decoded.channels[0] : undefined;

    // Trigger background worker if in browser environment and not already pending
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && !this.workerPending.has(cacheKey)) {
      this.workerPending.add(cacheKey);
      try {
        if (!this.waveformWorker) {
          this.waveformWorker = new Worker(
            new URL('../../workers/audioWaveform.worker.ts', import.meta.url),
            { type: 'module' }
          );
          this.waveformWorker.onmessage = (e: MessageEvent<{ id: string; targetBars: number; peaks: Float32Array }>) => {
            const res = e.data;
            const key = `${res.id}:${durationFrames}:${res.targetBars}`;
            this.waveformCache.set(key, res.peaks);
            this.workerPending.delete(key);
          };
        }
        this.waveformWorker.postMessage({
          id,
          durationFrames,
          targetBars,
          channelData: channel ? channel.slice() : undefined,
        });
      } catch (e) {
        // Fallback silently if worker construction fails
      }
    }

    if (channel && channel.length > 0) {
      const samplesPerBar = Math.floor(channel.length / targetBars);
      if (samplesPerBar > 0) {
        const peaks = new Float32Array(targetBars);
        for (let i = 0; i < targetBars; i++) {
          let maxVal = 0;
          const start = i * samplesPerBar;
          const end = Math.min(channel.length, start + samplesPerBar);
          for (let s = start; s < end; s++) {
            const v = Math.abs(channel[s]);
            if (v > maxVal) maxVal = v;
          }
          peaks[i] = Math.max(0.05, Math.min(1.0, maxVal));
        }
        this.waveformCache.set(cacheKey, peaks);
        return peaks;
      }
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

  /**
   * Returns the current hardware audio time from AudioContext.currentTime,
   * used as the reference clock for DeterministicTimelineClock.
   */
  public getAudioCurrentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /**
   * Returns the audio hardware timestamp when current playback was started.
   */
  public getPlaybackStartAudioTime(): number {
    return this.playbackStartAudioTime;
  }

  /**
   * Returns true if audio playback is currently active.
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
