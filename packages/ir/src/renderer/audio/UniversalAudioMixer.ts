import fs from 'fs';
import path from 'path';
import { ProceduralAudioSynthesizer } from './ProceduralAudioSynthesizer';
import { DynamicAudioDuckingEngine } from './DynamicAudioDuckingEngine';
import type { IAudioSourceProvider } from './AudioSourceAdapter';
import type { ModifierNode, ResolvedTimeline, ResolvedTrack } from '../../types/VideoIR';
import { ModifierPluginRegistry, type AudioProcessContext } from '../../plugins/ModifierPluginRegistry';
import { DeterministicAudioClock } from '../../compiler/DeterministicAudioClock';
import type { DecodedAudioPCM } from '@acc/core';

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
          const resolvedPath = path.isAbsolute(assetSrc) ? assetSrc : path.resolve(baseDir, assetSrc);
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
          const resolvedPath = path.isAbsolute(assetSrc) ? assetSrc : path.resolve(baseDir, assetSrc);
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
          const resolvedPath = path.isAbsolute(assetSrc) ? assetSrc : path.resolve(baseDir, assetSrc);
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
  public static async exportToWav(filePath: string, mixResult: DecoupledAudioMixResult): Promise<void> {
    const totalFrames = mixResult.totalSamples;
    const channels = mixResult.channels;
    const sampleRate = mixResult.sampleRate;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalFrames * blockAlign;
    const totalBufferSize = 44 + dataSize;

    const buffer = Buffer.alloc(totalBufferSize);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(totalBufferSize - 8, 4);
    buffer.write('WAVE', 8);

    // "fmt " sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34);

    // "data" sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    let byteOffset = 44;
    const floatSamples = mixResult.buffer;
    const len = floatSamples.length;

    for (let i = 0; i < len; i++) {
      let s = floatSamples[i];
      if (s > 1.0) s = 1.0;
      else if (s < -1.0) s = -1.0;
      const int16 = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      buffer.writeInt16LE(int16, byteOffset);
      byteOffset += 2;
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(filePath, buffer);
  }
}
