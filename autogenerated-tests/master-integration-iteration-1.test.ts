import { describe, it, expect } from 'bun:test';
import path from 'path';
import fs from 'fs';
import { createCanvas } from '@napi-rs/canvas';
import { resolvePipelineInput } from '@acc/cli';
import {
  Depth3DPlugin,
  CanvasParticleOverlayPlugin,
  VideoIRSchemaValidator,
  type VideoIRDocument,
  type ClipRenderContext,
  type StreamRenderContext,
} from '@acc/ir';
import { Depth3DFactory } from '@acc/effect-engines';
import { ContentStrategyRegistry, registerAllConductorCommands } from '@acc/core';

describe('Master Integration Plan (Iteration 1) End-to-End Suite', () => {
  const projectRoot = path.resolve(import.meta.dir, '..');

  describe('Step 1: CLI Directory Resolution across All 6 Pipeline Folders', () => {
    it('should resolve Pipeline 1 directory without EISDIR and load pipeline-ir.json', async () => {
      const dir = path.resolve(projectRoot, 'samples/01-scraper-summarizer');
      const input = await resolvePipelineInput('scraper', { configPath: dir });
      expect(input).toBeDefined();
      expect(input.pipelineId).toBe('scraper-summarizer');
      expect(Array.isArray(input.chunks)).toBe(true);
    });

    it('should resolve Pipeline 2 directory without EISDIR and load pipeline-ir.json', async () => {
      const dir = path.resolve(projectRoot, 'samples/02-db-templating');
      const input = await resolvePipelineInput('db', { configPath: dir });
      expect(input).toBeDefined();
      expect(input.pipelineId).toBe('db-templating');
    });

    it('should resolve Pipeline 3 directory without EISDIR and merge config', async () => {
      const dir = path.resolve(projectRoot, 'samples/03-repurposing-recycler');
      const input = await resolvePipelineInput('repurpose', { configPath: dir });
      expect(input).toBeDefined();
      expect(input.pipelineId).toBe('repurposing-recycler');
    });

    it('should resolve Pipeline 4 directory directly as path', async () => {
      const dir = path.resolve(projectRoot, 'samples/04-generative-storytelling');
      const input = await resolvePipelineInput('generative-storytelling', { configPath: dir });
      expect(input).toBe(dir);
    });

    it('should resolve Pipeline 5 directory without EISDIR and load pipeline-ir.json', async () => {
      const dir = path.resolve(projectRoot, 'samples/05-rule-logic');
      const input = await resolvePipelineInput('rule-logic', { configPath: dir });
      expect(input).toBeDefined();
      expect(input.pipelineId).toBe('rule-logic');
    });

    it('should resolve Pipeline 6 directory without EISDIR and load pipeline-ir.json', async () => {
      const dir = path.resolve(projectRoot, 'samples/06-ambient-loops');
      const input = await resolvePipelineInput('ambient', { configPath: dir });
      expect(input).toBeDefined();
      expect(input.pipelineId).toBe('ambient-loops');
    });
  });

  describe('Step 2: Depth3DPlugin Bridge with All 17 Depth3D Modes in Phase 2 Clip Space', () => {
    const plugin = new Depth3DPlugin();
    const modes = Depth3DFactory.listAvailableModes();

    it('should have all 17 distinct 3D depth modes registered', () => {
      expect(modes.length).toBeGreaterThanOrEqual(17);
      expect(modes).toContain('frame_breaker');
      expect(modes).toContain('isometric_podium');
      expect(modes).toContain('diffuse_shadow');
      expect(modes).toContain('macro_bokeh');
      expect(modes).toContain('tunneling_text');
    });

    it('should render clip space across all modes without throwing', () => {
      const canvas = createCanvas(320, 240);
      const ctx = canvas.getContext('2d');
      const dummyImg = createCanvas(100, 100);

      const renderCtx: ClipRenderContext = {
        canvas,
        ctx,
        frame: 5,
        localFrame: 5,
        width: 320,
        height: 240,
        sequence: {
          id: 'seq-1',
          trackId: 'track-v1',
          startFrame: 0,
          endFrame: 30,
          durationFrames: 30,
        },
        baseAsset: dummyImg as any,
      };

      for (const mode of modes) {
        expect(() => {
          plugin.renderClipSpace(renderCtx, { mode });
        }).not.toThrow();
      }
    });
  });

  describe('Step 3: CanvasParticleOverlayPlugin Procedural Extensions in Phase 3 Stream Space', () => {
    const plugin = new CanvasParticleOverlayPlugin();
    const overlayTypes = [
      'rain',
      'snow',
      'dust',
      'embers',
      'fire',
      'vhs',
      'digital_glitch',
      'bokeh',
      'sci_fi_hud',
    ];

    it('should render stream space for all extended procedural particle types without error', () => {
      const canvas = createCanvas(320, 240);
      const ctx = canvas.getContext('2d');

      const streamCtx: StreamRenderContext = {
        canvas,
        ctx,
        frame: 12,
        width: 320,
        height: 240,
        track: {
          id: 'trk-overlay',
          type: 'video',
          sequences: [],
        },
        activeSequences: [],
      };

      for (const type of overlayTypes) {
        expect(() => {
          plugin.renderStreamSpace(streamCtx, { type, intensity: 1.0 });
        }).not.toThrow();
      }
    });
  });

  describe('Step 4: VideoIR Serialization & Deserialization for Visual Video Editing', () => {
    const dummyDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'visual-editor-test-doc',
        globalFps: 30,
        canvasSize: { w: 1080, h: 1920 },
      },
      tracks: [
        {
          id: 'v1',
          type: 'video',
          sequences: [
            {
              id: 'seq-1',
              time: { start: 0, duration: 60 },
            },
          ],
        },
      ],
    };

    it('should serialize valid VideoIRDocument to JSON string', () => {
      const json = VideoIRSchemaValidator.serialize(dummyDoc);
      expect(typeof json).toBe('string');
      expect(json).toContain('visual-editor-test-doc');
    });

    it('should deserialize and validate JSON string back into VideoIRDocument', () => {
      const json = VideoIRSchemaValidator.serialize(dummyDoc);
      const restored = VideoIRSchemaValidator.deserialize(json);
      expect(restored.meta.contentId).toBe('visual-editor-test-doc');
      expect(restored.tracks.length).toBe(1);
    });

    it('should throw on deserializing invalid document schema', () => {
      expect(() => {
        VideoIRSchemaValidator.deserialize(JSON.stringify({ invalid: true }));
      }).toThrow();
    });
  });

  describe('Step 5: Conductor 250 Content Strategies Auto-Registration and Modality Alignment', () => {
    it('should register all 250 content strategies when registerAllConductorCommands is called', () => {
      registerAllConductorCommands();
      const count = ContentStrategyRegistry.count();
      expect(count).toBeGreaterThanOrEqual(250);

      const videoStrategies = ContentStrategyRegistry.getByModality('video');
      expect(videoStrategies.length).toBeGreaterThan(0);
    });
  });
});
