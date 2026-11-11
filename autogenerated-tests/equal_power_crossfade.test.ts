import { describe, it, expect } from 'bun:test';
import {
  calculateCrossfadeAlpha,
  TransitionCrossfadePlugin,
} from '../packages/ir/src/plugins/editorial/TransitionCrossfadePlugin';

describe('Phase 2: Equal-Power & Linear Crossfade Mathematical Parity', () => {
  it('Linear Crossfade: alphaIn + alphaOut === 1.0 at all progress steps', () => {
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const { alphaIn, alphaOut } = calculateCrossfadeAlpha(p, 'linear');
      expect(alphaIn).toBeCloseTo(p, 5);
      expect(alphaOut).toBeCloseTo(1 - p, 5);
      expect(alphaIn + alphaOut).toBeCloseTo(1.0, 5);
    }
  });

  it('Equal-Power Crossfade: sin^2 + cos^2 === 1.0 at all progress steps (Constant Acoustic Power)', () => {
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const { alphaIn, alphaOut } = calculateCrossfadeAlpha(p, 'equal_power');

      // Acoustic / Additive Power summation
      const totalPower = alphaIn * alphaIn + alphaOut * alphaOut;
      expect(totalPower).toBeCloseTo(1.0, 5);
    }

    // Midpoint check at t = 0.5: alpha = sin(pi/4) = sqrt(2)/2 ~= 0.7071
    const mid = calculateCrossfadeAlpha(0.5, 'equal_power');
    expect(mid.alphaIn).toBeCloseTo(Math.SQRT1_2, 5);
    expect(mid.alphaOut).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it('TransitionCrossfadePlugin: evaluates linear and equal-power modes in Clip Space', () => {
    const plugin = new TransitionCrossfadePlugin();

    const canvasCtxLinear: any = { globalAlpha: 1.0 };
    plugin.renderClipSpace(
      { ctx: canvasCtxLinear, localFrame: 5 } as any,
      { durationFrames: 10, mode: 'linear' }
    );
    expect(canvasCtxLinear.globalAlpha).toBeCloseTo(0.5, 4);

    const canvasCtxEqualPower: any = { globalAlpha: 1.0 };
    plugin.renderClipSpace(
      { ctx: canvasCtxEqualPower, localFrame: 5 } as any,
      { durationFrames: 10, mode: 'equal_power' }
    );
    expect(canvasCtxEqualPower.globalAlpha).toBeCloseTo(Math.SQRT1_2, 4);
  });
});
