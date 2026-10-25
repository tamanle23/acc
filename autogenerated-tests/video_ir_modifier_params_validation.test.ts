import { describe, it, expect } from 'bun:test';
import { VideoIRSchemaValidator } from '../packages/ir/src/schema/VideoIRSchemaValidator';
import type { VideoIRDocument } from '../packages/ir/src/types/VideoIR';

function createBaseDoc(modifier: any, trackType: 'video' | 'audio' | 'timed_text' = 'video', seqType: 'video' | 'audio' | 'text' | 'overlay' = 'video'): VideoIRDocument {
  return {
    version: '1.0.0-stable',
    meta: {
      contentId: 'modifier_param_test',
      globalFps: 30,
      canvasSize: { w: 1920, h: 1080 },
    },
    tracks: [
      {
        id: 'test_track',
        type: trackType,
        sequences: [
          {
            id: 'test_seq',
            type: seqType,
            time: { start: 0, duration: 90 },
            modifiers: [modifier],
          },
        ],
      },
    ],
  };
}

describe('Video IR Modifier Parameters Pure TypeScript Validation Suite', () => {
  // =========================================================================
  // 1. In-Canvas Transform & Temporal Curves
  // =========================================================================
  describe('1. Transform & Temporal Curves', () => {
    it('accepts valid transform with numeric and TemporalCurve parameters', () => {
      const doc = createBaseDoc({
        type: 'transform',
        target: 'video',
        params: {
          x: 100,
          y: {
            intro: { durationSec: 0.5, from: -200, to: 0, ease: 'ease-out' },
            steady: { type: 'drift', intensity: 0.2 },
            outro: { durationSec: 0.3, to: 500, ease: 'ease-in' },
            keyframes: [{ timeSec: 1.0, value: 50, ease: 'linear' }],
          },
          scale: 1.2,
          rotation: 45,
          opacity: 0.9,
          normX: 0.5,
          normY: 0.5,
          animation: { preset: 'pop_in' },
        },
      });

      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects transform parameter with NaN value', () => {
      const doc = createBaseDoc({
        type: 'transform',
        target: 'video',
        params: { scale: NaN },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('param "scale" cannot be NaN'))).toBe(true);
    });

    it('rejects transform parameter with invalid animation preset', () => {
      const doc = createBaseDoc({
        type: 'transform',
        target: 'video',
        params: { animation: { preset: 'invalid_preset' } },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('param "animation.preset" must be one of'))).toBe(true);
    });

    it('rejects temporal curve with negative intro duration', () => {
      const doc = createBaseDoc({
        type: 'transform',
        target: 'video',
        params: {
          scale: {
            intro: { durationSec: -1, from: 0, ease: 'ease' },
          },
        },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('scale.intro.durationSec') && e.includes('non-negative number'))).toBe(true);
    });

    it('rejects temporal curve with invalid steady type', () => {
      const doc = createBaseDoc({
        type: 'transform',
        target: 'video',
        params: {
          scale: {
            steady: { type: 'invalid_steady' },
          },
        },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('scale.steady.type') && e.includes('must be \'hold\', \'drift\', or \'pulse\''))).toBe(true);
    });
  });

  // =========================================================================
  // 2. 3D VFX & Camera
  // =========================================================================
  describe('2. 3D VFX & Camera Modifiers', () => {
    it('accepts valid vfx/camera_3d keyframes and rackFocus', () => {
      const doc = createBaseDoc({
        type: 'vfx/camera_3d',
        target: 'video',
        params: {
          keyframes: [
            { time: 0, position: [0, 0, 1] },
            { time: 1, position: [0.1, -0.1, 0.9] },
          ],
          rackFocus: { enabled: true },
        },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
    });

    it('rejects vfx/camera_3d with non-3D position tuple', () => {
      const doc = createBaseDoc({
        type: 'vfx/camera_3d',
        target: 'video',
        params: {
          keyframes: [{ time: 0, position: [0, 0] }], // Only 2 coordinates
        },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('position must be [x, y, z] numbers'))).toBe(true);
    });

    it('accepts valid vfx/depth3d relighting and rejects non-boolean enabled', () => {
      const docValid = createBaseDoc({
        type: 'vfx/depth3d',
        target: 'video',
        params: {
          mode: 'frame_breaker',
          relighting: { enabled: true, lightPosition: [0.5, 0.5, 1.0] },
        },
      });
      expect(VideoIRSchemaValidator.validate(docValid).valid).toBe(true);

      const docInvalid = createBaseDoc({
        type: 'vfx/depth3d',
        target: 'video',
        params: {
          mode: 'frame_breaker',
          relighting: { enabled: 'yes' }, // non-boolean
        },
      });
      const res = VideoIRSchemaValidator.validate(docInvalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('relighting.enabled must be a boolean'))).toBe(true);
    });
  });

  // =========================================================================
  // 3. Color Grading & Overlays
  // =========================================================================
  describe('3. Color Grading & Overlays', () => {
    it('validates color/lut requires string lut and intensity between 0 and 1', () => {
      const validDoc = createBaseDoc({
        type: 'color/lut',
        target: 'video',
        params: { lutAsset: 'cinematic_rec709', intensity: 0.8 },
      });
      expect(VideoIRSchemaValidator.validate(validDoc).valid).toBe(true);

      const invalidLut = createBaseDoc({
        type: 'color/lut',
        target: 'video',
        params: { intensity: 0.5 }, // missing lutAsset
      });
      const res1 = VideoIRSchemaValidator.validate(invalidLut);
      expect(res1.valid).toBe(false);
      expect(res1.errors.some(e => e.includes('requires a string "lutAsset"'))).toBe(true);

      const invalidIntensity = createBaseDoc({
        type: 'color/lut',
        target: 'video',
        params: { lutAsset: 'rec709', intensity: 1.5 }, // > 1
      });
      const res2 = VideoIRSchemaValidator.validate(invalidIntensity);
      expect(res2.valid).toBe(false);
      expect(res2.errors.some(e => e.includes('intensity" must be a number between 0 and 1'))).toBe(true);
    });

    it('validates overlay/canvas_particles type, useSIMD, and non-negative particleCount', () => {
      const validDoc = createBaseDoc({
        type: 'overlay/canvas_particles',
        target: 'video',
        params: { type: 'snow', intensity: 1.0, particleCount: 500, useSIMD: true },
      });
      expect(VideoIRSchemaValidator.validate(validDoc).valid).toBe(true);

      const invalidDoc = createBaseDoc({
        type: 'overlay/canvas_particles',
        target: 'video',
        params: { particleCount: -50 },
      });
      const res = VideoIRSchemaValidator.validate(invalidDoc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('particleCount must be a non-negative integer'))).toBe(true);
    });

    it('validates overlay/hologram_hud parameters', () => {
      const validDoc = createBaseDoc({
        type: 'overlay/hologram_hud',
        target: 'video',
        params: { enabled: true, glitchIntensity: 0.3, color: '#00ffff' },
      });
      expect(VideoIRSchemaValidator.validate(validDoc).valid).toBe(true);

      const invalidDoc = createBaseDoc({
        type: 'overlay/hologram_hud',
        target: 'video',
        params: { enabled: 'true' },
      });
      const res = VideoIRSchemaValidator.validate(invalidDoc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('enabled must be a boolean'))).toBe(true);
    });
  });

  // =========================================================================
  // 4. Timed Text & Typography
  // =========================================================================
  describe('4. Typography & Timed Text', () => {
    it('validates text/style fontSize, textAlign, and activeWord', () => {
      const validDoc = createBaseDoc(
        {
          type: 'text/style',
          target: 'text',
          params: {
            fontSize: 48,
            fontFamily: 'Inter',
            color: '#ffffff',
            textAlign: 'center',
            activeWord: { color: '#fbbf24', scale: 1.15 },
          },
        },
        'timed_text',
        'text'
      );
      expect(VideoIRSchemaValidator.validate(validDoc).valid).toBe(true);

      const invalidFont = createBaseDoc(
        {
          type: 'text/style',
          target: 'text',
          params: { fontSize: -10 },
        },
        'timed_text',
        'text'
      );
      const res = VideoIRSchemaValidator.validate(invalidFont);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('fontSize must be a positive number'))).toBe(true);

      const invalidAlign = createBaseDoc(
        {
          type: 'text/style',
          target: 'text',
          params: { textAlign: 'justify' },
        },
        'timed_text',
        'text'
      );
      const resAlign = VideoIRSchemaValidator.validate(invalidAlign);
      expect(resAlign.valid).toBe(false);
      expect(resAlign.errors.some(e => e.includes('textAlign must be \'left\', \'center\', or \'right\''))).toBe(true);
    });
  });

  // =========================================================================
  // 5. Audio & SFX Modifiers
  // =========================================================================
  describe('5. Audio & SFX Modifiers', () => {
    it('validates audio/volume non-negative volume and fades', () => {
      const validDoc = createBaseDoc(
        {
          type: 'audio/volume',
          target: 'audio',
          params: { volume: 0.8, fadeInSec: 0.5, fadeOutSec: 1.0, muted: false },
        },
        'audio',
        'audio'
      );
      expect(VideoIRSchemaValidator.validate(validDoc).valid).toBe(true);

      const invalidDoc = createBaseDoc(
        {
          type: 'audio/volume',
          target: 'audio',
          params: { volume: -0.5 },
        },
        'audio',
        'audio'
      );
      const res = VideoIRSchemaValidator.validate(invalidDoc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('volume must be a non-negative number'))).toBe(true);
    });

    it('validates audio/pan stereoPan bounds [-1.0, 1.0]', () => {
      const validDoc = createBaseDoc(
        {
          type: 'audio/pan',
          target: 'audio',
          params: { stereoPan: -0.75 },
        },
        'audio',
        'audio'
      );
      expect(VideoIRSchemaValidator.validate(validDoc).valid).toBe(true);

      const invalidDoc = createBaseDoc(
        {
          type: 'audio/pan',
          target: 'audio',
          params: { stereoPan: 2.0 },
        },
        'audio',
        'audio'
      );
      const res = VideoIRSchemaValidator.validate(invalidDoc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('must be a number between -1.0 and +1.0'))).toBe(true);
    });

    it('validates audio/filter filterType and cutoff frequency', () => {
      const validDoc = createBaseDoc(
        {
          type: 'audio/filter',
          target: 'audio',
          params: { filterType: 'lowpass', cutoffHz: 1200 },
        },
        'audio',
        'audio'
      );
      expect(VideoIRSchemaValidator.validate(validDoc).valid).toBe(true);

      const invalidDoc = createBaseDoc(
        {
          type: 'audio/filter',
          target: 'audio',
          params: { filterType: 'notch', cutoffHz: 500 },
        },
        'audio',
        'audio'
      );
      const res = VideoIRSchemaValidator.validate(invalidDoc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('filterType must be one of: lowpass, highpass, bandpass'))).toBe(true);
    });

    it('validates sfx/dynamic_ducking numeric factor bounds [0, 1]', () => {
      const validDoc = createBaseDoc(
        {
          type: 'sfx/dynamic_ducking',
          target: 'audio',
          params: { duckingFactor: 0.3 },
        },
        'audio',
        'audio'
      );
      expect(VideoIRSchemaValidator.validate(validDoc).valid).toBe(true);

      const invalidDoc = createBaseDoc(
        {
          type: 'sfx/dynamic_ducking',
          target: 'audio',
          params: { duckingFactor: 1.5 },
        },
        'audio',
        'audio'
      );
      const res = VideoIRSchemaValidator.validate(invalidDoc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('numeric duckingFactor must be between 0 and 1'))).toBe(true);
    });
  });

  // =========================================================================
  // 6. Editorial & Custom Modifiers (Open-Closed Principle)
  // =========================================================================
  describe('6. Editorial & Custom Modifiers', () => {
    it('validates editorial/split_edit mode and duration', () => {
      const validDoc = createBaseDoc({
        type: 'editorial/split_edit',
        target: 'video',
        params: { mode: 'j_cut', splitDurationFrames: 15 },
      });
      expect(VideoIRSchemaValidator.validate(validDoc).valid).toBe(true);

      const invalidDoc = createBaseDoc({
        type: 'editorial/split_edit',
        target: 'video',
        params: { mode: 'x_cut', splitDurationFrames: 10 },
      });
      const res = VideoIRSchemaValidator.validate(invalidDoc);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('mode must be \'j_cut\' or \'l_cut\''))).toBe(true);
    });

    it('allows unknown/custom third-party modifier types with object params (OCP)', () => {
      const customDoc = createBaseDoc({
        type: 'custom/ai_super_resolution',
        target: 'video',
        params: {
          scaleModel: 'real_esrgan_4x',
          denoiseStrength: 0.7,
        },
      });
      const res = VideoIRSchemaValidator.validate(customDoc);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });
  });
});
