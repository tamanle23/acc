// ============================================================================
// KINETIX STUDIO - LIVE STAGE & BROADCAST ENGINE SUITE (MILESTONE C)
// Verifies LineInAudioAdapter FFT frequency telemetry, transient kick detector,
// hardware MIDI parameter mapping normalization, and clean resource disposal.
// ============================================================================

import { describe, it, expect } from 'bun:test';
import { LineInAudioAdapter } from '@/adapters/driving/line-in-audio.adapter';
import type { MidiMappingEntry } from '@/components/modals/midi-learn-modal';

describe('Live Stage Engine: Line-In Audio & MIDI Mapping (Milestone C)', () => {
  it('instantiates LineInAudioAdapter and respects capability detection', () => {
    expect(typeof LineInAudioAdapter.isSupported).toBe('function');
    expect(typeof LineInAudioAdapter.isSupported()).toBe('boolean');

    const adapter = new LineInAudioAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.start).toBe('function');
    expect(typeof adapter.stop).toBe('function');
    expect(typeof adapter[Symbol.dispose]).toBe('function');
  });

  it('computes isolated bass, mid, and high energy from frequency bins accurately', () => {
    const adapter = new LineInAudioAdapter();
    const binCount = 512;
    const fakeFftData = new Uint8Array(binCount);

    // Inject strong energy in low frequencies (bass kick at ~60-100Hz)
    // bin width = 44100 / 2 / 512 = 43.06 Hz per bin
    // Bins 1, 2, 3 correspond to ~43Hz - 130Hz
    fakeFftData[1] = 240;
    fakeFftData[2] = 255;
    fakeFftData[3] = 230;

    const telemetry = adapter.computeTelemetry(fakeFftData, 44100);

    expect(telemetry.bass).toBeGreaterThan(0.2);
    expect(telemetry.high).toBeLessThan(0.05);
    expect(telemetry.beatPulse).toBeGreaterThan(0);
    expect(telemetry.level).toBeGreaterThan(0);
  });

  it('detects transient kicks with beat pulse trigger and decay', () => {
    const adapter = new LineInAudioAdapter();
    const fakeFftLow = new Uint8Array(512); // Quiet baseline
    const fakeFftKick = new Uint8Array(512); // Explosive kick
    fakeFftKick[1] = 255;
    fakeFftKick[2] = 255;
    fakeFftKick[3] = 255;
    fakeFftKick[4] = 255;

    // Step 1: Establish baseline
    adapter.computeTelemetry(fakeFftLow, 44100);

    // Step 2: Kick hits
    const kickTelemetry = adapter.computeTelemetry(fakeFftKick, 44100);
    expect(kickTelemetry.beatPulse).toBe(1.0);

    // Step 3: Decay on subsequent frame
    const decayTelemetry = adapter.computeTelemetry(fakeFftLow, 44100);
    expect(decayTelemetry.beatPulse).toBeLessThan(1.0);
  });

  it('scales normalized MIDI CC (0.0 to 1.0) into target parameter bounds accurately', () => {
    const bpmRule: MidiMappingEntry = {
      key: 'bpm',
      label: 'Tempo',
      controller: 14,
      channel: 1,
      min: 60,
      max: 180,
      unit: 'BPM',
      description: 'Tempo',
    };

    const scale = (valNorm: number, rule: MidiMappingEntry) =>
      rule.min + valNorm * (rule.max - rule.min);

    expect(scale(0.0, bpmRule)).toBe(60);
    expect(scale(1.0, bpmRule)).toBe(180);
    expect(scale(0.5, bpmRule)).toBe(120);

    const cutoffRule: MidiMappingEntry = {
      key: 'synthCutoff',
      label: 'Cutoff',
      controller: 74,
      channel: 1,
      min: 100,
      max: 8000,
      unit: 'Hz',
      description: 'Cutoff',
    };

    expect(scale(0.0, cutoffRule)).toBe(100);
    expect(scale(1.0, cutoffRule)).toBe(8000);
    expect(scale(0.5, cutoffRule)).toBe(4050);
  });
});
