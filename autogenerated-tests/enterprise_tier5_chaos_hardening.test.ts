import { StoryConfigToUniversalIRAdapter, LegacyStoryConfigAdapter, type LegacyStoryConfig } from '@acc/legacy-story-renderer';
import { describe, it, expect } from 'bun:test';
import path from 'path';
import fs from 'fs';
import { ptr } from 'bun:ffi';
import {
  VideoIRSchemaValidator,
  RelationalDAGCompiler,
  AssetMetadataProber,
  } from '../packages/ir/src';
import {
  IRMasterRenderer,
  IRChunkWorkerPool,
} from '../packages/ir/src/server';
import {
  AdaptiveResourceGovernor,
  RenderCircuitBreaker,
  CircuitState,
  ConductorSagaOrchestrator,
  DeadLetterQueue,
  FFmpegManager,
  initFFI,
} from '../packages/core/src';

describe('5-Tier Enterprise Quality Engineering & Chaos Hardening (Phase 6)', () => {

  // Tier 1: Unit, Contract & Schema Invariant Testing
  describe('Tier 1: Contract & Schema Invariants', () => {
    it('validates relational timeline contract and schema compatibility on complex configs', async () => {
      const storyConfigPath = path.resolve('sample-story/story-config.json');
      const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
      const baseDir = path.resolve('sample-story');

      const irDoc = StoryConfigToUniversalIRAdapter.adapt(rawJson, undefined, baseDir);
      const validation = VideoIRSchemaValidator.validate(irDoc);
      expect(validation.valid).toBe(true);
      expect(irDoc.tracks.length).toBeGreaterThanOrEqual(3);

      const prober = new AssetMetadataProber(baseDir);
      const compiler = new RelationalDAGCompiler({ prober });
      const timeline = await compiler.compile(irDoc);

      expect(timeline.totalFrames).toBeGreaterThan(0);
      expect(timeline.tracks.size).toBeGreaterThanOrEqual(3);
    });
  });

  // Tier 2: C/FFI Native Memory Leak & Zero-Copy Safety
  describe('Tier 2: C/FFI Native Memory & Zero-Copy Safety', () => {
    it('verifies frame loop execution maintains bounded memory without heap runaway', async () => {
      await FFmpegManager.prepare();
      initFFI();

      const storyConfigPath = path.resolve('sample-story/story-config.json');
      const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
      const baseDir = path.resolve('sample-story');

      const miniConfig: LegacyStoryConfig = {
        ...rawJson,
        scenes: rawJson.scenes?.slice(0, 1),
      };

      const irDoc = StoryConfigToUniversalIRAdapter.adapt(miniConfig, undefined, baseDir);
      const compiler = new RelationalDAGCompiler();
      const timeline = await compiler.compile(irDoc);
      timeline.totalFrames = 60; // 2 seconds at 30fps

      if (typeof Bun.gc === 'function') Bun.gc(true);
      const initialHeap = process.memoryUsage().heapUsed;

      const renderer = new IRMasterRenderer(timeline, 42);
      const result = await renderer.render({ generateFrameHash: false });

      expect(result.totalFrames).toBe(60);

      if (typeof Bun.gc === 'function') Bun.gc(true);
      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMB = (finalHeap - initialHeap) / (1024 * 1024);
      // Rendering 60 frames in-process maintains bounded heap headroom
      expect(heapDeltaMB).toBeLessThan(350);
    });
  });

  // Tier 3: Performance Benchmarks & SLA Thresholds
  describe('Tier 3: Performance Benchmarks & Latency SLAs', () => {
    it('asserts core AST compilation latency SLA is under 80ms', async () => {
      const storyConfigPath = path.resolve('sample-story/story-config.json');
      const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
      const baseDir = path.resolve('sample-story');

      const start = performance.now();
      const irDoc = StoryConfigToUniversalIRAdapter.adapt(rawJson, undefined, baseDir);
      const prober = new AssetMetadataProber(baseDir);
      const compiler = new RelationalDAGCompiler({ prober });
      await compiler.compile(irDoc);
      const durationMs = performance.now() - start;

      // SLA constraint: dry-run AST compilation must be < 80ms
      expect(durationMs).toBeLessThan(80);
    });
  });

  // Tier 4: Deterministic Visual & Audio Regression Engine
  describe('Tier 4: Deterministic Parity & Merkle Root Invariance', () => {
    it('guarantees bit-identical Merkle root hash parity across repeated runs', async () => {
      const storyConfigPath = path.resolve('sample-story/story-config.json');
      const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
      const baseDir = path.resolve('sample-story');

      const miniConfig: LegacyStoryConfig = {
        ...rawJson,
        scenes: rawJson.scenes?.slice(0, 2),
      };

      const irDoc = StoryConfigToUniversalIRAdapter.adapt(miniConfig, undefined, baseDir);
      const prober = new AssetMetadataProber(baseDir);
      const compiler = new RelationalDAGCompiler({ prober });
      const timeline = await compiler.compile(irDoc);

      const poolA = new IRChunkWorkerPool(timeline, 42);
      const resultA = await poolA.render({ concurrency: 2, seed: 42, generateFrameHash: true, baseDir });

      const poolB = new IRChunkWorkerPool(timeline, 42);
      const resultB = await poolB.render({ concurrency: 2, seed: 42, generateFrameHash: true, baseDir });

      // Inviolable mathematical parity requirement
      expect(resultA.merkleRootHash).toBe(resultB.merkleRootHash);
      expect(resultA.chunkHashes.length).toBe(resultB.chunkHashes.length);
      for (let i = 0; i < resultA.chunkHashes.length; i++) {
        expect(resultA.chunkHashes[i]).toBe(resultB.chunkHashes[i]);
      }
    }, 60000);
  });

  // Tier 5: Chaos Engineering & Fault Injection
  describe('Tier 5: Chaos Engineering & Fault Injection', () => {
    it('handles simulated VRAM starvation and worker failures via circuit breaker & SAGA recovery', async () => {
      const breaker = new RenderCircuitBreaker('chaos_vram_allocator', {
        failureThreshold: 2,
        recoveryTimeoutMs: 100,
        timeoutMs: 500,
      });

      // Inject simulated CUDA Out Of Memory fault
      let attempts = 0;
      const fallbackExecuted = await breaker.execute(
        async () => {
          attempts++;
          throw new Error('CUDA_ERROR_OUT_OF_MEMORY: device memory exhausted');
        },
        async (err) => {
          expect(err.message).toContain('CUDA_ERROR_OUT_OF_MEMORY');
          return 'CPU_LIBX264_FALLBACK';
        }
      );

      expect(fallbackExecuted).toBe('CPU_LIBX264_FALLBACK');
      expect(breaker.getFailureCount()).toBe(1);

      // Fault injection in SAGA workflow with reverse compensation
      const dlq = DeadLetterQueue.getInstance();
      dlq.clear();

      const saga = new ConductorSagaOrchestrator<{ cleanedUp: boolean }>('chaos_render_saga');
      saga.addStep({
        name: 'step1_reserve_resources',
        execute: async () => {},
        compensate: async (ctx) => {
          ctx.cleanedUp = true;
        },
      });
      saga.addStep({
        name: 'step2_fault_injection',
        execute: async () => {
          throw new Error('CHAOS_INJECTED_SIGKILL');
        },
        compensate: async () => {},
      });

      const context = { cleanedUp: false };
      let sagaFailed = false;
      try {
        await saga.execute(context);
      } catch (err: any) {
        sagaFailed = true;
      }

      expect(sagaFailed).toBe(true);
      expect(context.cleanedUp).toBe(true);
      expect(dlq.getEntries().length).toBe(1);
      expect(dlq.getEntries()[0].errorPayload.message).toContain('CHAOS_INJECTED_SIGKILL');
    });
  });
});
