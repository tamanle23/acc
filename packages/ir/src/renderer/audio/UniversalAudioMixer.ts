import { ProceduralAudioSynthesizer } from './ProceduralAudioSynthesizer';
import { DynamicAudioDuckingEngine } from './DynamicAudioDuckingEngine';
import type { IAudioSourceProvider } from './AudioSourceAdapter';
import type { ModifierNode } from '../../types/VideoIR';
import { ModifierPluginRegistry, type AudioProcessContext } from '../../plugins/ModifierPluginRegistry';

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
}
