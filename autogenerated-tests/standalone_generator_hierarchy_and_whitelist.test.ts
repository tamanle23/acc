import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ModifierPluginRegistry,
  createIsolatedCoreModifierPlugins,
  VideoIRSchemaValidator,
  type VideoIRDocument,
  type IRSequence,
} from '@acc/ir';
import { migrateLegacyModifiers } from '../apps/studio/src/lib/ir/irState';

describe('Iteration 59: Standalone Generator Hierarchy, Single-Source Invariant & Universal Whitelist', () => {
  let registry: ModifierPluginRegistry;

  beforeEach(() => {
    registry = createIsolatedCoreModifierPlugins();
  });

  // Test Vector 1: Single Standalone Generator Invariant
  it('should reject a sequence with multiple standalone generators in VideoIRSchemaValidator', () => {
    const invalidDoc: VideoIRDocument = {
      schemaVersion: '2.0.0',
      meta: {
        id: 'doc_invalid_multiple_generators',
        title: 'Multiple Generators Test',
        durationSec: 5,
        globalFps: 30,
        resolution: { width: 1920, height: 1080 },
      },
      tracks: [
        {
          id: 'track_v1',
          type: 'video',
          sequences: [
            {
              id: 'seq_competing_generators',
              type: 'overlay',
              time: { start: 0, duration: 90 },
              modifiers: [
                {
                  id: 'mod_hud',
                  type: 'overlay/hologram_hud',
                  target: 'overlay',
                  params: { ringRadius: 0.35 },
                },
                {
                  id: 'mod_particles',
                  type: 'overlay/canvas_particles',
                  target: 'overlay',
                  params: { preset: 'cyber_sparks' },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = VideoIRSchemaValidator.validate(invalidDoc as any);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (err) =>
          err.includes('contains 2 standalone generators') ||
          err.includes('cannot host multiple standalone generators')
      )
    ).toBe(true);
  });

  // Test Vector 2: Rejection of Footage VFX on Standalone Sequences
  it('should reject footage-centric modifiers (camera_3d, depth3d, partial, color_grading) on standalone sequences', () => {
    const invalidDoc: VideoIRDocument = {
      schemaVersion: '2.0.0',
      meta: {
        id: 'doc_invalid_footage_on_standalone',
        title: 'Footage on Standalone Test',
        durationSec: 5,
        globalFps: 30,
        resolution: { width: 1920, height: 1080 },
      },
      tracks: [
        {
          id: 'track_v1',
          type: 'video',
          sequences: [
            {
              id: 'seq_generator_with_camera3d',
              type: 'overlay',
              time: { start: 0, duration: 90 },
              modifiers: [
                {
                  id: 'mod_hud',
                  type: 'overlay/hologram_hud',
                  target: 'overlay',
                  params: { ringRadius: 0.35 },
                },
                {
                  id: 'mod_camera',
                  type: 'vfx/camera_3d',
                  target: 'overlay',
                  params: { depthMultiplier: 1.5 },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = VideoIRSchemaValidator.validate(invalidDoc as any);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (err) =>
          err.includes('cannot be applied to a standalone generator sequence') ||
          err.includes('does not permit sequence type "overlay"')
      )
    ).toBe(true);
  });

  // Test Vector 3: Clean Acceptance of Universal Canvas Modifiers on Standalone Sequences
  it('should cleanly accept transform, motion/gsap, and overlay/blend_mode on standalone generator sequences', () => {
    const validDoc: VideoIRDocument = {
      schemaVersion: '2.0.0',
      meta: {
        id: 'doc_valid_standalone_with_transform',
        title: 'Valid Standalone Transform Test',
        durationSec: 5,
        globalFps: 30,
        resolution: { width: 1920, height: 1080 },
      },
      tracks: [
        {
          id: 'track_v1',
          type: 'video',
          sequences: [
            {
              id: 'seq_generator_with_universal',
              type: 'overlay',
              time: { start: 0, duration: 90 },
              modifiers: [
                {
                  id: 'mod_hud',
                  type: 'overlay/hologram_hud',
                  target: 'overlay',
                  params: { ringRadius: 0.35 },
                },
                {
                  id: 'mod_transform',
                  type: 'transform',
                  target: 'overlay',
                  params: { x: 120, y: -40, scale: 1.25, rotation: 15, opacity: 0.9 },
                },
                {
                  id: 'mod_blend',
                  type: 'overlay/blend_mode',
                  target: 'overlay',
                  params: { mode: 'screen', opacity: 1.0 },
                },
                {
                  id: 'mod_trans',
                  type: 'transition/crossfade',
                  target: 'overlay',
                  params: { durationFrames: 15 },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = VideoIRSchemaValidator.validate(validDoc as any);
    if (!result.valid) {
      console.error('Validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // Test Vector 4: Registry Entity Checking with hasStandaloneGenerator
  it('should dynamically enforce standalone boundaries in isModifierAllowedOnEntity', () => {
    // 1. Transform is allowed when hasStandaloneGenerator = true
    const checkTransform = registry.isModifierAllowedOnEntity('transform', {
      type: 'sequence',
      sequenceType: 'overlay',
      hasStandaloneGenerator: true,
    });
    expect(checkTransform.allowed).toBe(true);

    // 2. Motion GSAP is allowed when hasStandaloneGenerator = true
    const checkGSAP = registry.isModifierAllowedOnEntity('motion/gsap', {
      type: 'sequence',
      sequenceType: 'overlay',
      hasStandaloneGenerator: true,
    });
    expect(checkGSAP.allowed).toBe(true);

    // 3. Blend mode is allowed when hasStandaloneGenerator = true
    const checkBlend = registry.isModifierAllowedOnEntity('overlay/blend_mode', {
      type: 'sequence',
      sequenceType: 'overlay',
      hasStandaloneGenerator: true,
    });
    expect(checkBlend.allowed).toBe(true);

    // 4. Transitions are allowed when hasStandaloneGenerator = true
    const checkTrans = registry.isModifierAllowedOnEntity('transition/crossfade', {
      type: 'sequence',
      sequenceType: 'overlay',
      hasStandaloneGenerator: true,
    });
    expect(checkTrans.allowed).toBe(true);

    // 5. Second standalone generator is REJECTED when hasStandaloneGenerator = true
    const checkSecondGen = registry.isModifierAllowedOnEntity('overlay/canvas_particles', {
      type: 'sequence',
      sequenceType: 'overlay',
      hasStandaloneGenerator: true,
    });
    expect(checkSecondGen.allowed).toBe(false);
    expect(checkSecondGen.reason).toContain('cannot host multiple standalone generators');

    // 6. Footage VFX (camera_3d, partial, color_grading) are REJECTED when hasStandaloneGenerator = true
    const checkCamera = registry.isModifierAllowedOnEntity('vfx/camera_3d', {
      type: 'sequence',
      sequenceType: 'overlay',
      hasStandaloneGenerator: true,
    });
    expect(checkCamera.allowed).toBe(false);
    expect(checkCamera.reason).toContain('cannot be applied to a standalone generator sequence');
  });

  // Test Vector 5: Querying Available Modifiers for Standalone Sequences
  it('should query strictly universal modifiers via getAvailableModifiersForTarget with hasStandaloneGenerator', () => {
    const available = registry.getAvailableModifiersForTarget('sequence', 'overlay', {
      hasStandaloneGenerator: true,
    });

    const types = available.map((p) => p.type);
    expect(types).toContain('transform');
    expect(types).toContain('motion/gsap');
    expect(types).toContain('overlay/blend_mode');
    expect(types).toContain('transition/crossfade');

    // Footage filters and additional generators must NOT be present
    expect(types).not.toContain('vfx/camera_3d');
    expect(types).not.toContain('vfx/color_grading');
    expect(types).not.toContain('vfx/partial');
    expect(types).not.toContain('overlay/hologram_hud');
    expect(types).not.toContain('overlay/canvas_particles');
  });

  // Test Vector 6: Defensive Legacy Migration Auto-Pruning
  it('should defensively prune duplicate standalone generators in migrateLegacyModifiers', () => {
    const rawLegacyDoc = {
      tracks: [
        {
          id: 'track-1',
          type: 'video',
          sequences: [
            {
              id: 'seq-legacy',
              type: 'overlay',
              modifiers: [
                { type: 'overlay/hologram_hud', params: {} },
                { type: 'transform', params: {} },
                { type: 'overlay/canvas_particles', params: {} }, // duplicate generator!
              ],
            },
          ],
        },
      ],
    };

    const sanitized = migrateLegacyModifiers(rawLegacyDoc);
    const seqMods = sanitized.tracks[0].sequences[0].modifiers;
    expect(seqMods.length).toBe(2);
    expect(seqMods[0].type).toBe('overlay/hologram_hud');
    expect(seqMods[1].type).toBe('transform');
    // Canvas particles should be pruned
    expect(seqMods.some((m: any) => m.type === 'overlay/canvas_particles')).toBe(false);
  });
});
