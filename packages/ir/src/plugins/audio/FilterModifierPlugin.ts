import type { ModifierPlugin, ModifierContext } from '../ModifierPluginRegistry';
import type { AudioProcessContext } from '../IVideoPluginStrategy';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';

export type AudioFilterType = 'lowpass' | 'highpass' | 'bandpass';

export interface FilterModifierParams {
  filterType: AudioFilterType;
  cutoffHz: number; // e.g. 800 Hz
  q?: number;        // Resonance Q factor (default: 0.707)
}

/**
 * FilterModifierPlugin:
 * Biquad 2-pole IIR filter modifier operating on pure Float32Array PCM buffers.
 */
export class FilterModifierPlugin implements ModifierPlugin<FilterModifierParams> {
  public readonly type = 'audio/filter';
  public readonly targetScope: ModifierTargetScope = 'sequence';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['audio', 'video'];
  public readonly targetPhase = 4;
  public readonly schema = {
    fields: {
      filterType: {
        key: 'filterType',
        label: 'Filter Topology',
        type: 'select' as const,
        defaultValue: 'lowpass',
        options: [
          { label: 'Low-Pass Filter (LPF)', value: 'lowpass' },
          { label: 'High-Pass Filter (HPF)', value: 'highpass' },
          { label: 'Band-Pass Intercom (BPF)', value: 'bandpass' },
        ],
      },
      cutoffHz: {
        key: 'cutoffHz',
        label: 'Cutoff Frequency',
        type: 'number' as const,
        min: 20,
        max: 20000,
        step: 10,
        defaultValue: 1200,
        unit: 'Hz',
      },
      q: {
        key: 'q',
        label: 'Resonance (Q)',
        type: 'number' as const,
        min: 0.1,
        max: 10.0,
        step: 0.05,
        defaultValue: 0.707,
      },
    },
  };

  public validate(params: unknown): params is FilterModifierParams {
    return Boolean(
      params &&
        typeof params === 'object' &&
        'filterType' in params &&
        'cutoffHz' in params &&
        typeof (params as any).cutoffHz === 'number'
    );
  }

  public execute(context: ModifierContext, params: FilterModifierParams): void {
    if (!context.state) context.state = {};
    context.state.audioFilter = {
      filterType: params.filterType,
      cutoffHz: params.cutoffHz,
      q: params.q ?? 0.707,
    };
  }

  public processAudioStream(
    ctx: AudioProcessContext,
    buffer: Float32Array,
    params: FilterModifierParams
  ): void {
    const sampleRate = ctx.sampleRate || 44100;
    const cutoff = Math.max(20, Math.min(sampleRate / 2 - 100, params.cutoffHz));
    const q = Math.max(0.1, params.q ?? 0.707);

    // Robert Bristow-Johnson biquad filter calculations
    const w0 = (2 * Math.PI * cutoff) / sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * q);

    let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

    if (params.filterType === 'lowpass') {
      b0 = (1 - cosw0) / 2;
      b1 = 1 - cosw0;
      b2 = (1 - cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    } else if (params.filterType === 'highpass') {
      b0 = (1 + cosw0) / 2;
      b1 = -(1 + cosw0);
      b2 = (1 + cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    } else {
      // bandpass
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    }

    // Normalized coefficients
    const nb0 = b0 / a0;
    const nb1 = b1 / a0;
    const nb2 = b2 / a0;
    const na1 = a1 / a0;
    const na2 = a2 / a0;

    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < buffer.length; i++) {
      const x0 = buffer[i];
      const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;

      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;

      buffer[i] = y0;
    }
  }
}
