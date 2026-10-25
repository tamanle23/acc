import { ProceduralAudioSynthesizer } from './ProceduralAudioSynthesizer';

/**
 * IAudioSourceProvider:
 * Platform-independent contract for feeding PCM audio streams into UniversalAudioMixer.
 */
export interface IAudioSourceProvider {
  /**
   * Samples a slice of audio [timeOffsetSec, timeOffsetSec + durationSec] at targetSampleRate.
   */
  sample(timeOffsetSec: number, durationSec: number, targetSampleRate: number): {
    left: Float32Array;
    right: Float32Array;
  };
  isReady(): boolean;
}

export interface DecodedPcmOptions {
  channels: Float32Array[]; // [left, right] or [mono]
  sourceSampleRate: number;
  sourceTrimStartSec?: number;
  loop?: boolean;
}

/**
 * DecodedPcmSource:
 * Adapts raw in-memory decoded Float32Array PCM channel buffers (from browser AudioBuffer,
 * WAV decoders, or FFmpeg FFI) into UniversalAudioMixer.
 * Performs linear resampling when source sample rate does not match mixer sample rate.
 */
export class DecodedPcmSource implements IAudioSourceProvider {
  private channels: Float32Array[];
  private sourceSampleRate: number;
  private trimStartSec: number;
  private loop: boolean;

  constructor(options: DecodedPcmOptions) {
    this.channels = options.channels;
    this.sourceSampleRate = options.sourceSampleRate;
    this.trimStartSec = options.sourceTrimStartSec ?? 0;
    this.loop = options.loop ?? false;
  }

  public isReady(): boolean {
    return this.channels.length > 0 && this.channels[0].length > 0;
  }

  public sample(timeOffsetSec: number, durationSec: number, targetSampleRate: number): {
    left: Float32Array;
    right: Float32Array;
  } {
    const numSamples = Math.floor(durationSec * targetSampleRate);
    const leftOut = new Float32Array(numSamples);
    const rightOut = new Float32Array(numSamples);

    if (!this.isReady() || numSamples === 0) {
      return { left: leftOut, right: rightOut };
    }

    const leftIn = this.channels[0];
    const rightIn = this.channels.length > 1 ? this.channels[1] : this.channels[0];
    const totalSourceSamples = leftIn.length;

    for (let i = 0; i < numSamples; i++) {
      const targetTime = timeOffsetSec + (i / targetSampleRate) + this.trimStartSec;
      if (targetTime < 0) continue;

      let sourceSampleIdx = targetTime * this.sourceSampleRate;
      if (this.loop && totalSourceSamples > 0) {
        sourceSampleIdx = sourceSampleIdx % totalSourceSamples;
      }

      const idx0 = Math.floor(sourceSampleIdx);
      const frac = sourceSampleIdx - idx0;
      const idx1 = idx0 + 1;

      if (idx0 >= 0 && idx0 < totalSourceSamples) {
        const sL0 = leftIn[idx0];
        const sL1 = idx1 < totalSourceSamples ? leftIn[idx1] : (this.loop ? leftIn[0] : sL0);
        leftOut[i] = sL0 + frac * (sL1 - sL0);

        const sR0 = rightIn[idx0];
        const sR1 = idx1 < totalSourceSamples ? rightIn[idx1] : (this.loop ? rightIn[0] : sR0);
        rightOut[i] = sR0 + frac * (sR1 - sR0);
      }
    }

    return { left: leftOut, right: rightOut };
  }
}

/**
 * ProceduralSynthesizerSource:
 * Deterministic DSP fallback generator when audio assets are offline or still buffering.
 */
export class ProceduralSynthesizerSource implements IAudioSourceProvider {
  private clipType: 'voice' | 'sfx' | 'bgm';

  constructor(clipType: 'voice' | 'sfx' | 'bgm' = 'bgm') {
    this.clipType = clipType;
  }

  public isReady(): boolean {
    return true;
  }

  public sample(timeOffsetSec: number, durationSec: number, targetSampleRate: number): {
    left: Float32Array;
    right: Float32Array;
  } {
    let mono: Float32Array;
    if (this.clipType === 'voice') {
      mono = ProceduralAudioSynthesizer.synthPilotVoice(timeOffsetSec, durationSec, targetSampleRate);
    } else if (this.clipType === 'sfx') {
      mono = ProceduralAudioSynthesizer.synthLaserSFX(timeOffsetSec, durationSec, targetSampleRate);
    } else {
      mono = ProceduralAudioSynthesizer.synthBGM(timeOffsetSec, durationSec, targetSampleRate);
    }

    const left = new Float32Array(mono.length);
    const right = new Float32Array(mono.length);
    left.set(mono);
    right.set(mono);

    return { left, right };
  }
}
