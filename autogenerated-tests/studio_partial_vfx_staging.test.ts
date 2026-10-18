import { describe, it, expect, beforeEach } from 'bun:test';
import { STAGING_PRESETS, type StagingPreset } from '../apps/studio/src/lib/library/stagingPresets';
import { AddSequenceCommand } from '../apps/studio/src/lib/commands/AddSequenceCommand';
import { UpdateTextCueCommand } from '../apps/studio/src/lib/commands/UpdateTextCueCommand';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import {
  RelationalDAGCompiler,
  VideoIRSchemaValidator,
  type VideoIRDocument,
} from '@acc/ir';
import { PartialVFXPlugin, type PartialVFXRegionConfig } from '../packages/ir/src/plugins/vfx/PartialVFXPlugin';

describe('Studio Phase 3: Library Drag-and-Drop Staging, Inline Text Editing & Partial VFX', () => {
  let mockDoc: VideoIRDocument;

  beforeEach(() => {
    mockDoc = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'test-staging-session',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track-v1',
          type: 'video',
          name: 'Video Track 1',
          sequences: [
            {
              id: 'seq-bg-base',
              type: 'video',
              time: { start: 0, duration: 150 },
            },
          ],
        },
      ],
    };
  });

  // =========================================================================
  // 1. STAGING PRESETS CATALOG VERIFICATION
  // =========================================================================
  describe('Staging Presets Catalog', () => {
    it('should declare all 12 required presets across text, shape, and vfx categories', () => {
      expect(STAGING_PRESETS.length).toBeGreaterThanOrEqual(12);

      const textPresets = STAGING_PRESETS.filter((p) => p.category === 'text');
      const shapePresets = STAGING_PRESETS.filter((p) => p.category === 'shape');
      const vfxPresets = STAGING_PRESETS.filter((p) => p.category === 'vfx');

      expect(textPresets.length).toBe(4); // title, lower_third, badge, callout
      expect(shapePresets.length).toBe(4); // rect, rounded_box, circle, arrow
      expect(vfxPresets.length).toBe(4); // blur, spotlight, glitch, point_emitter

      // Verify text preset ids
      const textIds = textPresets.map((p) => p.id);
      expect(textIds).toContain('text_title');
      expect(textIds).toContain('text_lower_third');
      expect(textIds).toContain('text_badge');
      expect(textIds).toContain('text_callout');

      // Verify shape preset ids
      const shapeIds = shapePresets.map((p) => p.id);
      expect(shapeIds).toContain('shape_rect');
      expect(shapeIds).toContain('shape_rounded_box');
      expect(shapeIds).toContain('shape_circle');
      expect(shapeIds).toContain('shape_arrow');

      // Verify partial vfx preset ids
      const vfxIds = vfxPresets.map((p) => p.id);
      expect(vfxIds).toContain('vfx_regional_blur');
      expect(vfxIds).toContain('vfx_spotlight');
      expect(vfxIds).toContain('vfx_regional_glitch');
      expect(vfxIds).toContain('vfx_point_emitter');
    });

    it('should generate valid sequences with proper transform and modifier structures', () => {
      for (const preset of STAGING_PRESETS) {
        const seq = preset.createSequence({
          startFrame: 30,
          durationFrames: 60,
          normX: 0.75,
          normY: 0.25,
        });

        expect(seq.id).toBeDefined();
        expect(seq.time.start).toBe(30);
        expect(seq.time.duration).toBe(60);
        expect(seq.modifiers).toBeDefined();

        const transformMod = seq.modifiers?.find((m) => m.type === 'transform');
        expect(transformMod).toBeDefined();
        expect((transformMod?.params as any).normX).toBe(0.75);
        expect((transformMod?.params as any).normY).toBe(0.25);

        if (preset.category === 'text') {
          expect(seq.cues && seq.cues.length > 0).toBe(true);
          const textStyleMod = seq.modifiers?.find((m) => m.type === 'text/style');
          expect(textStyleMod).toBeDefined();
        } else if (preset.category === 'shape') {
          const shapeMod = seq.modifiers?.find((m) => m.type === 'shape/vector');
          expect(shapeMod).toBeDefined();
        } else if (preset.category === 'vfx') {
          const vfxMod = seq.modifiers?.find((m) => m.type === 'vfx/partial');
          expect(vfxMod).toBeDefined();
        }
      }
    });
  });

  // =========================================================================
  // 2. ADD SEQUENCE COMMAND & UNDO/REDO VERIFICATION
  // =========================================================================
  describe('AddSequenceCommand & Track Provisioning', () => {
    it('should provision missing track, add sequence, compile DAG, and undo cleanly', async () => {
      const titlePreset = STAGING_PRESETS.find((p) => p.id === 'text_title')!;
      const stagedSeq = titlePreset.createSequence({
        startFrame: 10,
        durationFrames: 60,
        normX: 0.5,
        normY: 0.4,
      });

      const cmd = new AddSequenceCommand(titlePreset.targetTrackId, stagedSeq, {
        trackTypeFallback: titlePreset.targetTrackType,
        trackNameFallback: titlePreset.targetTrackName,
      });

      // 1. Execute Command
      const updatedDoc = cmd.execute(mockDoc);
      expect(updatedDoc.tracks.some((t) => t.id === 'track-text-overlay')).toBe(true);
      const textTrack = updatedDoc.tracks.find((t) => t.id === 'track-text-overlay')!;
      expect(textTrack.sequences.some((s) => s.id === stagedSeq.id)).toBe(true);

      // Validate VideoIR Schema
      const validation = VideoIRSchemaValidator.validate(updatedDoc);
      expect(validation.valid).toBe(true);

      // Compile DAG
      const compiler = new RelationalDAGCompiler();
      const compiled = await compiler.compile(updatedDoc);
      expect(compiled.tracks.has('track-text-overlay')).toBe(true);

      // 2. Undo Command
      const undoneDoc = cmd.undo(updatedDoc);
      const restoredTextTrack = undoneDoc.tracks.find((t) => t.id === 'track-text-overlay');
      // Track was newly created and is now empty, so it should be cleanly purged
      expect(restoredTextTrack).toBeUndefined();

      const undoneValidation = VideoIRSchemaValidator.validate(undoneDoc);
      expect(undoneValidation.valid).toBe(true);
    });

    it('should support staging partial VFX and vector shapes into IRStateManager', async () => {
      const stateManager = IRStateManager.getInstance();
      await stateManager.switchTemplate('default');

      const blurPreset = STAGING_PRESETS.find((p) => p.id === 'vfx_regional_blur')!;
      const blurSeq = blurPreset.createSequence({
        startFrame: 0,
        durationFrames: 90,
        normX: 0.6,
        normY: 0.6,
      });

      stateManager.addSequence(blurPreset.targetTrackId, blurSeq, {
        trackTypeFallback: blurPreset.targetTrackType,
        trackNameFallback: blurPreset.targetTrackName,
      });

      const stateAfterAdd = stateManager.getState();
      expect(stateAfterAdd.selectedSequenceId).toBe(blurSeq.id);
      expect(stateAfterAdd.canUndo).toBe(true);
      expect(stateAfterAdd.error).toBeNull();

      // Test Undo
      stateManager.undo();
      const stateAfterUndo = stateManager.getState();
      const hasSeq = stateAfterUndo.doc.tracks.some((t) => t.sequences.some((s) => s.id === blurSeq.id));
      expect(hasSeq).toBe(false);

      // Test Redo
      stateManager.redo();
      const stateAfterRedo = stateManager.getState();
      const hasSeqRedo = stateAfterRedo.doc.tracks.some((t) => t.sequences.some((s) => s.id === blurSeq.id));
      expect(hasSeqRedo).toBe(true);
    });
  });

  // =========================================================================
  // 3. INLINE CANVAS TEXT EDITING VERIFICATION
  // =========================================================================
  describe('UpdateTextCueCommand & Inline Editing', () => {
    it('should update cue text, synchronize text/style modifier, and undo cleanly', () => {
      const titlePreset = STAGING_PRESETS.find((p) => p.id === 'text_title')!;
      const stagedSeq = titlePreset.createSequence({ startFrame: 0, durationFrames: 90 });
      mockDoc.tracks.push({
        id: 'track-text-overlay',
        type: 'timed_text',
        sequences: [stagedSeq],
      });

      const updateCmd = new UpdateTextCueCommand(stagedSeq.id, 0, 'CYBERNETIC TRANSCENDENCE 3000');

      // 1. Execute
      const editedDoc = updateCmd.execute(mockDoc);
      const seq = editedDoc.tracks
        .find((t) => t.id === 'track-text-overlay')
        ?.sequences.find((s) => s.id === stagedSeq.id);

      expect(seq?.cues?.[0].text).toBe('CYBERNETIC TRANSCENDENCE 3000');

      // 2. Undo
      const revertedDoc = updateCmd.undo(editedDoc);
      const revertedSeq = revertedDoc.tracks
        .find((t) => t.id === 'track-text-overlay')
        ?.sequences.find((s) => s.id === stagedSeq.id);

      expect(revertedSeq?.cues?.[0].text).toBe('NEURAL HORIZON 2099');
    });
  });

  // =========================================================================
  // 4. MODULAR PARTIAL VFX PLUGIN SUBSYSTEM
  // =========================================================================
  describe('Modular Partial VFX Plugin Execution', () => {
    it('should create regions for all 4 partial VFX types and validate without leaks', () => {
      const plugin = new PartialVFXPlugin();
      expect(plugin.type).toBe('vfx/partial');

      const regions: PartialVFXRegionConfig[] = [
        {
          id: 'vfx-1',
          type: 'spotlight',
          x: 0.3,
          y: 0.4,
          radius: 180,
          intensity: 1.8,
          color: '#00d4ff',
        },
        {
          id: 'vfx-2',
          type: 'point_emitter',
          x: 0.7,
          y: 0.3,
          intensity: 1.2,
          color: '#ec4899',
        },
        {
          id: 'vfx-3',
          type: 'glitch',
          x: 0.5,
          y: 0.6,
          width: 0.3,
          height: 0.2,
          intensity: 1.0,
        },
        {
          id: 'vfx-4',
          type: 'blur',
          x: 0.2,
          y: 0.7,
          width: 0.25,
          height: 0.2,
        },
      ];

      expect(plugin.validate({ regions })).toBe(true);
      expect(regions.length).toBe(4);
      expect(regions[0].type).toBe('spotlight');
      expect(regions[1].type).toBe('point_emitter');
      expect(regions[2].type).toBe('glitch');
      expect(regions[3].type).toBe('blur');
    });
  });
});
