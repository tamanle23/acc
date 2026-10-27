import { describe, it, expect, beforeEach } from 'bun:test';
import { createHash } from 'crypto';
import { createCanvas } from '@napi-rs/canvas';
import {
  UniversalCanvasProvider,
  type CanvasInstance,
} from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '@acc/core';
import { IRPreviewEngine } from '@acc/studio/renderer';
import { evaluateSequenceMotion } from '@acc/ir';
import type { ResolvedTimeline, ResolvedTrack } from '../packages/ir/src/types/VideoIR';
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

    function createDeterministicTestTimeline(): ResolvedTimeline {
      const track: ResolvedTrack = {
        id: 'track-v1',
        name: 'Video Track',
        type: 'visual',
        order: 1,
        modifiers: [
          {
            type: 'overlay/hologram_hud',
            params: { ringRadius: 0.35, scanlineDensity: 32, rotationSpeed: 0.5 },
          },
        ],
        sequences: [
          {
            id: 'seq-hero',
            name: 'Hero Sequence',
            type: 'video',
            startFrame: 0,
            durationFrames: 90,
            endFrame: 90,
            timelineStartFrame: 0,
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
              {
                type: 'vfx/partial',
                params: { type: 'spotlight', intensity: 1.2, radius: 120, color: '#00d4ff' },
              },
            ],
          },
        ],
      };

      const tracksMap = new Map<string, ResolvedTrack>();
      tracksMap.set(track.id, track);
      const seqMap = new Map();
      seqMap.set(track.sequences[0].id, track.sequences[0]);

      return {
        id: 'timeline-e2e-deterministic',
        totalFrames: 120,
        meta: {
          globalFps: FPS,
          canvasSize: { w: W, h: H },
        },
        tracks: tracksMap,
        sequences: seqMap,
        modifiers: [],
      };
    }

    function renderDeterministicSceneRun(): { frameHashes: string[]; cumulativeHash: string } {
      const adapter = new NapiCanvasAdapter();
      const canvas = adapter.createCanvas(W, H);
      const ctx = canvas.getContext('2d') as any;

      const timeline = createDeterministicTestTimeline();
      const engine = new IRPreviewEngine(timeline);

      const frameHashes: string[] = [];
      const cumulativeHasher = createHash('sha256');

      for (const f of FRAMES_TO_TEST) {
        ctx.fillStyle = '#0a0f1d';
        ctx.fillRect(0, 0, W, H);

        engine.renderFrame(f, ctx);

        // Extract raw RGBA bytes
        const rawPixels = canvas.toBuffer('raw');
        const frameHash = createHash('sha256').update(rawPixels).digest('hex');
        frameHashes.push(frameHash);
        cumulativeHasher.update(rawPixels);
      }

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
      const adapter = new NapiCanvasAdapter();
      const canvas = adapter.createCanvas(W, H);
      const ctx = canvas.getContext('2d') as any;

      // 10 Layered Tracks/Sequences in Video IR
      const tracksMap = new Map<string, ResolvedTrack>();
      const sequencesMap = new Map();

      for (let i = 0; i < 10; i++) {
        const seq = {
          id: `seq-layer-${i}`,
          name: `Layer ${i}`,
          type: 'video' as const,
          startFrame: i * 5,
          durationFrames: 80,
          endFrame: i * 5 + 80,
          timelineStartFrame: i * 5,
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
            {
              type: 'vfx/partial',
              params: { type: 'spotlight', intensity: 1.2, radius: 100, color: '#00d4ff' },
            },
          ],
        };
        const track: ResolvedTrack = {
          id: `track-${i}`,
          name: `Track ${i}`,
          type: 'visual',
          order: i,
          sequences: [seq],
        };
        tracksMap.set(track.id, track);
        sequencesMap.set(seq.id, seq);
      }

      const timeline: ResolvedTimeline = {
        id: 'timeline-benchmark-hd',
        totalFrames: 150,
        meta: {
          globalFps: 30,
          canvasSize: { w: W, h: H },
        },
        tracks: tracksMap,
        sequences: sequencesMap,
        modifiers: [
          {
            type: 'overlay/hologram_hud',
            params: { ringRadius: 0.4, scanlineDensity: 48 },
          },
        ],
      };

      const engine = new IRPreviewEngine(timeline);
      const frameTimes: number[] = [];

      for (let f = 0; f < TOTAL_BENCHMARK_FRAMES; f++) {
        const t0 = performance.now();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);
        engine.renderFrame(f, ctx);

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
    });

    it('should maintain heap stability across 500 consecutive random seeks', () => {
      const track: ResolvedTrack = {
        id: 'track-v1',
        name: 'V1',
        type: 'visual',
        order: 1,
        sequences: [
          {
            id: 'seq-1',
            name: 'Hero',
            type: 'video',
            startFrame: 0,
            durationFrames: 300,
            endFrame: 300,
            timelineStartFrame: 0,
            modifiers: [],
          },
        ],
      };

      const tracksMap = new Map();
      tracksMap.set(track.id, track);
      const seqMap = new Map();
      seqMap.set(track.sequences[0].id, track.sequences[0]);

      const timeline: ResolvedTimeline = {
        id: 'timeline-heap-test',
        totalFrames: 300,
        meta: {
          globalFps: 30,
          canvasSize: { w: W, h: H },
        },
        tracks: tracksMap,
        sequences: seqMap,
        modifiers: [
          {
            type: 'overlay/hologram_hud',
            params: { ringRadius: 0.3, scanlineDensity: 30 },
          },
        ],
      };

      const engine = new IRPreviewEngine(timeline);
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 500; i++) {
        const randomFrame = Math.floor((i * 7.13) % 300);
        engine.seek(randomFrame);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const expansionMb = (finalMemory - initialMemory) / (1024 * 1024);

      // Memory expansion should not exceed 25MB after 500 seeks
      expect(expansionMb).toBeLessThan(25);
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

    it('should sanitize NaN and non-positive transform values in IRPreviewEngine and evaluateSequenceMotion', () => {
      const badParams = {
        x: NaN,
        y: NaN,
        scale: 0, // invalid scale
        rotation: NaN,
      };

      const transform = evaluateSequenceMotion(badParams, 0.5, 2.0);
      expect(transform).toBeDefined();
      expect(Number.isFinite(transform.x)).toBe(true);
      expect(Number.isFinite(transform.y)).toBe(true);
      expect(transform.scale).toBeGreaterThan(0);
      expect(Number.isFinite(transform.rotation)).toBe(true);
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
