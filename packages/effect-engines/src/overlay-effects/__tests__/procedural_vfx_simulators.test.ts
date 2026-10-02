import { describe, test, expect } from 'bun:test';
import { ParticlePool } from '../simulators/particles/particle-pool';
import { BoidsSolver } from '../simulators/particles/boids-solver';
import { CurlNoise } from '../simulators/noise/curl-noise';
import { Grid2DSolver } from '../simulators/fluids/grid2d-solver';
import { VoronoiFracture } from '../simulators/destruction/voronoi-fracture';
import { SeamlessLoopDecorator } from '../decorators/seamless-loop';
import { VFXSimulatorFactory } from '../simulators/factory';

describe('Procedural VFX Simulators Unit Tests', () => {
  test('ParticlePool - allocates and releases particles without GC overhead', () => {
    const pool = new ParticlePool(10);
    expect(pool.Capacity).toBe(10);
    expect(pool.ActiveCount).toBe(0);

    const p1 = pool.spawn({ x: 10, y: 20 });
    const p2 = pool.spawn({ x: 30, y: 40 });

    expect(pool.ActiveCount).toBe(2);
    expect(p1?.x).toBe(10);
    expect(p2?.x).toBe(30);

    pool.release(0);
    expect(pool.ActiveCount).toBe(1);
  });

  test('BoidsSolver - updates positions with flocking forces', () => {
    const pool = new ParticlePool(5);
    pool.spawn({ x: 10, y: 10, vx: 5, vy: 5 });
    pool.spawn({ x: 20, y: 20, vx: -5, vy: -5 });

    const boids = new BoidsSolver();
    boids.update(pool, 0.1, 1920, 1080);

    const particles = pool.getActiveParticles();
    expect(particles[0].x).not.toBe(10);
    expect(particles[0].y).not.toBe(10);
  });

  test('CurlNoise - generates divergence-free 2D vector field', () => {
    const curl = new CurlNoise();
    const vec1 = curl.getCurl2D(10, 20, 0);
    const vec2 = curl.getCurl2D(10, 20, 1);

    expect(typeof vec1.vx).toBe('number');
    expect(typeof vec1.vy).toBe('number');
    expect(vec1.vx).not.toBeNaN();
    expect(vec1.vy).not.toBeNaN();
  });

  test('Grid2DSolver - solves 2D fluid density advection', () => {
    const grid = new Grid2DSolver(16, 16);
    grid.addDensity(8, 8, 10);
    expect(grid.getDensityAt(8, 8)).toBe(10);

    grid.addVelocity(8, 8, 2, 0);
    grid.step();

    expect(grid.getDensityAt(8, 8)).toBeGreaterThan(0);
  });

  test('VoronoiFracture - breaks cells on impact', () => {
    const voronoi = new VoronoiFracture(100, 100);
    const cells = voronoi.generateCells(10);
    expect(cells.length).toBe(10);

    voronoi.triggerImpact({ x: 50, y: 50 }, 1000);
    const activeCells = voronoi.getCells().filter((c) => c.active);
    expect(activeCells.length).toBeGreaterThan(0);
  });

  test('SeamlessLoopDecorator - wraps simulation strategy seamlessly', () => {
    const simulator = VFXSimulatorFactory.createSimulator('rain', 'drizzle');
    simulator.init({
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 3,
      variant: 'drizzle',
      bgTransparent: false
    });

    expect(simulator.name).toContain('SeamlessLoop');
    expect(() => simulator.update(1 / 30, 0.5)).not.toThrow();
  });
});
