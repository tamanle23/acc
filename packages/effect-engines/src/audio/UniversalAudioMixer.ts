import { ProceduralAudioSynthesizer } from './ProceduralAudioSynthesizer';

export type AudioTrackType = 'voice' | 'sfx' | 'bgm';

export interface AudioMixerClip {
  id: string;
  type: AudioTrackType;
  startTimeSec: number;
  durationSec: number;
  volume?: number; // 0.0 to 1.0
  pan?: number;    // -1.0 (left) to 1.0 (right)
  assetId?: string;
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
 * Isomorphic Float32 DSP multi-track audio mixer.
 * Features sample-accurate clip mixing, equal-power stereo panning, and automatic
 * voice-over ducking for BGM tracks.
 */
export class UniversalAudioMixer {
  private clips: AudioMixerClip[] = [];
  public duckingFactor = 0.25; // Attenuate BGM to 25% when voice is active
  public sampleRate = 44100;

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

  /**
   * Mixes all active clips over a given time slice into stereo Float32Array PCM buffers.
   */
  public mixStereo(timeOffsetSec: number, durationSec: number): AudioMixResult {
    const numSamples = Math.floor(durationSec * this.sampleRate);
    const leftOut = new Float32Array(numSamples);
    const rightOut = new Float32Array(numSamples);

    if (numSamples === 0) {
      return { left: leftOut, right: rightOut, peakDb: -60, rmsDb: -60 };
    }

    // 1. Detect voice activity mask for auto-ducking
    const voiceMask = new Float32Array(numSamples);
    for (const clip of this.clips) {
      if (clip.type === 'voice') {
        const clipStart = clip.startTimeSec;
        const clipEnd = clipStart + clip.durationSec;

        for (let i = 0; i < numSamples; i++) {
          const t = timeOffsetSec + i / this.sampleRate;
          if (t >= clipStart && t < clipEnd) {
            voiceMask[i] = 1.0;
          }
        }
      }
    }

    // Smooth voice ducking envelope (linear attack/release filter)
    const duckingEnvelope = new Float32Array(numSamples);
    let currentDucking = 1.0;
    const smoothingFactor = 0.005; // attack / release slew rate

    for (let i = 0; i < numSamples; i++) {
      const target = voiceMask[i] > 0 ? this.duckingFactor : 1.0;
      currentDucking += (target - currentDucking) * smoothingFactor;
      duckingEnvelope[i] = currentDucking;
    }

    // 2. Synthesize and accumulate each clip
    for (const clip of this.clips) {
      const clipStart = clip.startTimeSec;
      const clipEnd = clipStart + clip.durationSec;
      const sliceStart = timeOffsetSec;
      const sliceEnd = timeOffsetSec + durationSec;

      // Check overlap
      if (clipEnd <= sliceStart || clipStart >= sliceEnd) {
        continue;
      }

      const clipVolume = clip.volume ?? 1.0;
      const pan = Math.max(-1.0, Math.min(1.0, clip.pan ?? 0.0));

      // Equal-power stereo panning
      const panAngle = ((pan + 1.0) / 2.0) * (Math.PI / 2.0);
      const leftGain = Math.cos(panAngle) * clipVolume;
      const rightGain = Math.sin(panAngle) * clipVolume;

      // Synthesize audio samples
      let rawSamples: Float32Array;
      if (clip.customSynthesizer) {
        rawSamples = clip.customSynthesizer(timeOffsetSec, durationSec, this.sampleRate);
      } else {
        rawSamples = this.synthesizeDefault(clip, timeOffsetSec, durationSec);
      }

      for (let i = 0; i < numSamples; i++) {
        const t = timeOffsetSec + i / this.sampleRate;
        if (t >= clipStart && t < clipEnd) {
          let sample = rawSamples[i] || 0;
          if (clip.type === 'bgm') {
            sample *= duckingEnvelope[i];
          }
          leftOut[i] += sample * leftGain;
          rightOut[i] += sample * rightGain;
        }
      }
    }

    // 3. Measure Peak and RMS levels
    let sumSquares = 0;
    let peak = 0;

    for (let i = 0; i < numSamples; i++) {
      // Soft analog limiter on master bus
      leftOut[i] = Math.tanh(leftOut[i]);
      rightOut[i] = Math.tanh(rightOut[i]);

      const monoVal = (Math.abs(leftOut[i]) + Math.abs(rightOut[i])) * 0.5;
      if (monoVal > peak) {
        peak = monoVal;
      }
      sumSquares += monoVal * monoVal;
    }

    const rms = Math.sqrt(sumSquares / numSamples);
    const peakDb = peak > 1e-4 ? 20 * Math.log10(peak) : -60;
    const rmsDb = rms > 1e-4 ? 20 * Math.log10(rms) : -60;

    return {
      left: leftOut,
      right: rightOut,
      peakDb: Math.max(-60, Math.min(0, peakDb)),
      rmsDb: Math.max(-60, Math.min(0, rmsDb)),
    };
  }

  private synthesizeDefault(clip: AudioMixerClip, timeOffsetSec: number, durationSec: number): Float32Array {
    if (clip.type === 'voice') {
      return ProceduralAudioSynthesizer.synthPilotVoice(timeOffsetSec, durationSec, this.sampleRate);
    }
    if (clip.type === 'sfx') {
      return ProceduralAudioSynthesizer.synthLaserSFX(timeOffsetSec, durationSec, this.sampleRate);
    }
    return ProceduralAudioSynthesizer.synthBGM(timeOffsetSec, durationSec, this.sampleRate);
  }
}
