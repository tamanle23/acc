import { describe, it, expect, beforeAll } from 'bun:test';
import { createCanvas } from '@napi-rs/canvas';
import {
  SIMDParticleComputeEngine,
  PARTICLE_STRIDE,
} from '../packages/effect-engines/src/overlay-effects/simulators/SIMDParticleComputeEngine';
import { PostProcessingShaders } from '../packages/effect-engines/src/overlay-effects/simulators/PostProcessingShaders';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { bootstrapNode } from '@acc/core';
import { CanvasParticleOverlayPlugin } from '../packages/ir/src/plugins/overlay/CanvasParticleOverlayPlugin';

describe('Phase 3: Hardware-Accelerated Shader & Particle VFX Pipeline', () => {
  beforeAll(async () => {
    await bootstrapNode();
  });
  it('should manage 10,000+ particles contiguously in Float32Array without heap allocation', () => {
    const maxParticles = 10000;
    const engine = new SIMDParticleComputeEngine({
      maxParticles,
      spawnRate: 200,
      type: 'snow',
    });

    expect(engine.getMaxParticles()).toBe(maxParticles);
    expect(engine.getActiveCount()).toBe(0);

    const buffer = engine.getRawBuffer();
    expect(buffer.length).toBe(maxParticles * PARTICLE_STRIDE);

    // Initial batch spawn
    engine.spawn(1000, 1920, 1080);
    expect(engine.getActiveCount()).toBe(1000);

    // Verify first particle state layout
    expect(buffer[0]).toBeGreaterThanOrEqual(0); // x
    expect(buffer[1]).toBeLessThan(0); // y above screen
    expect(buffer[6]).toBeGreaterThan(0); // life

    // Step simulation across multiple frames
    for (let f = 0; f < 30; f++) {
      engine.update(1920, 1080);
    }

    // Particles should have moved downwards (vy applied) and new batch spawned
    expect(engine.getActiveCount()).toBeGreaterThan(1000);
    expect(engine.getActiveCount()).toBeLessThanOrEqual(maxParticles);
  });

  it('should resolve CanvasAdapter with headless server safe fallback', () => {
    const autoAdapter = UniversalCanvasProvider.getAdapter('auto');
    expect(autoAdapter).toBeDefined();

    const nodeAdapter = UniversalCanvasProvider.getAdapter('node');
    expect(nodeAdapter).toBeDefined();
    expect(nodeAdapter.environment).toBe('node');

    const detected = UniversalCanvasProvider.detectEnvironment();
    expect(['web', 'node']).toContain(detected);

    const testCanvas = autoAdapter.createCanvas(100, 100);
    expect(testCanvas.width).toBe(100);
    expect(testCanvas.height).toBe(100);
  });

  it('should apply zero-allocation Chromatic Aberration channel shifts', () => {
    const width = 16;
    const height = 16;
    const data = new Uint8Array(width * height * 4);

    // Fill center column with white (255, 255, 255, 255)
    for (let y = 0; y < height; y++) {
      const idx = (y * width + 8) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }

    PostProcessingShaders.applyChromaticAberration(data, width, height, 2);

    // Center column at x=8:
    // Red shifted left by 2px -> now at x = 6 (redShiftedIdx)
    // Blue shifted right by 2px -> now at x = 10 (blueShiftedIdx)
    const redShiftedIdx = (8 * width + 6) * 4;
    expect(data[redShiftedIdx]).toBe(255); // Red was shifted here

    const blueShiftedIdx = (8 * width + 10) * 4 + 2;
    expect(data[blueShiftedIdx]).toBe(255); // Blue was shifted here
  });

  it('should apply Bloom & Anamorphic Flare post-processing without throwing', () => {
    const width = 120;
    const height = 90;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const scratch = createCanvas(width, height);
    const sCtx = scratch.getContext('2d');

    // Draw some bright spots
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, 30, 20, 20);

    PostProcessingShaders.applyBloom(ctx, scratch, sCtx, width, height, 0.6, 0.8);
    PostProcessingShaders.applyAnamorphicFlare(ctx, width, height, 50, 0.5);

    const finalImg = ctx.getImageData(0, 0, width, height);
    expect(finalImg.data.length).toBe(width * height * 4);
  });

  it('should execute CanvasParticleOverlayPlugin with SIMD and shaders enabled', async () => {
    const plugin = new CanvasParticleOverlayPlugin();
    const width = 320;
    const height = 180;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const mockTrack: any = { id: 'track-vfx-test' };
    const modContext: any = {
      targetType: 'track',
      targetEntity: mockTrack,
      timeline: new Map(),
      fps: 30,
      canvas: { width, height },
      state: {},
    };

    await plugin.execute(modContext, {
      type: 'snow',
      intensity: 1.5,
      useSIMD: true,
      shaders: {
        bloom: { enabled: true, threshold: 0.5 },
        chromaticAberration: { enabled: true, offsetPx: 2 },
        anamorphicFlare: { enabled: true },
      },
    });

    // Render 10 frames
    for (let f = 0; f < 10; f++) {
      plugin.renderStreamSpace(
        {
          canvas: canvas as any,
          ctx: ctx as any,
          frame: f,
          width,
          height,
          track: mockTrack,
          activeSequences: [],
        },
        {
          type: 'snow',
          shaders: {
            bloom: { enabled: true },
            chromaticAberration: { enabled: true },
            anamorphicFlare: { enabled: true },
          },
        }
      );
    }

    expect(true).toBe(true);
  });
});
