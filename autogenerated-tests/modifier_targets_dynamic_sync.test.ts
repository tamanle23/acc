import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  createIsolatedCoreModifierPlugins,
  VideoIRSchemaValidator,
  type VideoIRDocument,
  type ModifierTargetScope,
} from '@acc/ir';

describe('Iteration 55: Unified Modifier Target Model, Dynamic Registry Validation & 7-Package Sync', () => {
  let registry: ModifierPluginRegistry;

  beforeEach(() => {
    registry = createIsolatedCoreModifierPlugins();
  });

  // Test Vector 1: Single-Target Isolation
  it('should enforce strict single-target isolation for every registered plugin', () => {
    const validScopes: Set<ModifierTargetScope> = new Set(['standalone', 'sequence', 'track', 'timeline']);
    const plugins = registry.listPlugins();

    expect(plugins.length).toBeGreaterThanOrEqual(25);

    for (const plugin of plugins) {
      expect(validScopes.has(plugin.targetScope)).toBe(true);
      // Discard multi-target arrays or 'both'
      expect((plugin.targetScope as any) === 'both').toBe(false);
      expect(Array.isArray(plugin.targetScope)).toBe(false);
    }
  });

  // Test Vector 2: Dynamic Allowed Modifiers on 'overlay'
  it('should restrict available sequence modifiers on "overlay" strictly to transform, blend_mode, and transitions', () => {
    const availableOnOverlay = registry.getAvailableModifiersForTarget('sequence', 'overlay');
    const overlayTypes = availableOnOverlay.map((p) => p.type);

    expect(overlayTypes).toContain('transform');
    expect(overlayTypes).toContain('overlay/blend_mode');
    expect(overlayTypes).toContain('transition/crossfade');

    // Footage-centric modifiers must NEVER be permitted on standalone overlay sequences
    expect(overlayTypes).not.toContain('vfx/camera_3d');
    expect(overlayTypes).not.toContain('vfx/depth3d');
    expect(overlayTypes).not.toContain('vfx/depth_relighting');
    expect(overlayTypes).not.toContain('vfx/color_grading');
    expect(overlayTypes).not.toContain('vfx/auto_reframe');
    expect(overlayTypes).not.toContain('vfx/partial');
    expect(overlayTypes).not.toContain('audio/volume');
    expect(overlayTypes).not.toContain('motion/vector_blur');

    // Verify all returned plugins explicitly allow 'overlay' in their allowedSequenceTypes
    for (const p of availableOnOverlay) {
      expect(p.allowedSequenceTypes).toBeDefined();
      expect(p.allowedSequenceTypes!).toContain('overlay');
    }
  });

  // Test Vector 3: timed_text/style Rename & Schema Validation
  it('should approve "timed_text/style" on timed_text tracks and reject legacy "text/style"', () => {
    const validDoc: VideoIRDocument = {
      schemaVersion: '2.0.0',
      meta: {
        id: 'doc_valid_caption_sync',
        title: 'Valid Caption Test',
        durationSec: 5,
        globalFps: 30,
        resolution: { width: 1920, height: 1080 },
      },
      tracks: [
        {
          id: 'track_subtitles',
          type: 'timed_text',
          modifiers: [
            {
              type: 'timed_text/style',
              target: 'text',
              params: {
                fontSize: 32,
                fontFamily: 'Inter',
                color: '#ffffff',
                textAlign: 'center',
                activeWord: {
                  color: '#facc15',
                  glowColor: '#00d4ff',
                  scale: 1.2,
                },
              },
            },
          ],
          sequences: [
            {
              id: 'seq_sub_01',
              trackId: 'track_subtitles',
              type: 'text',
              time: { start: 0, duration: 90 },
              timedTextCues: [
                {
                  startOffsetMs: 0,
                  endOffsetMs: 3000,
                  text: 'Synchronized subtitle cue',
                },
              ],
            },
          ],
        },
      ],
    };

    const validResult = VideoIRSchemaValidator.validate(validDoc);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toEqual([]);

    // Document with deprecated 'text/style' must fail validation
    const legacyDoc = JSON.parse(JSON.stringify(validDoc)) as VideoIRDocument;
    legacyDoc.tracks[0].modifiers![0].type = 'text/style' as any;

    const legacyResult = VideoIRSchemaValidator.validate(legacyDoc);
    expect(legacyResult.valid).toBe(false);
    expect(legacyResult.errors.some((err) => err.includes('deprecated') || err.includes('text/style'))).toBe(true);
  });

  // Test Vector 4: Standalone Generator Resolution
  it('should query and instantiate standalone generators for the library without asset dependencies', () => {
    const libraryGenerators = registry.getGeneratorsForLibrary();
    const generatorTypes = libraryGenerators.map((p) => p.type);

    expect(generatorTypes).toContain('generator/solid_backdrop');
    expect(generatorTypes).toContain('time_space/cymatic_chladni');
    expect(generatorTypes).toContain('time_space/relativistic_blackhole');
    expect(generatorTypes).toContain('overlay/canvas_particles');
    expect(generatorTypes).toContain('shape/draw');
    expect(generatorTypes).toContain('sfx/procedural');

    // Standalone overlay sequence validation
    const docWithStandalone: VideoIRDocument = {
      schemaVersion: '2.0.0',
      meta: {
        id: 'doc_standalone_backdrop',
        title: 'Backdrop Generator Test',
        durationSec: 4,
        globalFps: 30,
        resolution: { width: 1920, height: 1080 },
      },
      tracks: [
        {
          id: 'track_backdrop',
          type: 'video',
          sequences: [
            {
              id: 'seq_backdrop_01',
              trackId: 'track_backdrop',
              type: 'overlay',
              time: { start: 0, duration: 120 },
              modifiers: [
                {
                  type: 'generator/solid_backdrop',
                  target: 'overlay',
                  params: {
                    colorA: '#0b0f19',
                    colorB: '#1e293b',
                    type: 'linear_gradient',
                    angleDeg: 90,
                  },
                },
                {
                  type: 'transform',
                  target: 'overlay',
                  params: { scale: 1.0 },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = VideoIRSchemaValidator.validate(docWithStandalone);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // Test Vector 5: Studio-Grade Expanded Plugins
  it('should instantiate and execute vector_blur, solid_backdrop, photometric_bloom, and anamorphic_glare without exceptions', () => {
    // 1. motion/vector_blur
    const vectorBlur = registry.get('motion/vector_blur');
    expect(vectorBlur).toBeDefined();
    expect(vectorBlur?.targetScope).toBe('sequence');
    expect(vectorBlur?.allowedSequenceTypes).toEqual(['video', 'image']);

    const mockCanvasCtx = {
      save: () => {},
      restore: () => {},
      filter: '',
    };
    expect(() => {
      vectorBlur?.renderClipSpace?.(
        {
          canvas: {},
          ctx: mockCanvasCtx,
          frame: 15,
          localFrame: 15,
          width: 1920,
          height: 1080,
          sequence: {} as any,
        },
        { shutterAngle: 180, samples: 8 }
      );
    }).not.toThrow();

    // 2. generator/solid_backdrop
    const solidBackdrop = registry.get('generator/solid_backdrop');
    expect(solidBackdrop).toBeDefined();
    expect(solidBackdrop?.targetScope).toBe('standalone');

    const mockFillCtx = {
      save: () => {},
      restore: () => {},
      fillStyle: '',
      fillRect: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
    };
    expect(() => {
      solidBackdrop?.renderClipSpace?.(
        {
          canvas: {},
          ctx: mockFillCtx,
          frame: 0,
          localFrame: 0,
          width: 1920,
          height: 1080,
          sequence: {} as any,
        },
        { colorA: '#000000', colorB: '#ffffff', type: 'linear_gradient' }
      );
    }).not.toThrow();

    // 3. timeline/photometric_bloom
    const bloom = registry.get('timeline/photometric_bloom');
    expect(bloom).toBeDefined();
    expect(bloom?.targetScope).toBe('timeline');
    expect(bloom?.targetPhase).toBe(4);

    const mockMasterCtx = {
      save: () => {},
      restore: () => {},
      globalCompositeOperation: '',
      globalAlpha: 1.0,
      filter: '',
      drawImage: () => {},
    };
    expect(() => {
      bloom?.renderMasterComposite?.(
        {
          canvas: {},
          ctx: mockMasterCtx,
          frame: 0,
          width: 1920,
          height: 1080,
          pixelBuffer: new Uint8Array(100),
        },
        { luminanceThreshold: 0.8, intensity: 1.2 }
      );
    }).not.toThrow();

    // 4. timeline/anamorphic_glare
    const glare = registry.get('timeline/anamorphic_glare');
    expect(glare).toBeDefined();
    expect(glare?.targetScope).toBe('timeline');
    expect(glare?.targetPhase).toBe(4);

    expect(() => {
      glare?.renderMasterComposite?.(
        {
          canvas: {},
          ctx: mockMasterCtx,
          frame: 0,
          width: 1920,
          height: 1080,
          pixelBuffer: new Uint8Array(100),
        },
        { threshold: 0.85, streakLengthPx: 120, intensity: 1.5 }
      );
    }).not.toThrow();
  });

  // Test Vector 6: Dynamic Entity Compatibility Checker
  it('should reject invalid modifier placement on inappropriate entity types', () => {
    // Cannot place camera 3d on overlay sequence
    const checkOverlayCamera = registry.isModifierAllowedOnEntity('vfx/camera_3d', {
      type: 'sequence',
      sequenceType: 'overlay',
    });
    expect(checkOverlayCamera.allowed).toBe(false);

    // Can place camera 3d on video sequence
    const checkVideoCamera = registry.isModifierAllowedOnEntity('vfx/camera_3d', {
      type: 'sequence',
      sequenceType: 'video',
    });
    expect(checkVideoCamera.allowed).toBe(true);

    // Cannot place timed_text/style on video track or timeline
    const checkTrackStyle = registry.isModifierAllowedOnEntity('timed_text/style', {
      type: 'timeline',
    });
    expect(checkTrackStyle.allowed).toBe(false);

    // Can place timed_text/style on track
    const checkTrackStyleOnTrack = registry.isModifierAllowedOnEntity('timed_text/style', {
      type: 'track',
    });
    expect(checkTrackStyleOnTrack.allowed).toBe(true);
  });
});
