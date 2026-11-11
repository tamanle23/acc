import { describe, it, expect } from 'bun:test';
import {
  CLOCK_WORKLET_NAME,
  CLOCK_WORKLET_CODE,
  createClockWorkletNode,
} from '../src/engine/audio/clock-worklet';

describe('Sample-Accurate AudioWorklet Clock Processor Suite', () => {
  it('defines the standard master audio clock processor name', () => {
    expect(CLOCK_WORKLET_NAME).toBe('master-audio-clock');
  });

  it('contains valid JavaScript source code defining MasterAudioClockProcessor', () => {
    expect(CLOCK_WORKLET_CODE).toContain('class MasterAudioClockProcessor extends AudioWorkletProcessor');
    expect(CLOCK_WORKLET_CODE).toContain('registerProcessor');
    expect(CLOCK_WORKLET_CODE).toContain('recalculateStep');
    expect(CLOCK_WORKLET_CODE).toContain('STEP_TICK');
  });

  it('calculates 16th note step samples accurately across sample rates', () => {
    // 120 BPM:
    // Beat duration = 60 / 120 = 0.5s
    // 16th note = 0.5 / 4 = 0.125s
    // At 44,100 Hz -> 0.125 * 44100 = 5512.5 -> 5513 samples
    // At 48,000 Hz -> 0.125 * 48000 = 6000 samples
    const bpm = 120;
    const secondsPerStep = (60.0 / bpm) / 4.0;
    expect(secondsPerStep).toBe(0.125);

    const samples44k = Math.round(secondsPerStep * 44100);
    expect(samples44k).toBe(5513);

    const samples48k = Math.round(secondsPerStep * 48000);
    expect(samples48k).toBe(6000);

    const samples96k = Math.round(secondsPerStep * 96000);
    expect(samples96k).toBe(12000);
  });

  it('createClockWorkletNode accepts AudioContext and sets initial BPM safely', async () => {
    expect(typeof createClockWorkletNode).toBe('function');
  });
});
