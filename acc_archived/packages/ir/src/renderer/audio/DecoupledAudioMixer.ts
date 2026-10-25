import type { ResolvedTimeline } from '../../types/VideoIR';
import {
  UniversalAudioMixer,
  type DecoupledAudioMixResult,
  type DecoupledAudioMixOptions,
  type DecodedAudioPCM,
} from './UniversalAudioMixer';

export type { DecoupledAudioMixResult, DecoupledAudioMixOptions };

/**
 * DecoupledAudioMixer:
 * Backward-compatibility facade delegating directly to UniversalAudioMixer.
 * Guarantees zero regressions for existing production renderers and test suites.
 */
export class DecoupledAudioMixer {
  private mixer: UniversalAudioMixer;
  private sampleRate: number;
  private channels: number;

  constructor(sampleRate: number = 48000, channels: number = 2) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.mixer = new UniversalAudioMixer([], sampleRate);
  }

  public async decodeWav(filePath: string): Promise<{ data: Float32Array; sampleRate: number; channels: number } | null> {
    const res = await this.decodeAsset(filePath);
    return res ? { data: res.data, sampleRate: res.sampleRate, channels: res.channels } : null;
  }

  public async decodeAsset(filePath: string): Promise<DecodedAudioPCM | null> {
    return this.mixer.decodeAsset(filePath);
  }

  public async mix(
    timeline: ResolvedTimeline,
    options: DecoupledAudioMixOptions = {}
  ): Promise<DecoupledAudioMixResult> {
    return this.mixer.mixTimeline(timeline, options);
  }

  public static async exportToWav(filePath: string, mixResult: DecoupledAudioMixResult): Promise<void> {
    return UniversalAudioMixer.exportToWav(filePath, mixResult);
  }
}
