import { ProceduralAudioSynthesizer } from './ProceduralAudioSynthesizer';
import { DynamicAudioDuckingEngine } from './DynamicAudioDuckingEngine';
import type { IAudioSourceProvider } from './AudioSourceAdapter';
import type { ResolvedTimeline, ResolvedTrack } from '../../types/VideoIR';
import { ModifierPluginRegistry, type AudioProcessContext } from '../../plugins/ModifierPluginRegistry';
import { DeterministicAudioClock } from '../../compiler/DeterministicAudioClock';
import type { ModifierNode } from "../../types/modifiers";

export interface DecodedAudioPCM {
  sampleRate: number;
  channels: number;
  totalSamplesPerChannel: number;
  durationSeconds: number;
  data: Float32Array; // Interleaved Float32 PCM samples [-1.0, 1.0]
}

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

  constructor(clips: AudioMixerClip[] = [], sampleRate = 44100) {
    this.clips = clips;
    this.sampleRate = sampleRate;
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
   * Builds AudioMixerClip array from a ResolvedTimeline, inspecting tracks, audio modifiers, and ducking parameters.
   */
  public syncFromTimeline(
    timeline: ResolvedTimeline,
    audioSourceResolver?: (assetId: string, src?: string) => IAudioSourceProvider | undefined
  ): void {
    const fps = timeline.meta?.globalFps || (timeline.meta as any)?.fps || 30;
    const clips: AudioMixerClip[] = [];
    let customDuckingFactor: number | null = null;

    const assets = (timeline as any).assets || (timeline as any).doc?.assets || {};

    for (const track of timeline.tracks.values()) {
      if (track.type !== 'audio' && track.type !== 'video') {
        continue;
      }

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

        let clipType: AudioTrackType = 'bgm';
        const nameLower = (seq.name || '').toLowerCase();
        const kindLower = ((seq as any).kind || '').toLowerCase();
        const trackIdLower = (track.id || '').toLowerCase();

        if (
          nameLower.includes('pilot') ||
          nameLower.includes('voice') ||
          kindLower.includes('voice') ||
          trackIdLower.includes('voice') ||
          trackIdLower.includes('a1')
        ) {
          clipType = 'voice';
        } else if (
          nameLower.includes('bgm') ||
          nameLower.includes('music') ||
          kindLower.includes('bgm') ||
          trackIdLower.includes('bgm') ||
          trackIdLower.includes('a2')
        ) {
          clipType = 'bgm';
        } else if (
          nameLower.includes('laser') ||
          nameLower.includes('sfx') ||
          kindLower.includes('sfx') ||
          trackIdLower.includes('sfx') ||
          trackIdLower.includes('a3')
        ) {
          clipType = 'sfx';
        }

        let clipVolume = 0.8;
        let clipPan = clipType === 'sfx' ? -0.3 : 0.0;

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
          }
        }

        let audioSource: IAudioSourceProvider | undefined;
        if (audioSourceResolver && seq.assetId) {
          const assetDef = assets[seq.assetId];
          audioSource = audioSourceResolver(seq.assetId, assetDef?.src);
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

    this.setClips(clips);
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

      // Check time overlap
      if (clipEnd <= sliceStart || clipStart >= sliceEnd) {
        continue;
      }

      // Generate or sample raw audio for this clip
      const { left: rawL, right: rawR } = this.sampleClipAudio(clip, sliceStart, durationSec);

      // Process clip-level modifier plugins
      this.applyClipModifiers(clip, rawL, rawR, sliceStart, durationSec);

      // Apply base clip volume and pan if not overridden by modifiers
      const clipVolume = clip.volume ?? 1.0;
      const pan = Math.max(-1.0, Math.min(1.0, clip.pan ?? 0.0));
      const panAngle = ((pan + 1.0) / 2.0) * (Math.PI / 2.0);
      const gainL = Math.cos(panAngle) * clipVolume;
      const gainR = Math.sin(panAngle) * clipVolume;

      for (let i = 0; i < numSamples; i++) {
        const t = sliceStart + i / this.sampleRate;
        if (t >= clipStart && t < clipEnd) {
          const sampleL = rawL[i] * gainL;
          const sampleR = rawR[i] * gainR;

          if (clip.type === 'voice') {
            voiceLeft[i] += sampleL;
            voiceRight[i] += sampleR;
            hasVoice = true;
          } else if (clip.type === 'sfx') {
            sfxLeft[i] += sampleL;
            sfxRight[i] += sampleR;
          } else {
            bgmLeft[i] += sampleL;
            bgmRight[i] += sampleR;
          }
        }
      }
    }

    // 2. Master Bus Dynamic Ducking:
    // Generate sidechain envelope from voice dialogue energy
    let duckingEnvelope: Float32Array | null = null;
    if (hasVoice) {
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
      const bgmFactor = duckingEnvelope ? duckingEnvelope[i] : 1.0;
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

    // 3. Fallback procedural synthesis
    let mono: Float32Array;
    if (clip.type === 'voice') {
      mono = ProceduralAudioSynthesizer.synthPilotVoice(timeOffsetSec, durationSec, this.sampleRate);
    } else if (clip.type === 'sfx') {
      mono = ProceduralAudioSynthesizer.synthLaserSFX(timeOffsetSec, durationSec, this.sampleRate);
    } else {
      mono = ProceduralAudioSynthesizer.synthBGM(timeOffsetSec, durationSec, this.sampleRate);
    }

    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);
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
   * Concurrently mixes an entire ResolvedTimeline into a single contiguous interleaved PCM audio stream.
   * Unifies timeline-level offline mixing with sample-accurate ducking, BGM loops, and spatial pan.
   */
  public async mixTimeline(
    timeline: ResolvedTimeline,
    options: DecoupledAudioMixOptions = {}
  ): Promise<DecoupledAudioMixResult> {
    const totalSamples = DeterministicAudioClock.totalSamplesForFrames(
      timeline.totalFrames,
      this.sampleRate,
      timeline.meta.globalFps
    );
    const channels = 2;

    // Master bus (Float32 interleaved stereo)
    const masterBuffer = new Float32Array(totalSamples * channels);
    // Dedicated voiceover bus for sidechain ducking analysis
    const voiceBuffer = new Float32Array(totalSamples * channels);

    // Collect tracks by type
    const voiceTracks: ResolvedTrack[] = [];
    const bgmTracks: ResolvedTrack[] = [];
    const sfxTracks: ResolvedTrack[] = [];

    for (const track of timeline.tracks.values()) {
      if (track.type === 'audio') {
        if (track.id.includes('voiceover') || track.id.includes('a1')) {
          voiceTracks.push(track);
        } else if (track.id.includes('bgm') || track.id.includes('a2')) {
          bgmTracks.push(track);
        } else {
          sfxTracks.push(track);
        }
      }
    }

    const baseDir = options.baseDir || '.';

    // --- PHASE 1: Render Voiceover Dialogue Track ---
    for (const track of voiceTracks) {
      for (const seq of track.sequences) {
        const startSample = Math.round(
          (seq.startFrame * this.sampleRate) / timeline.meta.globalFps
        );
        const durationSamples = Math.round(
          (seq.durationFrames * this.sampleRate) / timeline.meta.globalFps
        );
        const endSample = Math.min(totalSamples, startSample + durationSamples);

        let decoded: DecodedAudioPCM | null = null;
        if (seq.assetId && timeline.assets && timeline.assets[seq.assetId]) {
          const assetSrc = timeline.assets[seq.assetId].src;
          const resolvedPath = resolveAssetPath(baseDir, assetSrc);
          decoded = await this.decodeAsset(resolvedPath);
        }

        if (decoded) {
          const srcData = decoded.data;
          const totalSrcSamples = decoded.totalSamplesPerChannel;

          for (let s = startSample; s < endSample; s++) {
            const srcIdx = s - startSample;
            if (srcIdx >= totalSrcSamples) break;

            const outIdx = s * channels;
            const inIdx = srcIdx * channels;
            const left = srcData[inIdx];
            const right = srcData[inIdx + 1];

            voiceBuffer[outIdx] += left;
            voiceBuffer[outIdx + 1] += right;

            masterBuffer[outIdx] += left;
            masterBuffer[outIdx + 1] += right;
          }
        }
      }
    }

    // --- PHASE 2: Dynamic Sidechain Envelope Calculation ---
    let duckingEnvelope: Float32Array | null = null;
    const hasDucking = bgmTracks.some((t) => t.modifiers?.some((m) => m.type === 'sfx/dynamic_ducking'));
    if (hasDucking) {
      duckingEnvelope = DynamicAudioDuckingEngine.generateEnvelope(voiceBuffer, totalSamples, {
        sampleRate: this.sampleRate,
        channels,
        attenuationDb: -18.0,
        thresholdDb: -36.0,
        attackMs: 15,
        holdMs: 100,
        releaseMs: 300,
      });
    }

    // --- PHASE 3: Render Background Music (BGM) with Loop, Fade & Ducking ---
    for (const track of bgmTracks) {
      for (const seq of track.sequences) {
        const startSample = Math.round(
          (seq.startFrame * this.sampleRate) / timeline.meta.globalFps
        );
        const durationSamples = Math.round(
          (seq.durationFrames * this.sampleRate) / timeline.meta.globalFps
        );
        const endSample = Math.min(totalSamples, startSample + durationSamples);
        const baseGain = 0.25; // Default BGM volume multiplier

        let decoded: DecodedAudioPCM | null = null;
        if (seq.assetId && timeline.assets && timeline.assets[seq.assetId]) {
          const assetSrc = timeline.assets[seq.assetId].src;
          const resolvedPath = resolveAssetPath(baseDir, assetSrc);
          decoded = await this.decodeAsset(resolvedPath);
        }

        const fadeInSamples = Math.round(1.5 * this.sampleRate);
        const fadeOutSamples = Math.round(2.0 * this.sampleRate);

        if (decoded) {
          const srcData = decoded.data;
          const totalSrcSamples = decoded.totalSamplesPerChannel;

          for (let s = startSample; s < endSample; s++) {
            const loopSampleIdx = (s - startSample) % totalSrcSamples;
            const inIdx = loopSampleIdx * channels;

            let fadeGain = 1.0;
            const tFromStart = s - startSample;
            const tFromEnd = endSample - s;
            if (tFromStart < fadeInSamples) {
              fadeGain = Math.sin((Math.PI * tFromStart) / (2 * fadeInSamples));
            } else if (tFromEnd < fadeOutSamples) {
              fadeGain = Math.sin((Math.PI * tFromEnd) / (2 * fadeOutSamples));
            }

            let duckMultiplier = 1.0;
            if (duckingEnvelope) {
              duckMultiplier = duckingEnvelope[s];
            }

            const currentBgmGain = baseGain * fadeGain * duckMultiplier;
            const outIdx = s * channels;

            masterBuffer[outIdx] += srcData[inIdx] * currentBgmGain;
            masterBuffer[outIdx + 1] += srcData[inIdx + 1] * currentBgmGain;
          }
        } else {
          for (let s = startSample; s < endSample; s++) {
            const outIdx = s * channels;
            const duckMultiplier = duckingEnvelope ? duckingEnvelope[s] : 1.0;
            const gain = 0.04 * duckMultiplier;
            masterBuffer[outIdx] += gain;
            masterBuffer[outIdx + 1] += gain;
          }
        }
      }
    }

    // --- PHASE 4: Render Sound Effects (SFX) with Stereo Panning ---
    for (const track of sfxTracks) {
      for (const seq of track.sequences) {
        const startSample = Math.round(
          (seq.startFrame * this.sampleRate) / timeline.meta.globalFps
        );
        const durationSamples = Math.round(
          (seq.durationFrames * this.sampleRate) / timeline.meta.globalFps
        );
        const endSample = Math.min(totalSamples, startSample + durationSamples);

        let decoded: DecodedAudioPCM | null = null;
        if (seq.assetId && timeline.assets && timeline.assets[seq.assetId]) {
          const assetSrc = timeline.assets[seq.assetId].src;
          const resolvedPath = resolveAssetPath(baseDir, assetSrc);
          decoded = await this.decodeAsset(resolvedPath);
        }

        const pan = (seq as any).spatialPan ?? 0.0;
        const clampedPan = Math.max(-1.0, Math.min(1.0, pan));
        const panAngle = ((clampedPan + 1.0) * Math.PI) / 4.0;
        const panLeftGain = Math.cos(panAngle);
        const panRightGain = Math.sin(panAngle);
        const sfxVolume = (seq as any).volume ?? 0.8;

        if (decoded) {
          const srcData = decoded.data;
          const totalSrcSamples = decoded.totalSamplesPerChannel;

          for (let s = startSample; s < endSample; s++) {
            const srcIdx = s - startSample;
            if (srcIdx >= totalSrcSamples) break;

            const inIdx = srcIdx * channels;
            const outIdx = s * channels;

            const monoEnergy = (srcData[inIdx] + srcData[inIdx + 1]) * 0.5;
            masterBuffer[outIdx] += monoEnergy * panLeftGain * sfxVolume;
            masterBuffer[outIdx + 1] += monoEnergy * panRightGain * sfxVolume;
          }
        }
      }
    }

    // --- PHASE 5: Tanh Soft-Clipping Master Bus Brickwall Limiter ---
    for (let i = 0; i < masterBuffer.length; i++) {
      masterBuffer[i] = Math.tanh(masterBuffer[i]);
    }

    return {
      totalSamples,
      sampleRate: this.sampleRate,
      channels,
      durationSeconds: timeline.durationSeconds,
      buffer: masterBuffer,
    };
  }

  private audioCache = new Map<string, DecodedAudioPCM>();

  /**
   * Universal audio decoder leveraging FFIAudioDecoder with memory caching.
   */
  public async decodeAsset(filePath: string): Promise<DecodedAudioPCM | null> {
    if (this.audioCache.has(filePath)) {
      return this.audioCache.get(filePath)!;
    }

    try {
      if (typeof process !== 'undefined' && process.versions?.node) {
        // Dynamically load native FFIAudioDecoder only in Node/Bun runtime
        const req = typeof require !== 'undefined' ? require : (0, eval)('require');
        const core = req('@acc/core');
        if (core?.FFIAudioDecoder) {
          const decoded = await core.FFIAudioDecoder.decodeToPCM(filePath, this.sampleRate, 2);
          if (decoded) {
            this.audioCache.set(filePath, decoded);
            return decoded;
          }
        }
      }
    } catch {
      // Fallback
    }
    return null;
  }

  /**
   * Encodes a DecoupledAudioMixResult into a valid 16-bit stereo PCM WAV file on disk.
   */
  /**
   * Pure isomorphic in-memory WAV encoder.
   * Converts Float32Array PCM stereo mixdown to standard RIFF 16-bit PCM WAV byte buffer.
   */
  public static encodeToWav(mixResult: DecoupledAudioMixResult): Uint8Array {
    const totalFrames = mixResult.totalSamples;
    const channels = mixResult.channels;
    const sampleRate = mixResult.sampleRate;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalFrames * blockAlign;
    const totalBufferSize = 44 + dataSize;

    const buffer = new Uint8Array(totalBufferSize);
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

    let byteOffset = 44;
    const floatSamples = mixResult.buffer;
    const len = floatSamples.length;

    for (let i = 0; i < len; i++) {
      let s = floatSamples[i];
      if (s > 1.0) s = 1.0;
      else if (s < -1.0) s = -1.0;
      const int16 = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      view.setInt16(byteOffset, int16, true);
      byteOffset += 2;
    }

    return buffer;
  }

  public static async exportToWav(filePath: string, mixResult: DecoupledAudioMixResult): Promise<void> {
    const wavBytes = UniversalAudioMixer.encodeToWav(mixResult);

    const pathModule = await import('path');
    const fsModule = await import('fs');
    const dir = pathModule.dirname(filePath);
    if (!fsModule.existsSync(dir)) {
      await fsModule.promises.mkdir(dir, { recursive: true });
    }

    await fsModule.promises.writeFile(filePath, Buffer.from(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength));
  }
}
