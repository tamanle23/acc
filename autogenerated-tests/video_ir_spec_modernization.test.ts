import { describe, it, expect } from 'bun:test';
import {
  VideoIRSchemaValidator,
  RelationalDAGCompiler,
  type VideoIRDocument,
  type SequenceType,
  type ModifierNode,
} from '../packages/ir/src';
import modifiersSchema from '../schema/modifiers.schema.json';
import videoIrSchema from '../schema/video-ir.schema.json';

describe('Video IR Spec Modernization Suite', () => {
  const createValidDoc = (): VideoIRDocument => ({
    version: '1.0.0-stable',
    meta: {
      contentId: 'modern-spec-test',
      globalFps: 30,
      canvasSize: { w: 1920, h: 1080 },
    },
    modifiers: [
      {
        type: 'vfx/color_grading',
        target: ['video', 'image', 'overlay'],
        params: { contrast: 1.1, saturation: 1.2 },
      },
      {
        type: 'audio/volume',
        target: 'audio',
        params: { volume: 0.95 },
      },
    ],
    tracks: [
      {
        id: 'track-v1',
        type: 'video',
        blendMode: 'normal',
        sequences: [
          {
            id: 'seq-v1',
            type: 'video',
            blendMode: 'screen',
            time: { start: 0, duration: 60 },
            modifiers: [
              {
                type: 'transform',
                target: ['video', 'image', 'overlay', 'text'],
                params: { scale: 1.05 },
              },
            ],
          },
          {
            id: 'seq-img1',
            type: 'image',
            time: { start: 60, duration: 60 },
          },
          {
            id: 'seq-ovr1',
            type: 'overlay',
            blendMode: 'add',
            time: { start: 120, duration: 60 },
            modifiers: [
              {
                type: 'overlay/canvas_particles',
                target: ['video', 'overlay'],
                params: { type: 'dust', intensity: 0.8 },
              },
            ],
          },
        ],
      },
      {
        id: 'track-a1',
        type: 'audio',
        sequences: [
          {
            id: 'seq-aud1',
            type: 'audio',
            time: { start: 0, duration: 180 },
            modifiers: [
              {
                type: 'audio/volume',
                target: 'audio',
                params: { volume: 0.8 },
              },
            ],
          },
        ],
      },
      {
        id: 'track-txt1',
        type: 'timed_text',
        sequences: [
          {
            id: 'seq-txt1',
            type: 'text',
            time: { start: 0, duration: 90 },
            cues: [{ startOffsetMs: 0, endOffsetMs: 3000, text: 'Hello World' }],
            modifiers: [
              {
                type: 'timed_text/style',
                target: 'text',
                params: { fontSize: 32, color: '#ffffff' },
              },
            ],
          },
        ],
      },
    ],
  });

  // =========================================================================
  // 1. SEQUENCE TYPE & TRACK COMPATIBILITY ENFORCEMENT
  // =========================================================================
  describe('1. Explicit Sequence Types & Track Compatibility Enforcement', () => {
    it('should validate a completely valid modernized document', () => {
      const doc = createValidDoc();
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('should reject a sequence missing strictly required type', () => {
      const doc = createValidDoc();
      delete (doc.tracks[0].sequences[0] as any).type;
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('missing strictly required "type"'))).toBe(true);
    });

    it('should reject a sequence with an invalid sequence type', () => {
      const doc = createValidDoc();
      (doc.tracks[0].sequences[0] as any).type = 'invalid_format';
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('has invalid type "invalid_format"'))).toBe(true);
    });

    it('should reject an audio sequence placed on a video track', () => {
      const doc = createValidDoc();
      doc.tracks[0].sequences.push({
        id: 'seq-illegal-audio',
        type: 'audio',
        time: { start: 0, duration: 30 },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('cannot contain sequence "seq-illegal-audio" of type "audio"'))).toBe(true);
    });

    it('should reject a video sequence placed on an audio track', () => {
      const doc = createValidDoc();
      doc.tracks[1].sequences.push({
        id: 'seq-illegal-video',
        type: 'video',
        time: { start: 0, duration: 30 },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('cannot contain sequence "seq-illegal-video" of type "video"'))).toBe(true);
    });

    it('should reject a text sequence placed on a video track', () => {
      const doc = createValidDoc();
      doc.tracks[0].sequences.push({
        id: 'seq-illegal-text',
        type: 'text',
        time: { start: 0, duration: 30 },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('cannot contain sequence "seq-illegal-text" of type "text"'))).toBe(true);
    });

    it('should accept video, image, and overlay sequences on video tracks', () => {
      const doc = createValidDoc();
      const videoTrack = doc.tracks.find((t) => t.type === 'video')!;
      expect(videoTrack.sequences.map((s) => s.type)).toEqual(['video', 'image', 'overlay']);
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
    });
  });

  // =========================================================================
  // 2. MODIFIER TARGET ENFORCEMENT & DOMAIN CONSTRAINTS
  // =========================================================================
  describe('2. Explicit Modifier Target Property & Domain Constraints', () => {
    it('should reject a modifier missing strictly required target property', () => {
      const doc = createValidDoc();
      delete (doc.tracks[0].sequences[0].modifiers![0] as any).target;
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('missing strictly required "target"'))).toBe(true);
    });

    it('should reject a modifier with an empty target array', () => {
      const doc = createValidDoc();
      (doc.tracks[0].sequences[0].modifiers![0] as any).target = [];
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('has empty "target" array'))).toBe(true);
    });

    it('should reject a modifier whose target is incompatible with its track domain', () => {
      const doc = createValidDoc();
      // Placing an audio modifier on a video sequence/track
      doc.tracks[0].sequences[0].modifiers!.push({
        type: 'audio/volume',
        target: 'audio',
        params: { volume: 0.5 },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('is incompatible with track permitted types'))).toBe(true);
    });

    it('should reject a modifier whose target does not match its parent sequence type', () => {
      const doc = createValidDoc();
      // Placing a particle modifier targeting only overlay onto a video sequence
      doc.tracks[0].sequences[0].modifiers!.push({
        type: 'overlay/canvas_particles',
        target: 'overlay', // sequence type is 'video'
        params: { type: 'snow' },
      });
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('does not target sequence type "video"'))).toBe(true);
    });

    it('should accept multi-target modifiers (e.g. transform targeting video, image, overlay, text)', () => {
      const doc = createValidDoc();
      const mod = doc.tracks[0].sequences[0].modifiers![0];
      expect(Array.isArray(mod.target)).toBe(true);
      expect(mod.target).toContain('video');
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
    });
  });

  // =========================================================================
  // 3. GLOBAL DOCUMENT-LEVEL MODIFIERS & DAG RESOLUTION
  // =========================================================================
  describe('3. Global Document-Level Modifiers & DAG Compilation', () => {
    it('should validate root doc.modifiers array in schema and validator', () => {
      const doc = createValidDoc();
      expect(doc.modifiers).toBeDefined();
      expect(doc.modifiers!.length).toBe(2);
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
    });

    it('should compile timeline and retain global doc.modifiers on ResolvedTimeline', async () => {
      const doc = createValidDoc();
      const compiler = new RelationalDAGCompiler();
      const timeline = await compiler.compile(doc);

      expect(timeline.modifiers).toBeDefined();
      expect(timeline.modifiers!.length).toBe(2);
      expect(timeline.modifiers![0].type).toBe('vfx/color_grading');
      expect(timeline.modifiers![1].type).toBe('audio/volume');
    });

    it('should compile sequences and propagate type and blendMode onto ResolvedSequence', async () => {
      const doc = createValidDoc();
      const compiler = new RelationalDAGCompiler();
      const timeline = await compiler.compile(doc);

      const seqV1 = timeline.sequences.get('seq-v1');
      expect(seqV1).toBeDefined();
      expect(seqV1!.type).toBe('video');
      expect(seqV1!.blendMode).toBe('screen');

      const seqOvr = timeline.sequences.get('seq-ovr1');
      expect(seqOvr).toBeDefined();
      expect(seqOvr!.type).toBe('overlay');
      expect(seqOvr!.blendMode).toBe('add');
    });
  });

  // =========================================================================
  // 4. DUAL-LEVEL BLEND MODES (SEQUENCE & TRACK)
  // =========================================================================
  describe('4. Dual-Level Blend Modes Cascade', () => {
    it('should accept valid blend modes on both sequence and track', () => {
      const doc = createValidDoc();
      doc.tracks[0].blendMode = 'multiply';
      doc.tracks[0].sequences[0].blendMode = 'screen';
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(true);
    });

    it('should reject invalid blendMode values', () => {
      const doc = createValidDoc();
      (doc.tracks[0].sequences[0] as any).blendMode = 'ultra_glow';
      const res = VideoIRSchemaValidator.validate(doc);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('has invalid blendMode "ultra_glow"'))).toBe(true);
    });
  });

  // =========================================================================
  // 5. MODULAR JSON SCHEMA ARCHITECTURE & SERDE
  // =========================================================================
  describe('5. Modular JSON Schema & SerDe Verification', () => {
    it('should verify schema/modifiers.schema.json declares required modifier properties and definitions', () => {
      expect(modifiersSchema.$id).toBe('http://universal-video-ir.schema.org/modifiers.schema.json');
      expect(modifiersSchema.definitions.SequenceType.enum).toEqual([
        'video',
        'image',
        'audio',
        'text',
        'overlay',
      ]);
      expect(modifiersSchema.definitions.ModifierNode.required).toEqual([
        'type',
        'target',
        'params',
      ]);
    });

    it('should verify schema/video-ir.schema.json includes SequenceType and updated IRSequence required fields', () => {
      expect((videoIrSchema as any).definitions.IRSequence.required).toContain('type');
      expect((videoIrSchema as any).definitions.IRSequence.required).toContain('id');
      expect((videoIrSchema as any).definitions.IRSequence.required).toContain('time');
      expect((videoIrSchema as any).definitions.ModifierNode.required).toContain('target');
      expect((videoIrSchema as any).properties.modifiers).toBeDefined();
    });

    it('should perform flawless serialize and deserialize roundtrip', () => {
      const doc = createValidDoc();
      const jsonStr = VideoIRSchemaValidator.serialize(doc);
      expect(typeof jsonStr).toBe('string');

      const parsed = VideoIRSchemaValidator.deserialize(jsonStr);
      expect(parsed.meta.contentId).toBe('modern-spec-test');
      expect(parsed.modifiers).toHaveLength(2);
      expect(parsed.tracks[0].sequences[0].type).toBe('video');
      expect(parsed.tracks[0].sequences[0].blendMode).toBe('screen');
      expect(parsed.tracks[0].sequences[0].modifiers![0].target).toContain('video');
    });
  });
});
