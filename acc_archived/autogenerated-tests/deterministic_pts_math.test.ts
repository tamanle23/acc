import { describe, it, expect } from 'bun:test';
import {
  Pt,
  Group,
  Line,
  Curve,
  Polygon,
  Circle,
  Delaunay,
  Voronoi,
  StatelessHashNoise,
  DeterministicPtsForm,
  CanvasSpace,
  DOMSpace,
} from '@acc/core-isomorphic';

describe('Deterministic Pts Mathematical Engine Test Suite', () => {
  it('strictly forbids CanvasSpace and DOMSpace browser runtimes', () => {
    expect(() => new CanvasSpace()).toThrow(/CanvasSpace is strictly forbidden/);
    expect(() => new DOMSpace()).toThrow(/DOMSpace is strictly forbidden/);
  });

  it('StatelessHashNoise produces 100% bit-identical hash values across repeated runs', () => {
    const seed = 9999;
    const frame = 450;

    const run1 = Array.from({ length: 50 }, (_, i) => StatelessHashNoise.hash(seed, frame, i));
    const run2 = Array.from({ length: 50 }, (_, i) => StatelessHashNoise.hash(seed, frame, i));

    expect(run1).toEqual(run2);
    expect(run1.every((v) => v >= -1.0 && v <= 1.0)).toBe(true);
  });

  it('StatelessHashNoise is repeatable forward, backward, and in random access', () => {
    const seed = 1337;
    const valAt100 = StatelessHashNoise.hash(seed, 100, 5);
    const valAt200 = StatelessHashNoise.hash(seed, 200, 5);

    // Jump to 500, then jump back to 100
    StatelessHashNoise.hash(seed, 500, 5);
    const valAt100Again = StatelessHashNoise.hash(seed, 100, 5);
    expect(valAt100Again).toBe(valAt100);

    // Coherent noise 2D
    const n1 = StatelessHashNoise.noise2D(seed, 100, 1.5, 2.5);
    const n2 = StatelessHashNoise.noise2D(seed, 100, 1.5, 2.5);
    expect(n1).toBe(n2);

    // Curl noise 2D
    const curl = StatelessHashNoise.curlNoise2D(seed, 100, 1.0, 1.0);
    expect(typeof curl.x).toBe('number');
    expect(typeof curl.y).toBe('number');
  });

  it('evaluates pure geometry and produces identical vertex buffers', () => {
    const pts = [new Pt(0, 0), new Pt(100, 0), new Pt(50, 100), new Pt(80, 80)];
    const d = Delaunay.from(pts);
    const triangles = d.delaunay();
    expect(triangles.length).toBeGreaterThan(0);

    const voronoiCells = Voronoi.from(pts);
    expect(voronoiCells.length).toBeGreaterThan(0);

    // Vertex buffer generation
    const buffer = DeterministicPtsForm.toBuffer(pts);
    expect(buffer.length).toBe(8); // 4 points * 2 (x, y)
    expect(buffer[0]).toBe(0);
    expect(buffer[1]).toBe(0);
    expect(buffer[2]).toBe(100);
    expect(buffer[3]).toBe(0);
    expect(buffer[4]).toBe(50);
    expect(buffer[5]).toBe(100);
  });
});
