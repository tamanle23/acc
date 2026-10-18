import type {
  ModifierPlugin,
  ModifierContext,
  AudioProcessContext,
} from '../ModifierPluginRegistry';
import { ProceduralAudioSynthesizer } from '../../renderer/audio/ProceduralAudioSynthesizer';

export type ProceduralSFXType =
  | 'whoosh'
  | 'impact'
  | 'glitch'
  | 'riser'
  | 'laser'
  | 'engine_hum'
  | 'pilot_voice'
  | 'click'
  | 'pop'
  | 'beep'
  | 'sub_drop';

export interface ProceduralSFXModifierParams {
  sfxType?: ProceduralSFXType;
  durationSec?: number;
  pitchMultiplier?: number;
  intensity?: number;
  volume?: number;
  decay?: number;
  duckingAmount?: number;
  [key: string]: any;
}

/**
 * ProceduralSFXModifierPlugin:
 * Implements pure procedural DSP audio generation for SFX sequences ('sfx/procedural').
 * Target Scope: 'sequence' / 'audio'.
 *
 * Adheres strictly to:
 * - DETERMINISTIC-HANDSHAKE-BACKPRESSURE: Pure mathematical Float32Array synthesis.
 * - ZERO-ALLOC-FRAME-LOOP: In-place buffer addition during timeline audio mixdown.
 */
export class ProceduralSFXModifierPlugin implements ModifierPlugin<ProceduralSFXModifierParams> {
  public readonly type = 'sfx/procedural';
  public readonly targetScope = 'both';
  public readonly targetPhase = 2;

  public validate(params: unknown): params is ProceduralSFXModifierParams {
    return Boolean(params && typeof params === 'object');
  }

  public execute(context: ModifierContext, params: ProceduralSFXModifierParams): void {
    if (!context.state) context.state = {};
    context.state.sfx = params;
  }

  public processAudio(
    ctx: { sampleRate: number; outputBuffer: Float32Array; [key: string]: any },
    params: ProceduralSFXModifierParams
  ): void {
    const sampleRate = ctx.sampleRate || 44100;
    const generated = this.generateAudioBuffer(params, sampleRate);
    const len = Math.min(ctx.outputBuffer.length, generated.length);
    for (let i = 0; i < len; i++) {
      ctx.outputBuffer[i] += generated[i];
    }
  }

  /**
   * Generates a complete standalone Float32Array PCM buffer for preview audition or mixing.
   */
  public generateAudioBuffer(
    params: ProceduralSFXModifierParams,
    sampleRate: number = 44100
  ): Float32Array {
    const sfxType = params.sfxType || 'whoosh';
    const duration = params.durationSec || 1.0;
    const vol = params.volume !== undefined ? params.volume : 1.0;

    let rawBuffer: Float32Array;

    switch (sfxType) {
      case 'whoosh':
        rawBuffer = ProceduralAudioSynthesizer.synthWhoosh(0, duration, sampleRate);
        break;
      case 'impact':
        rawBuffer = ProceduralAudioSynthesizer.synthImpact(0, duration, sampleRate);
        break;
      case 'glitch':
        rawBuffer = ProceduralAudioSynthesizer.synthGlitch(0, duration, sampleRate);
        break;
      case 'riser':
        rawBuffer = ProceduralAudioSynthesizer.synthRiser(0, duration, sampleRate);
        break;
      case 'laser':
        rawBuffer = ProceduralAudioSynthesizer.synthLaserSFX(0, duration, sampleRate);
        break;
      case 'engine_hum':
        rawBuffer = ProceduralAudioSynthesizer.synthEngineHum(0, duration, sampleRate);
        break;
      case 'pilot_voice':
        rawBuffer = ProceduralAudioSynthesizer.synthPilotVoice(0, duration, sampleRate);
        break;
      case 'click':
        rawBuffer = this.synthClick(duration, sampleRate);
        break;
      case 'pop':
        rawBuffer = this.synthPop(duration, sampleRate);
        break;
      case 'beep':
        rawBuffer = this.synthBeep(duration, sampleRate, params.pitchMultiplier || 1.0);
        break;
      case 'sub_drop':
        rawBuffer = this.synthSubDrop(duration, sampleRate);
        break;
      default:
        rawBuffer = ProceduralAudioSynthesizer.synthWhoosh(0, duration, sampleRate);
        break;
    }

    if (vol !== 1.0) {
      for (let i = 0; i < rawBuffer.length; i++) {
        rawBuffer[i] *= vol;
      }
    }

    return rawBuffer;
  }

  /**
   * DSP Audio Hook: Blends procedural SFX directly into timeline audio mixing stream.
   */
  public processAudioStream(
    ctx: AudioProcessContext,
    buffer: Float32Array,
    params: ProceduralSFXModifierParams
  ): void {
    const durationSec = params.durationSec || 1.0;
    const generated = this.generateAudioBuffer(params, ctx.sampleRate);
    const blendLen = Math.min(buffer.length, generated.length);

    for (let i = 0; i < blendLen; i++) {
      buffer[i] += generated[i];
    }
  }

  // --- Parameterized DSP Synthesis Primitives ---

  private synthClick(durationSec: number = 0.05, sampleRate: number = 44100): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 200.0);
      const tone = Math.sin(2 * Math.PI * 3200 * t);
      const noise = ((((i * 9301 + 49297) % 233280) / 233280) * 2 - 1) * 0.4;
      buffer[i] = (tone + noise) * decay * 0.8;
    }
    return buffer;
  }

  private synthPop(durationSec: number = 0.12, sampleRate: number = 44100): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 35.0);
      const freq = 600 * Math.exp(-t * 60.0) + 120;
      buffer[i] = Math.sin(2 * Math.PI * freq * t) * decay * 0.9;
    }
    return buffer;
  }

  private synthBeep(durationSec: number = 0.15, sampleRate: number = 44100, pitch = 1.0): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);
    const baseFreq = 880 * pitch;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, Math.min(t * 80, (durationSec - t) * 80));
      buffer[i] = Math.sin(2 * Math.PI * baseFreq * t) * Math.max(0, envelope) * 0.6;
    }
    return buffer;
  }

  private synthSubDrop(durationSec: number = 2.0, sampleRate: number = 44100): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 1.5);
      const freq = 120 * Math.exp(-t * 2.5) + 25;
      buffer[i] = Math.tanh(Math.sin(2 * Math.PI * freq * t) * 1.2) * decay * 0.95;
    }
    return buffer;
  }
}
