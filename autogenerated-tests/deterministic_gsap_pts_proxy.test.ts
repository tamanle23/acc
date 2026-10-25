import { describe, it, expect } from 'bun:test';
import { DeterministicGsapPtsProxy, Pt } from '@acc/core-isomorphic';

describe('DeterministicGsapPtsProxy Test Suite', () => {
  it('creates paused timeline with lagSmoothing(0) and targets numeric proxy state', () => {
    const proxy = new DeterministicGsapPtsProxy(1337, 30);
    const tl = proxy.getTimeline();

    expect(tl.paused()).toBe(true);
    expect(proxy.getState().progress).toBe(0);

    // Animate proxy properties
    tl.to(proxy.getState() as any, {
      progress: 1.0,
      scale: 2.0,
      curlTension: 0.9,
      duration: 2.0, // 2.0s = 60 frames
      ease: 'linear',
    });

    // Seek to frame 30 (1.0s, half-way)
    proxy.seekFrame(30);
    expect(proxy.getState().progress).toBeCloseTo(0.5, 3);
    expect(proxy.getState().scale).toBeCloseTo(1.5, 3);
    expect(proxy.getState().curlTension).toBeCloseTo(0.7, 3);

    // Seek to frame 60 (2.0s, full-way)
    proxy.seekFrame(60);
    expect(proxy.getState().progress).toBeCloseTo(1.0, 3);
    expect(proxy.getState().scale).toBeCloseTo(2.0, 3);
    expect(proxy.getState().curlTension).toBeCloseTo(0.9, 3);
  });

  it('guarantees 100% bit-identical state across forward, backward, and random frame seeks', () => {
    const proxy = new DeterministicGsapPtsProxy(42, 30);
    const tl = proxy.getTimeline();

    tl.to(proxy.getState() as any, {
      progress: 1.0,
      morphRatio: 0.8,
      duration: 3.0,
      ease: 'power2.inOut',
    });

    // Pass 1: Forward sequential
    const pass1States: any[] = [];
    for (let f = 0; f <= 90; f += 15) {
      proxy.seekFrame(f);
      pass1States.push({ ...proxy.getState() });
    }

    // Pass 2: Jump around randomly, then check values
    proxy.seekFrame(75);
    proxy.seekFrame(15);
    proxy.seekFrame(90);
    proxy.seekFrame(0);

    const pass2States: any[] = [];
    for (let f = 0; f <= 90; f += 15) {
      proxy.seekFrame(f);
      pass2States.push({ ...proxy.getState() });
    }

    expect(pass1States).toEqual(pass2States);
  });

  it('evaluates curves and polygon morphing deterministically', () => {
    const proxy = new DeterministicGsapPtsProxy(100, 30);
    const tl = proxy.getTimeline();

    tl.to(proxy.getState() as any, {
      curlTension: 0.8,
      morphRatio: 0.5,
      duration: 1.0,
      ease: 'linear',
    });

    const pts = [new Pt(0, 0), new Pt(50, 100), new Pt(100, 0)];
    proxy.seekFrame(15); // Frame 15 = 0.5s -> curlTension = 0.65, morphRatio = 0.25

    const curve1 = proxy.evaluateCurve(pts);
    const curve2 = proxy.evaluateCurve(pts);
    expect(curve1.length).toBe(curve2.length);
    expect(curve1[0][0]).toBe(curve2[0][0]);

    // Polygon morphing
    const polyA = [new Pt(0, 0), new Pt(10, 0), new Pt(10, 10)];
    const polyB = [new Pt(0, 0), new Pt(20, 0), new Pt(20, 20)];
    const morphed = proxy.evaluatePolygon(polyA, polyB);
    expect(morphed.length).toBe(3);
    // At morphRatio 0.25: pt[1] = 10 + (20 - 10) * 0.25 = 12.5
    expect(morphed[1][0]).toBeCloseTo(12.5, 3);
  });

  it('morphs polygons of different vertex counts without truncation or pinch artifacts', () => {
    const proxy = new DeterministicGsapPtsProxy(200, 30);
    const tl = proxy.getTimeline();
    tl.to(proxy.getState() as any, {
      morphRatio: 1.0,
      duration: 1.0,
      ease: 'linear',
    });

    // 3 vertices vs 10 vertices
    const poly3 = [new Pt(0, 0), new Pt(50, 50), new Pt(100, 0)];
    const poly10 = Array.from({ length: 10 }, (_, i) => new Pt(i * 10, i * 5));

    proxy.seekFrame(15); // morphRatio = 0.5
    const morphed = proxy.evaluatePolygon(poly3, poly10);

    // Morphed polygon must preserve all 10 vertices without truncation
    expect(morphed.length).toBe(10);
    // At ratio 0.5, first point is (0, 0)
    expect(morphed[0][0]).toBe(0);
    expect(morphed[0][1]).toBe(0);
    // All coordinates must be finite numbers
    for (const pt of morphed) {
      expect(Number.isFinite(pt[0])).toBe(true);
      expect(Number.isFinite(pt[1])).toBe(true);
    }
  });
});
