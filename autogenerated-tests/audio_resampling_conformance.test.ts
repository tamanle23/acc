import { describe, it, expect } from 'bun:test';
import { AudioConformanceEngine } from '../packages/ir/src/renderer/audio/AudioConformanceEngine';

describe('AudioConformanceEngine - Sinc Resampling', () => {
  it('computes zeroth-order modified Bessel function I0(u) accurately', () => {
    // I0(0) = 1.0
    expect(AudioConformanceEngine.besselI0(0)).toBe(1.0);
    // I0(1.0) ≈ 1.26606587775
    expect(AudioConformanceEngine.besselI0(1.0)).toBeCloseTo(1.266065877, 6);
    // I0(5.0) ≈ 27.2398718
    expect(AudioConformanceEngine.besselI0(5.0)).toBeCloseTo(27.2398718, 4);
  });

  it('resamples 44100 Hz to 48000 Hz with unity DC gain preservation', () => {
    // Constant DC signal of 1.0
    const sourceRate = 44100;
    const targetRate = 48000;
    const inputLength = 1000;
    const input = new Float32Array(inputLength).fill(1.0);

    const output = AudioConformanceEngine.resampleKaiserSinc(
      input,
      sourceRate,
      targetRate,
      16,
      5.0
    );

    const expectedLength = Math.round(inputLength * (targetRate / sourceRate));
    expect(output.length).toBe(expectedLength);

    // In the interior (away from boundary filter ramp-in/out), DC value must remain exactly 1.0
    for (let i = 50; i < output.length - 50; i++) {
      expect(output[i]).toBeCloseTo(1.0, 3);
    }
  });

  it('downsamples 96000 Hz to 48000 Hz with anti-aliasing cutoff scaling', () => {
    const sourceRate = 96000;
    const targetRate = 48000;
    const inputLength = 2000;
    const input = new Float32Array(inputLength).fill(0.75);

    const output = AudioConformanceEngine.resampleKaiserSinc(
      input,
      sourceRate,
      targetRate,
      16,
      5.0
    );

    const expectedLength = Math.round(inputLength * (targetRate / sourceRate));
    expect(output.length).toBe(expectedLength);

    for (let i = 50; i < output.length - 50; i++) {
      expect(output[i]).toBeCloseTo(0.75, 3);
    }
  });

  it('returns clone or original when sourceRate equals targetRate', () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    const output = AudioConformanceEngine.resampleKaiserSinc(input, 48000, 48000);
    expect(output.length).toBe(3);
    expect(output[0]).toBeCloseTo(0.1, 5);
    expect(output[1]).toBeCloseTo(0.2, 5);
    expect(output[2]).toBeCloseTo(0.3, 5);
  });

  it('resamples stereo channel pair synchronously', () => {
    const left = new Float32Array([1.0, 1.0, 1.0, 1.0]);
    const right = new Float32Array([0.5, 0.5, 0.5, 0.5]);

    const [outL, outR] = AudioConformanceEngine.resampleStereo(left, right, 22050, 44100);
    expect(outL.length).toBe(8);
    expect(outR.length).toBe(8);
  });
});
