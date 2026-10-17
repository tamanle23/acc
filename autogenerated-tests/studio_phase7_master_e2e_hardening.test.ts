import { describe, it, expect, beforeEach } from 'bun:test';
import { createHash } from 'crypto';
import { createCanvas } from '@napi-rs/canvas';
import {
  UniversalCanvasEngine,
  UniversalCanvasProvider,
  NodeCanvasAdapter,
  type CanvasInstance,
} from '../packages/effect-engines/src';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { MoveSequenceCommand } from '../apps/studio/src/lib/commands/MoveSequenceCommand';
import { TrimSequenceCommand } from '../apps/studio/src/lib/commands/TrimSequenceCommand';
import { complexSciFiDemoIR } from '../apps/studio/src/lib/ir/complexSciFiDemoIR';

describe('Phase 7: Master E2E Parity, Performance Benchmarking & Hardening Suite', () => {
  // --------------------------------------------------------------------------
  // PILLAR 1: Strict Bit-Identical Byte Hashing Parity
  // --------------------------------------------------------------------------
  describe('Pillar 1: Strict Bit-Identical Byte Hashing Parity', () => {
    const W = 640;
    const H = 360;
    const FRAMES_TO_TEST = [0, 15, 30, 45, 60];
    const FPS = 30;

    function renderDeterministicSceneRun(): { frameHashes: string[]; cumulativeHash: string } {
      const adapter = new NodeCanvasAdapter();
      const canvas = adapter.createCanvas(W, H);
      const ctx = canvas.getContext('2d') as any;

      const engine = new UniversalCanvasEngine({ width: W, height: H });

      // Deterministic particle swarm with fixed seed
      engine.initParticleSystem(100, 1337);

      // Deterministic holographic HUD
      engine.initHologramHUD(0.35, 32);

      // Deterministic Partial VFX
      engine.setPartialVFXRegions([
        { id: 'vfx-spot', type: 'spotlight', x: 0.5, y: 0.5, radius: 120, color: '#00d4ff', intensity: 1.2 },
        { id: 'vfx-glitch', type: 'glitch', x: 0.3, y: 0.4, width: 0.25, height: 0.15, intensity: 0.8 },
        { id: 'vfx-emitter', type: 'point_emitter', x: 0.6, y: 0.3, color: '#ec4899', intensity: 1.0 },
      ]);

      // GSAP Declarative Timeline
      engine.syncTimeline(
        [
          {
            id: 'seq-hero',
            time: { start: 0, duration: 90 },
            modifiers: [
              {
                type: 'transform',
                params: {
                  x: 30,
                  y: -10,
                  scale: 1.25,
                  rotation: 12,
                  animation: {
                    preset: 'drift',
                    intro: { durationSec: 0.5, ease: 'power2.out' },
                    steady: { type: 'drift' },
                    outro: { durationSec: 0.4, ease: 'power2.in' },
                  },
                },
              },
            ],
          },
        ],
        FPS
      );

      const frameHashes: string[] = [];
      const cumulativeHasher = createHash('sha256');

      for (const f of FRAMES_TO_TEST) {
        const timeSec = f / FPS;
        ctx.fillStyle = '#0a0f1d';
        ctx.fillRect(0, 0, W, H);

        // 1. Dual-pass Parallax Relighting
        engine.render2DParallax(ctx, W, H, timeSec, {
          x: 0.5,
          y: 0.5,
          diffuse: 1.2,
          specular: 1.5,
          color: '#38bdf8',
        });

        // 2. Core Visual Rendering
        engine.render(ctx, timeSec, 1.0);

        // Extract raw RGBA bytes
        const rawPixels = canvas.toBuffer('raw');
        const frameHash = createHash('sha256').update(rawPixels).digest('hex');
        frameHashes.push(frameHash);
        cumulativeHasher.update(rawPixels);
      }

      engine.dispose();
      return {
        frameHashes,
        cumulativeHash: cumulativeHasher.digest('hex'),
      };
    }

    it('should generate 100% bit-identical SHA-256 byte hashes across independent engine runs', () => {
      const run1 = renderDeterministicSceneRun();
      const run2 = renderDeterministicSceneRun();

      expect(run1.frameHashes.length).toBe(FRAMES_TO_TEST.length);
      expect(run2.frameHashes.length).toBe(FRAMES_TO_TEST.length);

      for (let i = 0; i < FRAMES_TO_TEST.length; i++) {
        expect(run1.frameHashes[i]).toBe(run2.frameHashes[i]);
      }

      expect(run1.cumulativeHash).toBe(run2.cumulativeHash);
    });

    it('should confirm temporal variance across distinct timeline frame seeks', () => {
      const run = renderDeterministicSceneRun();
      // Frame 0 vs Frame 30 must have distinct byte hashes due to motion & lighting changes
      expect(run.frameHashes[0]).not.toBe(run.frameHashes[2]);
    });
  });

  // --------------------------------------------------------------------------
  // PILLAR 2: High-Density 60fps Performance Benchmark
  // --------------------------------------------------------------------------
  describe('Pillar 2: High-Density 60fps Performance Benchmark', () => {
    const W = 1280;
    const H = 720;
    const TOTAL_BENCHMARK_FRAMES = 120; // 4 seconds at 30fps or 2 seconds at 60fps

    it('should sustain high-density scene rendering at < 12ms/frame average ceiling', () => {
      const adapter = new NodeCanvasAdapter();
      const canvas = adapter.createCanvas(W, H);
      const ctx = canvas.getContext('2d') as any;

      const engine = new UniversalCanvasEngine({ width: W, height: H });

      // High-density: 500 particles
      engine.initParticleSystem(500, 9999);

      // Procedural HUD
      engine.initHologramHUD(0.4, 48);

      // 5 VFX Regions
      engine.setPartialVFXRegions([
        { id: 'vfx-1', type: 'spotlight', x: 0.2, y: 0.3, radius: 180, color: '#00d4ff', intensity: 1.5 },
        { id: 'vfx-2', type: 'glitch', x: 0.7, y: 0.6, width: 0.3, height: 0.2, intensity: 1.2 },
        { id: 'vfx-3', type: 'blur', x: 0.5, y: 0.5, width: 0.4, height: 0.3 },
        { id: 'vfx-4', type: 'point_emitter', x: 0.3, y: 0.7, color: '#ec4899', intensity: 1.4 },
        { id: 'vfx-5', type: 'spotlight', x: 0.8, y: 0.2, radius: 150, color: '#38bdf8', intensity: 1.0 },
      ]);

      // 10 Layered Tracks/Sequences in GSAP Timeline
      const sequences = Array.from({ length: 10 }).map((_, i) => ({
        id: `seq-layer-${i}`,
        time: { start: i * 5, duration: 80 },
        modifiers: [
          {
            type: 'transform',
            params: {
              x: (i - 5) * 20,
              y: (i - 5) * 15,
              scale: 1.0 + (i % 3) * 0.1,
              rotation: (i - 5) * 4,
              animation: { preset: 'drift' },
            },
          },
        ],
      }));
      engine.syncTimeline(sequences, 30);

      const frameTimes: number[] = [];

      for (let f = 0; f < TOTAL_BENCHMARK_FRAMES; f++) {
        const timeSec = f / 30;
        const t0 = performance.now();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);
        engine.render2DParallax(ctx, W, H, timeSec);
        engine.render(ctx, timeSec, 1.0);

        const dt = performance.now() - t0;
        frameTimes.push(dt);
      }

      const totalMs = frameTimes.reduce((acc, v) => acc + v, 0);
      const avgMs = totalMs / frameTimes.length;
      frameTimes.sort((a, b) => a - b);
      const p95Ms = frameTimes[Math.floor(frameTimes.length * 0.95)];

      // Average must be strictly below 12.0ms (60fps is 16.6ms)
      expect(avgMs).toBeLessThan(12.0);
      expect(p95Ms).toBeLessThan(20.0);

      engine.dispose();
    });

    it('should maintain heap stability across 500 consecutive random seeks', () => {
      const engine = new UniversalCanvasEngine({ width: W, height: H });
      engine.initParticleSystem(200, 42);
      engine.initHologramHUD(0.3, 30);

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 500; i++) {
        const randomTime = (i * 7.13) % 60;
        engine.update(randomTime, 1.0);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const expansionMb = (finalMemory - initialMemory) / (1024 * 1024);

      // Memory expansion should not exceed 25MB after 500 seeks
      expect(expansionMb).toBeLessThan(25);
      engine.dispose();
    });
  });

  // --------------------------------------------------------------------------
  // PILLAR 3: Edge-Case Corruption & Defensive State Resilience
  // --------------------------------------------------------------------------
  describe('Pillar 3: Defensive State Hardening & Corruption Resilience', () => {
    let irManager: IRStateManager;

    beforeEach(async () => {
      irManager = IRStateManager.getInstance();
      await irManager.switchTemplate('scifi');
    });

    it('should gracefully handle malformed JSON syntax in loadFromJSON', () => {
      const corruptJson = '{"tracks": [ { invalid json syntax ...';
      const result = irManager.loadFromJSON(corruptJson);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(irManager.getState().error).toContain('JSON parse error');
    });

    it('should gracefully reject invalid VideoIR schema documents without throwing uncaught exceptions', () => {
      const invalidSchemaDoc = JSON.stringify({
        version: '1.0.0',
        metadata: { title: 'Corrupt IR' },
        // Missing required fields like fps, canvas, tracks
      });

      const result = irManager.loadFromJSON(invalidSchemaDoc);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(irManager.getState().error).toContain('Schema error');
    });

    it('should clamp negative and invalid frame bounds in timeline commands', () => {
      const initialDoc = irManager.getState().doc;
      const seqId = initialDoc.tracks[0].sequences[0].id;

      // Move with negative frame offset
      const moveCmd = new MoveSequenceCommand(seqId, initialDoc.tracks[0].id, -120);
      irManager.dispatch(moveCmd);

      const movedSeq = irManager.getState().doc.tracks[0].sequences.find((s) => s.id === seqId);
      expect(movedSeq?.time.start).toBeGreaterThanOrEqual(0);

      // Trim with large negative delta that would drop duration below 1
      const trimCmd = new TrimSequenceCommand(seqId, 0, -9999);
      irManager.dispatch(trimCmd);

      const trimmedSeq = irManager.getState().doc.tracks[0].sequences.find((s) => s.id === seqId);
      expect(trimmedSeq?.time.duration).toBeGreaterThanOrEqual(1);
    });

    it('should sanitize NaN and non-positive transform values in UniversalCanvasEngine', () => {
      const engine = new UniversalCanvasEngine({ width: 800, height: 600 });
      const badSequences = [
        {
          id: 'seq-corrupt-transform',
          time: { start: -10, duration: -50 },
          modifiers: [
            {
              type: 'transform',
              params: {
                x: NaN,
                y: NaN,
                scale: 0, // invalid scale
                rotation: NaN,
              },
            },
          ],
        },
      ];

      expect(() => {
        engine.syncTimeline(badSequences as any, 30);
      }).not.toThrow();

      const transform = engine.getActiveInterpolatedTransform('seq-corrupt-transform');
      expect(transform).toBeDefined();
      expect(Number.isFinite(transform?.x)).toBe(true);
      expect(Number.isFinite(transform?.y)).toBe(true);
      expect(transform!.scale).toBeGreaterThan(0);
      expect(Number.isFinite(transform?.rotation)).toBe(true);

      engine.dispose();
    });

    it('should preserve document consistency across 100 rapid undo/redo cycles', () => {
      const initialDoc = JSON.stringify(irManager.getState().doc);
      const targetSeqId = irManager.getState().doc.tracks[0].sequences[0].id;
      const targetTrackId = irManager.getState().doc.tracks[0].id;

      // Dispatch 5 sequential commands
      for (let i = 1; i <= 5; i++) {
        irManager.dispatch(new MoveSequenceCommand(targetSeqId, targetTrackId, i * 10));
      }

      // Rapidly alternate 100 undo/redo operations
      for (let cycle = 0; cycle < 100; cycle++) {
        if (irManager.canUndo()) {
          irManager.undo();
        }
        if (cycle % 2 === 0 && irManager.canRedo()) {
          irManager.redo();
        }
      }

      // Re-apply undo until initial state
      while (irManager.canUndo()) {
        irManager.undo();
      }

      const finalDoc = JSON.stringify(irManager.getState().doc);
      expect(finalDoc).toBe(initialDoc);
      expect(irManager.getState().error).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // PILLAR 4: Production Release Gate & Bundle Audit
  // --------------------------------------------------------------------------
  describe('Pillar 4: Production Release Gate & Bundle Audit', () => {
    it('should verify UniversalCanvasProvider default adapter is functional', () => {
      const adapter = UniversalCanvasProvider.getAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.isSupported()).toBe(true);

      const canvas = adapter.createCanvas(100, 100);
      expect(canvas.width).toBe(100);
      expect(canvas.height).toBe(100);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();
    });

    it('should verify complexSciFiDemoIR has valid schema structure and multiple tracks', () => {
      expect(complexSciFiDemoIR.tracks.length).toBeGreaterThanOrEqual(4);
      expect(complexSciFiDemoIR.meta.canvasSize.w).toBe(1920);
      expect(complexSciFiDemoIR.meta.canvasSize.h).toBe(1080);
      expect(complexSciFiDemoIR.meta.globalFps).toBe(30);
    });
  });
});
