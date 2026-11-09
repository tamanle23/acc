import { ProceduralAudioSynthesizer } from './ProceduralAudioSynthesizer';
import { DynamicAudioDuckingEngine } from './DynamicAudioDuckingEngine';
import { DecodedPcmSource, type IAudioSourceProvider } from './AudioSourceAdapter';
import type { ResolvedTimeline, ResolvedTrack } from '../../types/VideoIR';
import { ModifierPluginRegistry, type AudioProcessContext } from '../../plugins/ModifierPluginRegistry';
import { DeterministicAudioClock } from '../../compiler/DeterministicAudioClock';
import type { ModifierNode } from "../../types/modifiers";
import {
  ContentCacheRegistry,
  CacheNamespace,
  MediaEngineRegistry,
  type DecodedAudioPCM,
} from '@acc/core-isomorphic';

export type { DecodedAudioPCM };

export interface DecoupledAudioMixResult {
  totalSamples: number;
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  buffer: Float32Array; // Interleaved stereo PCM stream
}

export interface DecoupledAudioMixOptions {
  baseDir?: string;
}

export type AudioTrackType = 'voice' | 'sfx' | 'bgm';

export interface AudioMixerClip {
  id: string;
  type: AudioTrackType;
  startTimeSec: number;
  durationSec: number;
  volume?: number; // 0.0 to 1.0 (default: 1.0)
  pan?: number;    // -1.0 (left) to 1.0 (right, default: 0.0)
  assetId?: string;
  audioSource?: IAudioSourceProvider;
  modifiers?: ModifierNode[];
  customSynthesizer?: (timeOffsetSec: number, durationSec: number, sampleRate: number) => Float32Array;
}

function resolveAssetPath(baseDir: string, assetSrc: string): string {
  if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(assetSrc) || assetSrc.startsWith('http://') || assetSrc.startsWith('https://') || assetSrc.startsWith('blob:')) {
    return assetSrc;
  }
  const cleanBase = baseDir.replace(/[\\/]+$/, '');
  const cleanSrc = assetSrc.replace(/^[\\/]+/, '');
  return `${cleanBase}/${cleanSrc}`;
}

export interface AudioMixResult {
  left: Float32Array;
  right: Float32Array;
  peakDb: number;
  rmsDb: number;
}

/**
 * UniversalAudioMixer:
 * Isomorphic Float32 DSP multi-track master-bus audio mixer.
 * Features sample-accurate clip mixing, equal-power stereo panning,
 * pure Float32 modifier plugin pipelines, and sidechain dynamic ducking.
 */
export class UniversalAudioMixer {
  public duckingFactor = 0.25; // Attenuate BGM to 25% when voice is active
  public attackMs = 150;
  public releaseMs = 300;
  public sampleRate = 44100;
  private clips: AudioMixerClip[] = [];
  private timelineDuckingEnvelope: Float32Array | null = null;
  private timelineDuckingRate = 1000; // 1 ms resolution (1000 Hz)
  private lastTimeline: ResolvedTimeline | null = null;
  private lastResolver?: (assetId: string, src?: string) => IAudioSourceProvider | undefined;

  constructor(clips: AudioMixerClip[] = [], sampleRate = 44100) {
    this.clips = clips;
    this.sampleRate = sampleRate;
  }

  public setSampleRate(sampleRate: number): void {
    if (this.sampleRate !== sampleRate) {
      this.sampleRate = sampleRate;
      if (this.lastTimeline) {
        this.rebuildDuckingProfile(this.lastTimeline);
      }
    }
  }

  public setClips(clips: AudioMixerClip[]): void {
    this.clips = clips;
  }

  public addClip(clip: AudioMixerClip): void {
    this.clips.push(clip);
  }

  public getClips(): AudioMixerClip[] {
    return this.clips;
  }

  /**
   * Evaluates or interpolates the pre-computed timeline dynamic ducking gain multiplier at timeSec.
   */
  public getDuckingFactorAtTime(timeSec: number): number {
    if (!this.timelineDuckingEnvelope || this.timelineDuckingEnvelope.length === 0) {
      return 1.0;
    }
    const samplePos = timeSec * this.timelineDuckingRate;
    const idx = Math.floor(samplePos);
    if (idx < 0) return 1.0;
    if (idx >= this.timelineDuckingEnvelope.length - 1) {
      return this.timelineDuckingEnvelope[this.timelineDuckingEnvelope.length - 1] ?? 1.0;
    }
    const frac = samplePos - idx;
    return this.timelineDuckingEnvelope[idx] * (1 - frac) + this.timelineDuckingEnvelope[idx + 1] * frac;
  }

  /**
   * Pre-calculates a continuous timeline-wide sidechain ducking curve at 1000 Hz (1ms resolution).
   * Guarantees identical, flutter-free ducking across arbitrary slice boundaries.
   */
  public rebuildDuckingProfile(timeline?: ResolvedTimeline): void {
    const tl = timeline || this.lastTimeline;
    if (!tl) {
      this.timelineDuckingEnvelope = null;
      return;
    }

    const fps = tl.meta?.globalFps || 30;
    const totalSec = tl.durationSeconds || (tl.totalFrames ? tl.totalFrames / fps : 10);
    const totalEnvSamples = Math.max(1, Math.ceil(totalSec * this.timelineDuckingRate));
    const voicePcm = new Float32Array(totalEnvSamples);

    let hasVoice = false;
    for (const clip of this.clips) {
      if (clip.type === 'voice' || clip.modifiers?.some((m) => m.type === 'sfx/dynamic_ducking')) {
        hasVoice = true;
        const startIdx = Math.max(0, Math.floor(clip.startTimeSec * this.timelineDuckingRate));
        const endIdx = Math.min(
          totalEnvSamples,
          Math.ceil((clip.startTimeSec + clip.durationSec) * this.timelineDuckingRate)
        );
        for (let i = startIdx; i < endIdx; i++) {
          voicePcm[i] = Math.max(voicePcm[i], 0.25);
        }
      }
    }

    if (!hasVoice) {
      this.timelineDuckingEnvelope = null;
      return;
    }

    const attenuationDb = this.duckingFactor > 1e-4 ? 20 * Math.log10(this.duckingFactor) : -60;
    this.timelineDuckingEnvelope = DynamicAudioDuckingEngine.generateEnvelope(voicePcm, totalEnvSamples, {
      sampleRate: this.timelineDuckingRate,
      channels: 1,
      attenuationDb,
      thresholdDb: -36.0,
      attackMs: this.attackMs,
      holdMs: 100,
      releaseMs: this.releaseMs,
    });
  }

  /**
   * Builds AudioMixerClip array from a ResolvedTimeline, inspecting tracks, audio modifiers, and ducking parameters.
   */
  public syncFromTimeline(
    timeline: ResolvedTimeline,
    audioSourceResolver?: (assetId: string, src?: string) => IAudioSourceProvider | undefined
  ): void {
    const fps = timeline.meta?.globalFps || 30;
    const clips: AudioMixerClip[] = [];
    let customDuckingFactor: number | null = null;

    const assets = (timeline as any).assets || (timeline as any).doc?.assets || {};

    for (const track of timeline.tracks.values()) {
      if (track.type !== 'audio' && track.type !== 'video') {
        continue;
      }
      if (track.muted) {
        continue;
      }

      const trackVol = track.style?.volume !== undefined ? track.style.volume : 1.0;
      const trackPan = track.style?.pan !== undefined ? track.style.pan : 0.0;

      for (const seq of track.sequences) {
        const hasAudioModifier = seq.modifiers?.some((m) =>
          m.type.startsWith('audio/') || m.type.startsWith('sfx/')
        );
        const isAudioTrack = track.type === 'audio';

        if (!isAudioTrack && !hasAudioModifier) {
          continue;
        }

        const startSec = (seq.startFrame ?? 0) / Math.max(1, fps);
        const durationSec = (seq.durationFrames || 30) / Math.max(1, fps);

        let clipVolume = typeof (seq as any).volume === 'number' ? (seq as any).volume : 1.0;
        let clipPan = 0.0;

        if (seq.modifiers) {
          for (const mod of seq.modifiers) {
            if (mod.type === 'sfx/dynamic_ducking' && mod.params) {
              const p = mod.params as any;
              if (typeof p.duckVolume === 'number') customDuckingFactor = p.duckVolume;
              if (typeof p.attackMs === 'number') this.attackMs = p.attackMs;
              if (typeof p.releaseMs === 'number') this.releaseMs = p.releaseMs;
              if (typeof p.stereoPan === 'number') clipPan = p.stereoPan;
            }
            if (mod.type === 'audio/volume' && mod.params) {
              const p = mod.params as any;
              if (typeof p.volume === 'number') clipVolume = p.volume;
            }
            if (mod.type === 'audio/pan' && mod.params) {
              const p = mod.params as any;
              if (typeof p.stereoPan === 'number') clipPan = p.stereoPan;
              else if (typeof p.pan === 'number') clipPan = p.pan;
            }
          }
        }

        clipVolume = clipVolume * trackVol;
        clipPan = Math.max(-1.0, Math.min(1.0, clipPan + trackPan));

        let audioSource: IAudioSourceProvider | undefined;
        if (audioSourceResolver && seq.assetId) {
          const assetDef = assets[seq.assetId];
          audioSource = audioSourceResolver(seq.assetId, assetDef?.src);
        }

        // Infer clip audio type ('voice' | 'sfx' | 'bgm') from sequence / track semantics or modifiers
        let clipType: AudioTrackType = 'bgm';
        const identifier = `${seq.id} ${seq.name || ''} ${track.id} ${track.name || ''}`.toLowerCase();
        if (/voice|dialogue|speech|narration|vocal/.test(identifier)) {
          clipType = 'voice';
        } else if (/sfx|effect|laser|impact|hit|foley|sound_effect/.test(identifier)) {
          clipType = 'sfx';
        }

        clips.push({
          id: seq.id,
          type: clipType,
          startTimeSec: startSec,
          durationSec,
          volume: clipVolume,
          pan: clipPan,
          assetId: seq.assetId,
          audioSource,
          modifiers: seq.modifiers,
        });
      }
    }

    if (customDuckingFactor !== null) {
      this.duckingFactor = customDuckingFactor;
    } else {
      this.duckingFactor = 0.25;
    }

    this.lastTimeline = timeline;
    this.lastResolver = audioSourceResolver;
    this.setClips(clips);
    this.rebuildDuckingProfile(timeline);
  }

  /**
   * Mixes all active clips over a given time slice into stereo Float32Array PCM buffers.
   */
  public mixStereo(timeOffsetSec: number, durationSec: number): AudioMixResult {
    const numSamples = Math.floor(durationSec * this.sampleRate);
    const masterLeft = new Float32Array(numSamples);
    const masterRight = new Float32Array(numSamples);

    if (numSamples === 0) {
      return { left: masterLeft, right: masterRight, peakDb: -60, rmsDb: -60 };
    }

    const sliceStart = timeOffsetSec;
    const sliceEnd = timeOffsetSec + durationSec;

    // Track sub-mix buses
    const voiceLeft = new Float32Array(numSamples);
    const voiceRight = new Float32Array(numSamples);
    const sfxLeft = new Float32Array(numSamples);
    const sfxRight = new Float32Array(numSamples);
    const bgmLeft = new Float32Array(numSamples);
    const bgmRight = new Float32Array(numSamples);

    let hasVoice = false;

    // 1. Render active clips into their respective track buses
    for (const clip of this.clips) {
      const clipStart = clip.startTimeSec;
      const clipEnd = clipStart + clip.durationSec;

      // Check time overlap between slice and clip
      const overlapStart = Math.max(sliceStart, clipStart);
      const overlapEnd = Math.min(sliceEnd, clipEnd);
      if (overlapEnd <= overlapStart) {
        continue;
      }

      const offsetFromClipStart = overlapStart - clipStart;
      const overlapDuration = overlapEnd - overlapStart;

      // Generate or sample raw audio for this clip's overlapping section
      const { left: rawL, right: rawR } = this.sampleClipAudio(clip, offsetFromClipStart, overlapDuration);

      // Process clip-level modifier plugins
      this.applyClipModifiers(clip, rawL, rawR, offsetFromClipStart, overlapDuration);

      // Apply base clip volume and pan if not overridden by modifiers
      const clipVolume = clip.volume ?? 1.0;
      const pan = Math.max(-1.0, Math.min(1.0, clip.pan ?? 0.0));
      const panAngle = ((pan + 1.0) / 2.0) * (Math.PI / 2.0);
      const gainL = Math.cos(panAngle) * clipVolume;
      const gainR = Math.sin(panAngle) * clipVolume;

      const outStartIdx = Math.floor((overlapStart - sliceStart) * this.sampleRate);
      const overlapSamples = Math.floor(overlapDuration * this.sampleRate);

      for (let j = 0; j < overlapSamples; j++) {
        const outIdx = outStartIdx + j;
        if (outIdx >= numSamples) break;

        const sampleL = (rawL[j] ?? 0) * gainL;
        const sampleR = (rawR[j] ?? 0) * gainR;

        if (clip.type === 'voice') {
          voiceLeft[outIdx] += sampleL;
          voiceRight[outIdx] += sampleR;
          hasVoice = true;
        } else if (clip.type === 'sfx') {
          sfxLeft[outIdx] += sampleL;
          sfxRight[outIdx] += sampleR;
        } else {
          bgmLeft[outIdx] += sampleL;
          bgmRight[outIdx] += sampleR;
        }
      }
    }

    // 2. Master Bus Dynamic Ducking:
    // If a timeline-wide envelope was built (via syncFromTimeline), use smooth global lookup.
    // Otherwise fallback to local slice envelope calculation.
    let duckingEnvelope: Float32Array | null = null;
    const useGlobalDucking = this.timelineDuckingEnvelope !== null;

    if (!useGlobalDucking && hasVoice) {
      // Calculate mono energy of voice for ducking analysis
      const voiceMono = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        voiceMono[i] = Math.max(Math.abs(voiceLeft[i]), Math.abs(voiceRight[i]));
      }

      // Convert linear duckingFactor into dB attenuation for DynamicAudioDuckingEngine
      const attenuationDb = this.duckingFactor > 1e-4 ? 20 * Math.log10(this.duckingFactor) : -60;
      duckingEnvelope = DynamicAudioDuckingEngine.generateEnvelope(voiceMono, numSamples, {
        sampleRate: this.sampleRate,
        channels: 1,
        attenuationDb,
        attackMs: this.attackMs,
        holdMs: 100,
        releaseMs: this.releaseMs,
        thresholdDb: -36.0,
      });
    }

    // 3. Sum Track Buses into Master Bus with Ducking
    for (let i = 0; i < numSamples; i++) {
      let bgmFactor = 1.0;
      if (useGlobalDucking) {
        const t = sliceStart + i / this.sampleRate;
        bgmFactor = this.getDuckingFactorAtTime(t);
      } else if (duckingEnvelope) {
        bgmFactor = duckingEnvelope[i];
      }

      masterLeft[i] = voiceLeft[i] + sfxLeft[i] + bgmLeft[i] * bgmFactor;
      masterRight[i] = voiceRight[i] + sfxRight[i] + bgmRight[i] * bgmFactor;

      // Soft analog limiter on master bus
      masterLeft[i] = Math.tanh(masterLeft[i]);
      masterRight[i] = Math.tanh(masterRight[i]);
    }

    // 4. Measure Peak and RMS levels
    let sumSquares = 0;
    let peak = 0;

    for (let i = 0; i < numSamples; i++) {
      const monoVal = (Math.abs(masterLeft[i]) + Math.abs(masterRight[i])) * 0.5;
      if (monoVal > peak) peak = monoVal;
      sumSquares += monoVal * monoVal;
    }

    const rms = Math.sqrt(sumSquares / numSamples);
    const peakDb = peak > 1e-4 ? 20 * Math.log10(peak) : -60;
    const rmsDb = rms > 1e-4 ? 20 * Math.log10(rms) : -60;

    return {
      left: masterLeft,
      right: masterRight,
      peakDb: Math.max(-60, Math.min(0, peakDb)),
      rmsDb: Math.max(-60, Math.min(0, rmsDb)),
    };
  }

  /**
   * Samples raw audio channel data from clip audioSource, customSynthesizer, or procedural fallback.
   */
  private sampleClipAudio(
    clip: AudioMixerClip,
    timeOffsetSec: number,
    durationSec: number
  ): { left: Float32Array; right: Float32Array } {
    const numSamples = Math.floor(durationSec * this.sampleRate);

    // 1. Real audio source adapter
    if (clip.audioSource && clip.audioSource.isReady()) {
      return clip.audioSource.sample(timeOffsetSec, durationSec, this.sampleRate);
    }

    // 2. Custom synthesizer function
    if (clip.customSynthesizer) {
      const mono = clip.customSynthesizer(timeOffsetSec, durationSec, this.sampleRate);
      const left = new Float32Array(numSamples);
      const right = new Float32Array(numSamples);
      const copyLen = Math.min(mono.length, numSamples);
      left.set(mono.subarray(0, copyLen));
      right.set(mono.subarray(0, copyLen));
      return { left, right };
    }

    // 3. Procedural synthesis or silent fallback
    // If the clip was attached to a real assetId that is still loading or absent,
    // output silence instead of unexpected procedural synth tones.
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    if (clip.assetId) {
      return { left, right };
    }

    let mono: Float32Array;
    if (clip.type === 'voice') {
      mono = ProceduralAudioSynthesizer.synthPilotVoice(timeOffsetSec, durationSec, this.sampleRate);
    } else if (clip.type === 'sfx') {
      mono = ProceduralAudioSynthesizer.synthLaserSFX(timeOffsetSec, durationSec, this.sampleRate);
    } else {
      mono = ProceduralAudioSynthesizer.synthBGM(timeOffsetSec, durationSec, this.sampleRate);
    }

    const copyLen = Math.min(mono.length, numSamples);
    left.set(mono.subarray(0, copyLen));
    right.set(mono.subarray(0, copyLen));

    return { left, right };
  }

  /**
   * Dispatches pure Float32 audio modifier plugins on raw channel buffers.
   */
  private applyClipModifiers(
    clip: AudioMixerClip,
    left: Float32Array,
    right: Float32Array,
    timeOffsetSec: number,
    durationSec: number
  ): void {
    if (!clip.modifiers || clip.modifiers.length === 0) return;

    const registry = ModifierPluginRegistry.getInstance();
    const ctx: AudioProcessContext = {
      sampleRate: this.sampleRate,
      channels: 2,
      timeSec: timeOffsetSec,
      durationSec,
      sequenceId: clip.id,
    };

    for (const mod of clip.modifiers) {
      if (mod.type === 'sfx/dynamic_ducking') continue; // Handled on master bus

      const plugin = registry.get(mod.type);
      if (!plugin) continue;

      if (plugin.processStereoStream) {
        plugin.processStereoStream(ctx, left, right, mod.params);
      } else if (plugin.processAudioStream) {
        plugin.processAudioStream(ctx, left, mod.params);
        plugin.processAudioStream(ctx, right, mod.params);
      }
    }
  }

  /**
   * Evaluates DSP for any arbitrary time slice with guaranteed global envelope continuity.
   * Alias of mixStereo matching unified Option 2 specification.
   */
  public mixSlice(timeOffsetSec: number, durationSec: number): AudioMixResult {
    return this.mixStereo(timeOffsetSec, durationSec);
  }

  /**
   * Asynchronously streams timeline audio in discrete time chunks (e.g. 2.0s).
   * Yields interleaved Float32 DecoupledAudioMixResult instances with bounded memory.
   */
  public async *mixTimelineStream(
    timeline: ResolvedTimeline,
    chunkSizeSec = 2.0,
    options?: DecoupledAudioMixOptions
  ): AsyncGenerator<DecoupledAudioMixResult> {
    await this.preloadTimelineAudio(timeline, options);
    const fps = timeline.meta?.globalFps || 30;
    const totalDurationSec = timeline.durationSeconds || (timeline.totalFrames ? timeline.totalFrames / fps : 0);
    const totalSamples = DeterministicAudioClock.totalSamplesForFrames(
      timeline.totalFrames,
      this.sampleRate,
      fps
    );

    let timeSec = 0;
    let sampleOffset = 0;

    while (timeSec < totalDurationSec && sampleOffset < totalSamples) {
      const remainingSec = totalDurationSec - timeSec;
      const chunkDuration = Math.min(chunkSizeSec, remainingSec);
      const slice = this.mixStereo(timeSec, chunkDuration);
      const chunkSampleCount = slice.left.length;

      const interleaved = new Float32Array(chunkSampleCount * 2);
      for (let i = 0; i < chunkSampleCount; i++) {
        interleaved[i * 2] = slice.left[i];
        interleaved[i * 2 + 1] = slice.right[i];
      }

      yield {
        totalSamples: chunkSampleCount,
        sampleRate: this.sampleRate,
        channels: 2,
        durationSeconds: chunkDuration,
        buffer: interleaved,
        channelData: [slice.left, slice.right],
      };

      timeSec += chunkDuration;
      sampleOffset += chunkSampleCount;
    }
  }

  /**
   * Conforms to WinterTC (ECMA-429) WHATWG Streams.
   * Yields a continuous byte stream containing a standard RIFF/WAVE header followed by 16-bit PCM chunks.
   */
  public toReadableWavStream(
    timeline: ResolvedTimeline,
    chunkSizeSec = 2.0,
    options?: DecoupledAudioMixOptions
  ): ReadableStream<Uint8Array> {
    const self = this;
    let streamIter: AsyncIterator<DecoupledAudioMixResult> | null = null;
    let headerSent = false;
    const fps = timeline.meta?.globalFps || 30;
    const totalSamples = DeterministicAudioClock.totalSamplesForFrames(
      timeline.totalFrames,
      this.sampleRate,
      fps
    );

    return new ReadableStream<Uint8Array>({
      async start() {
        self.syncFromTimeline(timeline);
        streamIter = self.mixTimelineStream(timeline, chunkSizeSec, options)[Symbol.asyncIterator]();
      },
      async pull(controller) {
        if (!headerSent) {
          controller.enqueue(UniversalAudioMixer.createWavHeader(totalSamples, 2, self.sampleRate));
          headerSent = true;
          return;
        }
        if (!streamIter) {
          controller.close();
          return;
        }
        const next = await streamIter.next();
        if (next.done) {
          controller.close();
        } else if (next.value) {
          controller.enqueue(UniversalAudioMixer.encodePcmTo16Bit(next.value.buffer));
        }
      },
    });
  }

  /**
   * Pre-loads and decodes timeline audio assets into DecodedPcmSource instances on clips.
   * Enables identical DSP evaluation between offline master exports and interactive slices.
   */
  public async preloadTimelineAudio(
    timeline: ResolvedTimeline,
    options: DecoupledAudioMixOptions = {}
  ): Promise<void> {
    const baseDir = options.baseDir || '.';
    this.syncFromTimeline(timeline, this.lastResolver);

    const assets = (timeline as any).assets || (timeline as any).doc?.assets || {};
    for (const clip of this.clips) {
      if (clip.audioSource && clip.audioSource.isReady()) {
        continue;
      }
      if (clip.assetId && assets[clip.assetId]) {
        const assetSrc = assets[clip.assetId].src;
        const resolvedPath = resolveAssetPath(baseDir, assetSrc);
        const decoded = await this.decodeAsset(resolvedPath);
        if (decoded) {
          const totalSamples = decoded.totalSamplesPerChannel;
          const left = new Float32Array(totalSamples);
          const right = new Float32Array(totalSamples);
          const channels = decoded.channels;
          for (let s = 0; s < totalSamples; s++) {
            left[s] = decoded.data[s * channels];
            right[s] = channels > 1 ? decoded.data[s * channels + 1] : left[s];
          }
          clip.audioSource = new DecodedPcmSource({
            channels: [left, right],
            sourceSampleRate: decoded.sampleRate,
            sourceTrimStartSec: 0,
          });
        }
      }
    }
  }

  /**
   * Concurrently mixes an entire ResolvedTimeline into a single contiguous interleaved PCM audio stream.
   * Leverages mixTimelineStream for guaranteed parity with chunked and interactive preview audio.
   */
  public async mixTimeline(
    timeline: ResolvedTimeline,
    options: DecoupledAudioMixOptions = {}
  ): Promise<DecoupledAudioMixResult> {
    const fps = timeline.meta?.globalFps || 30;
    const totalSamples = DeterministicAudioClock.totalSamplesForFrames(
      timeline.totalFrames,
      this.sampleRate,
      fps
    );
    const channels = 2;
    const masterBuffer = new Float32Array(totalSamples * channels);
    let sampleOffset = 0;

    for await (const chunk of this.mixTimelineStream(timeline, 2.0, options)) {
      const copyLen = Math.min(chunk.buffer.length, masterBuffer.length - sampleOffset * channels);
      if (copyLen > 0) {
        masterBuffer.set(chunk.buffer.subarray(0, copyLen), sampleOffset * channels);
        sampleOffset += chunk.totalSamples;
      }
    }

    return {
      totalSamples,
      sampleRate: this.sampleRate,
      channels,
      durationSeconds: timeline.durationSeconds || (timeline.totalFrames / fps),
      buffer: masterBuffer,
    };
  }

  private audioCache = new Map<string, DecodedAudioPCM>();

  /**
   * Prime or inject pre-decoded audio PCM buffers into memory cache.
   * Useful when worker receives pre-decoded audio buffers from main thread or OPFS.
   */
  public primeAudioCache(key: string, decoded: DecodedAudioPCM): void {
    this.audioCache.set(key, decoded);
  }

  /**
   * Universal audio decoder leveraging MediaEngineRegistry with memory caching.
   * Decoupled from runtime environment (Node, Bun, Web Worker, or Browser).
   */
  public async decodeAsset(filePath: string): Promise<DecodedAudioPCM | null> {
    if (this.audioCache.has(filePath)) {
      return this.audioCache.get(filePath)!;
    }

    try {
      let engine: any;
      try {
        engine = MediaEngineRegistry.get();
      } catch {
        engine = await MediaEngineRegistry.getAsync().catch(() => null);
      }

      if (engine && typeof engine.createAudioDecoder === 'function') {
        const decoder = engine.createAudioDecoder();
        const decoded = await decoder.decodeToPCM(filePath, this.sampleRate, 2);
        if (decoded) {
          this.audioCache.set(filePath, decoded);
          return decoded;
        }
      }
    } catch (err) {
      console.warn(`[UniversalAudioMixer] Failed to decode audio asset "${filePath}" via MediaEngine:`, err);
    }
    return null;
  }

  /**
   * Generates a standard 44-byte RIFF/WAVE header for 16-bit PCM stereo/mono audio.
   */
  public static createWavHeader(totalSamples: number, channels: number, sampleRate: number): Uint8Array {
    const bytesPerSample = 2; // 16-bit
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalSamples * blockAlign;
    const totalBufferSize = 44 + dataSize;

    const buffer = new Uint8Array(44);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // RIFF chunk descriptor
    buffer.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
    view.setUint32(4, totalBufferSize - 8, true);
    buffer.set([0x57, 0x41, 0x56, 0x45], 8); // 'WAVE'

    // "fmt " sub-chunk
    buffer.set([0x66, 0x6d, 0x74, 0x20], 12); // 'fmt '
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // 16-bit

    // "data" sub-chunk
    buffer.set([0x64, 0x61, 0x74, 0x61], 36); // 'data'
    view.setUint32(40, dataSize, true);

    return buffer;
  }

  /**
   * Converts Float32Array PCM samples into 16-bit signed integer little-endian byte array.
   */
  public static encodePcmTo16Bit(floatSamples: Float32Array): Uint8Array {
    const len = floatSamples.length;
    const pcmChunk = new Uint8Array(len * 2);
    const chunkView = new DataView(pcmChunk.buffer, pcmChunk.byteOffset, pcmChunk.byteLength);

    let bOffset = 0;
    for (let i = 0; i < len; i++) {
      let s = floatSamples[i];
      if (s > 1.0) s = 1.0;
      else if (s < -1.0) s = -1.0;
      const int16 = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      chunkView.setInt16(bOffset, int16, true);
      bOffset += 2;
    }

    return pcmChunk;
  }

  /**
   * Pure isomorphic in-memory WAV encoder.
   * Converts Float32Array PCM stereo mixdown to standard RIFF 16-bit PCM WAV byte buffer.
   */
  public static encodeToWav(mixResult: DecoupledAudioMixResult): Uint8Array {
    const header = UniversalAudioMixer.createWavHeader(
      mixResult.totalSamples,
      mixResult.channels,
      mixResult.sampleRate
    );
    const data = UniversalAudioMixer.encodePcmTo16Bit(mixResult.buffer);
    const buffer = new Uint8Array(header.byteLength + data.byteLength);
    buffer.set(header, 0);
    buffer.set(data, header.byteLength);
    return buffer;
  }

  /**
   * Pure isomorphic stream-oriented WAV exporter.
   * Streams 16-bit PCM chunks directly into a storage WritableStream (OPFS in browser, native file in Node/Bun)
   * via ContentCacheRegistry, avoiding giant monolithic in-memory Blob allocations.
   */
  public static async exportToWav(filePath: string, mixResult: DecoupledAudioMixResult): Promise<void> {
    const totalFrames = mixResult.totalSamples;
    const channels = mixResult.channels;
    const sampleRate = mixResult.sampleRate;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalFrames * blockAlign;
    const totalBufferSize = 44 + dataSize;

    // 1. Generate standard 44-byte RIFF/WAVE header
    const headerBuffer = UniversalAudioMixer.createWavHeader(totalFrames, channels, sampleRate);

    const cache = ContentCacheRegistry.namespace(CacheNamespace.Audio);
    const metadata = {
      mimeType: 'audio/wav',
      sizeBytes: totalBufferSize,
      createdAt: Date.now(),
    };

    const floatSamples = mixResult.buffer;
    const totalSampleCount = floatSamples.length;
    const chunkSize = 16384; // 16k samples per chunk = 32KB buffer chunks

    // 2. If storage strategy supports streaming (OPFS / NativeFile), stream directly to WritableStream
    if (typeof cache.createWritableStream === 'function') {
      const writable = await cache.createWritableStream(filePath, metadata);
      const writer = writable.getWriter();

      try {
        await writer.write(headerBuffer);

        let sampleOffset = 0;
        while (sampleOffset < totalSampleCount) {
          const chunkLen = Math.min(chunkSize, totalSampleCount - sampleOffset);
          const pcmChunk = UniversalAudioMixer.encodePcmTo16Bit(
            floatSamples.subarray(sampleOffset, sampleOffset + chunkLen)
          );
          await writer.write(pcmChunk);
          sampleOffset += chunkLen;
        }

        await writer.close();
        return;
      } catch (streamErr) {
        await writer.abort(streamErr);
        throw streamErr;
      }
    }

    // 3. ReadableStream fallback for strategies without createWritableStream
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(headerBuffer);

        let sampleOffset = 0;
        while (sampleOffset < totalSampleCount) {
          const chunkLen = Math.min(chunkSize, totalSampleCount - sampleOffset);
          const pcmChunk = UniversalAudioMixer.encodePcmTo16Bit(
            floatSamples.subarray(sampleOffset, sampleOffset + chunkLen)
          );
          controller.enqueue(pcmChunk);
          sampleOffset += chunkLen;
        }

        controller.close();
      },
    });

    await cache.set(filePath, readable, metadata);
  }
}
