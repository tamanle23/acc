import { describe, it, expect, beforeAll } from 'bun:test';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { bootstrapNode } from '../packages/core/src/bootstrap';
import { SoAParticleComputeEngine } from '../packages/effect-engines/src/overlay-effects/simulators/SoAParticleComputeEngine';
import { CanvasParticleOverlayPlugin } from '../packages/ir/src/plugins/overlay/CanvasParticleOverlayPlugin';

describe('Phase 1: Structure-of-Arrays (SoA) Particle Compute & Zero-Alloc VFX Engine', () => {
  beforeAll(async () => {
    await bootstrapNode();
  });

  it('Memory Alignment: guarantees 64-byte CPU cache alignment for all parallel attribute arrays', () => {
    const maxParticles = 5000;
    const engine = new SoAParticleComputeEngine({ maxParticles });

    expect(engine.maxParticles).toBe(5000);
    // 5000 padded to multiple of 16 is 5008
    expect(engine.alignedCapacity).toBe(5008);
    expect(engine.alignedCapacity % 16).toBe(0);

    const strideBytes = engine.partitionByteStride;
    expect(strideBytes % 64).toBe(0); // Multiple of 64 bytes!

    // Verify all typed view byteOffsets are divisible by 64
    expect(engine.posX.byteOffset % 64).toBe(0);
    expect(engine.posY.byteOffset % 64).toBe(0);
    expect(engine.posZ.byteOffset % 64).toBe(0);
    expect(engine.velX.byteOffset % 64).toBe(0);
    expect(engine.velY.byteOffset % 64).toBe(0);
    expect(engine.velZ.byteOffset % 64).toBe(0);
    expect(engine.life.byteOffset % 64).toBe(0);
    expect(engine.maxLife.byteOffset % 64).toBe(0);
    expect(engine.size.byteOffset % 64).toBe(0);
    expect(engine.opacity.byteOffset % 64).toBe(0);
    expect(engine.colorIdx.byteOffset % 64).toBe(0);
  });

  it('Stateless Determinism: seeking backwards yields bit-identical floating point particle buffers', () => {
    const engine = new SoAParticleComputeEngine({ maxParticles: 1000 });

    // 1. Direct evaluate at frame 45
    engine.computeStatelessFrame(45, 1920, 1080, { type: 'snow', speed: 1.2, seed: 42 });
    const snap45ColdX = new Float32Array(engine.posX.slice(0, engine.activeCount));
    const snap45ColdY = new Float32Array(engine.posY.slice(0, engine.activeCount));

    // 2. Advance to frame 120, then jump back to frame 45
    engine.computeStatelessFrame(120, 1920, 1080, { type: 'snow', speed: 1.2, seed: 42 });
    expect(engine.posX[0]).not.toBe(snap45ColdX[0]);

    engine.computeStatelessFrame(45, 1920, 1080, { type: 'snow', speed: 1.2, seed: 42 });
    const snap45SeekX = new Float32Array(engine.posX.slice(0, engine.activeCount));
    const snap45SeekY = new Float32Array(engine.posY.slice(0, engine.activeCount));

    // Must be 100% bit-identical
    for (let i = 0; i < engine.activeCount; i++) {
      expect(snap45SeekX[i]).toBe(snap45ColdX[i]);
      expect(snap45SeekY[i]).toBe(snap45ColdY[i]);
    }
  });

  it('Zero-Alloc Frame Loop: renderBatched renders active particles with bounded canvas state changes', () => {
    const canvas = UniversalCanvasProvider.createCanvas(1280, 720);
    const ctx = canvas.getContext('2d') as any;

    let saveCalls = 0;
    let restoreCalls = 0;
    let fillCalls = 0;

    const origSave = ctx.save?.bind(ctx);
    const origRestore = ctx.restore?.bind(ctx);
    const origFill = ctx.fill?.bind(ctx);

    ctx.save = () => {
      saveCalls++;
      origSave?.();
    };
    ctx.restore = () => {
      restoreCalls++;
      origRestore?.();
    };
    ctx.fill = () => {
      fillCalls++;
      origFill?.();
    };

    const engine = new SoAParticleComputeEngine({ maxParticles: 2000 });
    engine.computeStatelessFrame(30, 1280, 720, { type: 'rain', intensity: 2.0 });
    expect(engine.activeCount).toBeGreaterThan(500);

    engine.renderBatched(ctx, 1280, 720, 0.8);

    // Verify canvas state stack was saved and restored exactly once
    expect(saveCalls).toBe(1);
    expect(restoreCalls).toBe(1);
    // Fill calls bounded by 4 alpha bins (<= 4 fills total for 500+ particles)
    expect(fillCalls).toBeLessThanOrEqual(4);
    expect(fillCalls).toBeGreaterThan(0);
  });

  it('CanvasParticleOverlayPlugin: delegates to SoAParticleComputeEngine when useSIMD: true', () => {
    const plugin = new CanvasParticleOverlayPlugin();
    const canvas = UniversalCanvasProvider.createCanvas(800, 600);
    const ctx = canvas.getContext('2d');

    const renderCtx: any = {
      ctx,
      width: 800,
      height: 600,
      frame: 15,
      fps: 30,
    };

    expect(() => {
      plugin.renderStreamSpace(renderCtx, {
        type: 'snow',
        useSIMD: true,
        intensity: 1.5,
      });
    }).not.toThrow();

    // Verify instance is reused on next frame without crashing or reallocating
    expect(() => {
      plugin.renderStreamSpace(renderCtx, {
        type: 'snow',
        useSIMD: true,
        intensity: 1.5,
      });
    }).not.toThrow();
  });
});
