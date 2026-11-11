import { describe, it, expect } from 'bun:test';
import { AudioConformanceEngine } from '../packages/ir/src/renderer/audio/AudioConformanceEngine';

describe('AudioConformanceEngine - Channel Conformance', () => {
  it('conforms mono to stereo using -3dB constant power pan law', () => {
    const mono = new Float32Array([1.0, 0.5, -0.5, 0.0]);
    const [left, right] = AudioConformanceEngine.conformChannels([mono]);

    expect(left.length).toBe(4);
    expect(right.length).toBe(4);

    const coeff = 0.7071067811865476;
    expect(left[0]).toBeCloseTo(coeff, 6);
    expect(right[0]).toBeCloseTo(coeff, 6);
    expect(left[1]).toBeCloseTo(0.5 * coeff, 6);
    expect(right[1]).toBeCloseTo(0.5 * coeff, 6);

    // Verify acoustic power conservation: L^2 + R^2 = M^2
    const powerOut = left[0] * left[0] + right[0] * right[0];
    const powerIn = mono[0] * mono[0];
    expect(powerOut).toBeCloseTo(powerIn, 6);
  });

  it('conforms 5.1 surround to stereo adhering to ITU-R BS.775-1 matrix', () => {
    // 5.1 ordering: [L, R, C, LFE, Ls, Rs]
    const lf = new Float32Array([0.5]);
    const rf = new Float32Array([0.4]);
    const c = new Float32Array([0.6]);
    const lfe = new Float32Array([1.0]); // should be excluded by default
    const ls = new Float32Array([0.3]);
    const rs = new Float32Array([0.2]);

    const [left, right] = AudioConformanceEngine.conformChannels([lf, rf, c, lfe, ls, rs]);

    const coeff = 0.7071067811865476;
    // Expected L = Lf + coeff * (C + Ls) = 0.5 + coeff * (0.6 + 0.3) = 0.5 + 0.9 * coeff
    const expectedL = 0.5 + coeff * (0.6 + 0.3);
    // Expected R = Rf + coeff * (C + Rs) = 0.4 + coeff * (0.6 + 0.2) = 0.4 + 0.8 * coeff
    const expectedR = 0.4 + coeff * (0.6 + 0.2);

    expect(left[0]).toBeCloseTo(expectedL, 5);
    expect(right[0]).toBeCloseTo(expectedR, 5);
  });

  it('passes standard stereo through cleanly without alteration', () => {
    const leftIn = new Float32Array([0.1, 0.2, 0.3]);
    const rightIn = new Float32Array([0.4, 0.5, 0.6]);

    const [leftOut, rightOut] = AudioConformanceEngine.conformChannels([leftIn, rightIn]);
    expect(leftOut).toBe(leftIn);
    expect(rightOut).toBe(rightIn);
  });

  it('gracefully handles empty or null channel arrays', () => {
    const [left, right] = AudioConformanceEngine.conformChannels([]);
    expect(left.length).toBe(0);
    expect(right.length).toBe(0);
  });
});
