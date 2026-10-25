import { describe, it, expect } from 'bun:test';
import type { PipelineIR, ContentChunk, VisualAsset } from '@acc/ir';
import { GenerativeStoryPipeline, defaultStoryPipeline } from '../apps/cli/src/pipelines/04-generative-story/GenerativeStoryPipeline';
import { FFmpegManager, AssetContext, Logger } from '@acc/core';

describe('Phase 0: Workspace Scaffolding & Canonical Contracts Suite', () => {
  // ==========================================
  // 1. PipelineIR & Data Contract Validation
  // ==========================================
  describe('@acc/ir Domain Contract Integrity', () => {
    it('constructs a valid PipelineIR complying with schema v3.0.0', () => {
      const visual: VisualAsset = {
        type: 'image',
        sourcePathOrBuffer: '/path/to/test.png',
        resolution: { width: 1920, height: 1080 },
        appliedEffects: [{ effectId: 'rain', variant: 'heavy', intensity: 0.8 }],
        depthMap: { depthMapPathOrBuffer: '/path/to/depth.png', minDepthMeters: 0.5, maxDepthMeters: 10.0 },
        subjectMask: { maskPathOrBuffer: '/path/to/mask.png', subjectClass: 'human', boundaryRect: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 } },
      };

      const chunk: ContentChunk = {
        id: 'chunk_test_01',
        order: 1,
        text: 'This is a test narration chunk.',
        summary: 'Test summary headline',
        durationMs: 4000,
        visualAsset: visual,
        metadata: { customScore: 99 },
      };

      const ir: PipelineIR = {
        schemaVersion: '3.0.0',
        pipelineId: 'generative-storytelling',
        metadata: {
          jobId: 'unit_job_001',
          title: 'Unit Test Story',
          createdAt: new Date().toISOString(),
          tags: ['test', 'scaffolding'],
        },
        chunks: [chunk],
        audioComposition: {
          sfxMarkers: [{ id: 'sfx_1', offsetMs: 500, durationMs: 1000, audioPath: '/sfx.mp3', volume: 0.7, category: 'cinematic' }],
          ducking: { enabled: true, attenuationDb: -18, attackMs: 100, releaseMs: 300 },
        },
        distributionHints: {
          supportedExporters: ['video', 'social'],
          targetAspectRatios: ['16:9'],
        },
      };

      expect(ir.schemaVersion).toBe('3.0.0');
      expect(ir.pipelineId).toBe('generative-storytelling');
      expect(ir.chunks.length).toBe(1);
      expect(ir.chunks[0].visualAsset?.appliedEffects?.[0].effectId).toBe('rain');
      expect(ir.audioComposition.ducking.attenuationDb).toBe(-18);
    });
  });

  // ==========================================
  // 2. @acc/cli GenerativeStoryPipeline Lifecycle
  // ==========================================
  describe('@acc/cli GenerativeStoryPipeline Scaffolding', () => {
    it('initializes GenerativeStoryPipeline singleton with correct identifier', () => {
      expect(['story', 'generative-storytelling']).toContain(defaultStoryPipeline.id);
    });

    it('can instantiate new pipeline instances with custom options', () => {
      const pipeline = new GenerativeStoryPipeline();
      expect(['story', 'generative-storytelling']).toContain(pipeline.id);
      expect(typeof pipeline.prepare).toBe('function');
      expect(typeof pipeline.execute).toBe('function');
    });
  });

  // ==========================================
  // 3. @acc/core Surface & Global Storage
  // ==========================================
  describe('@acc/core Primitives', () => {
    it('registers and retrieves asset variants with ordered fallback preference', () => {
      const ctx = new AssetContext();
      ctx.register('scene_1', 'original', '/assets/orig.png');
      ctx.register('scene_1', 'upscaled', '/assets/up.png');

      const preferred = ctx.getPreferred('scene_1', ['upscaled', 'original']);
      expect(preferred).toBe('/assets/up.png');

      const fallback = ctx.getPreferred('scene_1', ['depth_3d', 'original']);
      expect(fallback).toBe('/assets/orig.png');
    });

    it('exports structured logger with standard log levels', () => {
      expect(typeof Logger.info).toBe('function');
      expect(typeof Logger.warn).toBe('function');
      expect(typeof Logger.error).toBe('function');
    });
  });
});
