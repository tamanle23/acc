import { describe, it, expect } from 'bun:test';
import { RationalTime } from '../packages/core-isomorphic/src/math/time/RationalTime';

describe('RationalTime Precision & Arithmetic Suite', () => {
  it('initializes with default 10MHz timescale and exact BigInt representation', () => {
    const t = new RationalTime(10_000_000n);
    expect(t.value).toBe(10_000_000n);
    expect(t.timescale).toBe(10_000_000);
    expect(t.toSeconds()).toBe(1.0);
  });

  it('converts between frames and seconds without precision accumulation drift', () => {
    // 24 fps film
    const t24 = RationalTime.fromFrame(48, 24);
    expect(t24.toSeconds()).toBe(2.0);
    expect(t24.toFrame(24)).toBe(48);

    // 29.97 fps NTSC
    const t2997 = RationalTime.fromFrame(300, 29.97);
    expect(t2997.toFrame(29.97)).toBe(300);

    // 60 fps
    const t60 = RationalTime.fromFrame(3600, 60);
    expect(t60.toSeconds()).toBe(60.0);
    expect(t60.toFrame(60)).toBe(3600);

    // 120 fps high-speed gaming / preview
    const t120 = RationalTime.fromFrame(1200, 120);
    expect(t120.toSeconds()).toBe(10.0);
    expect(t120.toFrame(120)).toBe(1200);
  });

  it('performs exact addition and subtraction across identical and distinct timescales', () => {
    const a = RationalTime.fromSeconds(1.5);
    const b = RationalTime.fromSeconds(2.25);
    const sum = a.add(b);
    expect(sum.toSeconds()).toBe(3.75);

    const diff = sum.sub(a);
    expect(diff.toSeconds()).toBe(2.25);

    // Different timescales
    const t1 = new RationalTime(48000n, 48000); // 1.0 sec @ 48kHz
    const t2 = new RationalTime(30n, 30); // 1.0 sec @ 30fps
    const combined = t1.add(t2);
    expect(combined.toSeconds()).toBe(2.0);
  });

  it('supports exact scalar multiplication and division', () => {
    const t = RationalTime.fromSeconds(2.0);
    const scaled = t.mul(1.5);
    expect(scaled.toSeconds()).toBe(3.0);

    const halved = scaled.div(2.0);
    expect(halved.toSeconds()).toBe(1.5);
  });

  it('supports exact comparison and equality checks', () => {
    const a = RationalTime.fromFrame(30, 30);
    const b = RationalTime.fromSeconds(1.0);
    expect(a.equals(b)).toBe(true);
    expect(a.compare(b)).toBe(0);

    const earlier = RationalTime.fromFrame(29, 30);
    expect(earlier.compare(a)).toBe(-1);
    expect(a.compare(earlier)).toBe(1);
  });

  it('throws on non-positive timescale or division by zero', () => {
    expect(() => new RationalTime(100n, 0)).toThrow();
    expect(() => new RationalTime(100n, -1)).toThrow();
    const t = RationalTime.fromSeconds(1);
    expect(() => t.div(0)).toThrow();
  });
});
