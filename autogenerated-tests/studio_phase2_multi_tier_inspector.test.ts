import { describe, it, expect, beforeEach } from 'bun:test';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { UpdateTrackCommand } from '../apps/studio/src/lib/commands/UpdateTrackCommand';
import { ReorderTrackCommand } from '../apps/studio/src/lib/commands/ReorderTrackCommand';
import { UpdateSequencePropsCommand } from '../apps/studio/src/lib/commands/UpdateSequencePropsCommand';
import { UpdateProjectMetaCommand } from '../apps/studio/src/lib/commands/UpdateProjectMetaCommand';
import { UpdateModifierCommand } from '../apps/studio/src/lib/commands/UpdateModifierCommand';
import { getSectionIdForModifierType } from '../apps/studio/src/components/RightSidebar';
import type { VideoIRDocument } from '@acc/ir';

describe('Studio Phase 2: Dynamic Multi-Tier Inspector & State Commands', () => {
  let initialDoc: VideoIRDocument;

  beforeEach(() => {
    initialDoc = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'test-project-master',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track-v1',
          type: 'video',
          name: 'Video Track 1',
          blendMode: 'normal',
          style: { opacity: 1.0 },
          sequences: [
            {
              id: 'seq-1',
              type: 'video',
              time: { start: 0, duration: 60 },
              blendMode: 'normal',
              modifiers: [],
            },
          ],
        },
        {
          id: 'track-a1',
          type: 'audio',
          name: 'Audio Track 1',
          routeTo: 'master',
          style: { volume: 1.0, pan: 0.0 },
          sequences: [
            {
              id: 'seq-audio-1',
              type: 'audio',
              time: { start: 0, duration: 60 },
            },
          ],
        },
        {
          id: 'track-text',
          type: 'timed_text',
          name: 'Subtitle Track',
          sequences: [
            {
              id: 'seq-text-1',
              type: 'text',
              time: { start: 0, duration: 60 },
              cues: [
                { startOffsetMs: 0, endOffsetMs: 1500, text: 'Hello World' },
              ],
            },
          ],
        },
      ],
    };
  });

  describe('UpdateTrackCommand', () => {
    it('executes and updates track properties cleanly', () => {
      const cmd = new UpdateTrackCommand('track-v1', {
        name: 'Main Composite V1',
        blendMode: 'screen',
        style: { opacity: 0.8 },
      });

      const nextDoc = cmd.execute(initialDoc);
      const track = nextDoc.tracks.find((t) => t.id === 'track-v1');
      expect(track?.name).toBe('Main Composite V1');
      expect(track?.blendMode).toBe('screen');
      expect(track?.style?.opacity).toBe(0.8);
    });

    it('rolls back cleanly on undo()', () => {
      const cmd = new UpdateTrackCommand('track-v1', {
        name: 'Changed Name',
        blendMode: 'overlay',
      });

      const nextDoc = cmd.execute(initialDoc);
      const rolledBack = cmd.undo(nextDoc);
      const track = rolledBack.tracks.find((t) => t.id === 'track-v1');
      expect(track?.name).toBe('Video Track 1');
      expect(track?.blendMode).toBe('normal');
    });

    it('merges continuous updates within 500ms window', () => {
      const cmd1 = new UpdateTrackCommand('track-a1', { style: { volume: 0.9 } });
      const cmd2 = new UpdateTrackCommand('track-a1', { style: { volume: 0.7 } });

      const merged = cmd1.tryMerge(cmd2);
      expect(merged).toBe(true);

      const executed = cmd1.execute(initialDoc);
      const track = executed.tracks.find((t) => t.id === 'track-a1');
      expect(track?.style?.volume).toBe(0.7);
    });
  });

  describe('ReorderTrackCommand', () => {
    it('shifts a track up and down in doc.tracks', () => {
      // track-a1 is currently index 1. Moving it 'up' should make it index 0.
      const moveUpCmd = new ReorderTrackCommand('track-a1', 'up');
      const docMovedUp = moveUpCmd.execute(initialDoc);
      expect(docMovedUp.tracks[0].id).toBe('track-a1');
      expect(docMovedUp.tracks[1].id).toBe('track-v1');

      // Undo moving up
      const docReverted = moveUpCmd.undo(docMovedUp);
      expect(docReverted.tracks[0].id).toBe('track-v1');
      expect(docReverted.tracks[1].id).toBe('track-a1');
    });

    it('prevents merging for discrete track reorder commands', () => {
      const cmd1 = new ReorderTrackCommand('track-a1', 'up');
      const cmd2 = new ReorderTrackCommand('track-a1', 'down');
      expect(cmd1.tryMerge(cmd2)).toBe(false);
    });
  });

  describe('UpdateSequencePropsCommand', () => {
    it('updates blendMode and inline timed cues on sequence', () => {
      const cmd = new UpdateSequencePropsCommand('seq-text-1', {
        blendMode: 'screen',
        cues: [
          { startOffsetMs: 0, endOffsetMs: 1200, text: 'First Cue' },
          { startOffsetMs: 1200, endOffsetMs: 'end', text: 'Second Cue' },
        ],
      });

      const nextDoc = cmd.execute(initialDoc);
      const seq = nextDoc.tracks
        .flatMap((t) => t.sequences)
        .find((s) => s.id === 'seq-text-1');

      expect(seq?.blendMode).toBe('screen');
      expect(seq?.cues).toHaveLength(2);
      expect(seq?.cues?.[0].text).toBe('First Cue');
      expect(seq?.cues?.[1].endOffsetMs).toBe('end');

      const undoneDoc = cmd.undo(nextDoc);
      const undoneSeq = undoneDoc.tracks
        .flatMap((t) => t.sequences)
        .find((s) => s.id === 'seq-text-1');
      expect(undoneSeq?.cues).toHaveLength(1);
      expect(undoneSeq?.cues?.[0].text).toBe('Hello World');
    });
  });

  describe('UpdateProjectMetaCommand', () => {
    it('updates canvas size and global FPS with merge window', () => {
      const cmd1 = new UpdateProjectMetaCommand({
        canvasSize: { w: 1080, h: 1920 },
      });
      const cmd2 = new UpdateProjectMetaCommand({
        globalFps: 60,
      });

      const merged = cmd1.tryMerge(cmd2);
      expect(merged).toBe(true);

      const nextDoc = cmd1.execute(initialDoc);
      expect(nextDoc.meta.canvasSize).toEqual({ w: 1080, h: 1920 });
      expect(nextDoc.meta.globalFps).toBe(60);

      const undoneDoc = cmd1.undo(nextDoc);
      expect(undoneDoc.meta.canvasSize).toEqual({ w: 1920, h: 1080 });
      expect(undoneDoc.meta.globalFps).toBe(30);
    });
  });

  describe('IRStateManager Selection & Inspector Tier Transitions', () => {
    it('manages inspectorMode and auto-selects parent track on sequence select', () => {
      const stateManager = IRStateManager.getInstance();
      
      // Select sequence
      stateManager.setSelectedSequenceId('seq-city-intro');
      let state = stateManager.getState();
      expect(state.selectedSequenceId).toBe('seq-city-intro');
      expect(state.selectedTrackId).toBe('track-v1');
      expect(state.inspectorMode).toBe('sequence');

      // Switch to track inspector tier
      stateManager.setSelectedTrackId('track-audio');
      state = stateManager.getState();
      expect(state.selectedTrackId).toBe('track-audio');
      expect(state.inspectorMode).toBe('track');

      // Switch to project inspector tier
      stateManager.setInspectorMode('project');
      state = stateManager.getState();
      expect(state.inspectorMode).toBe('project');
    });
  });

  describe('Add Effect & Modifier Accordion Section Mapping', () => {
    it('correctly maps all known and custom modifier types to accordion section IDs', () => {
      expect(getSectionIdForModifierType('transform')).toBe('transform');
      expect(getSectionIdForModifierType('vfx/depth_relighting')).toBe('relighting');
      expect(getSectionIdForModifierType('vfx/depth3d_relighting')).toBe('relighting');
      expect(getSectionIdForModifierType('camera/3d')).toBe('camera');
      expect(getSectionIdForModifierType('camera/path')).toBe('camera');
      expect(getSectionIdForModifierType('overlay/hologram_hud')).toBe('hologram_hud');
      expect(getSectionIdForModifierType('overlay/canvas_particles')).toBe('particles');
      expect(getSectionIdForModifierType('vfx/color_grading')).toBe('color');
      expect(getSectionIdForModifierType('timed_text/style')).toBe('typography');
      expect(getSectionIdForModifierType('text/style')).toBe('typography');
      expect(getSectionIdForModifierType('sfx/dynamic_ducking')).toBe('audio');
      expect(getSectionIdForModifierType('audio/volume')).toBe('audio');
      expect(getSectionIdForModifierType('sfx/procedural')).toBe('procedural_sfx');
      expect(getSectionIdForModifierType('custom/glitch_fx')).toBe('generic_custom_glitch_fx');
    });

    it('attaches new modifier to sequence via UpdateModifierCommand without mutating existing state', () => {
      const cmd = new UpdateModifierCommand('seq-1', 'vfx/color_grading', {
        enabled: true,
        contrast: 1.25,
        saturation: 1.1,
      });

      const nextDoc = cmd.execute(initialDoc);
      const seq = nextDoc.tracks[0].sequences.find((s) => s.id === 'seq-1');
      expect(seq?.modifiers).toBeDefined();
      const addedMod = seq?.modifiers?.find((m) => m.type === 'vfx/color_grading');
      expect(addedMod).toBeDefined();
      expect(addedMod?.params?.contrast).toBe(1.25);

      // Verify undo cleans up the newly added modifier
      const undoneDoc = cmd.undo(nextDoc);
      const undoneSeq = undoneDoc.tracks[0].sequences.find((s) => s.id === 'seq-1');
      const shouldBeGone = undoneSeq?.modifiers?.find((m) => m.type === 'vfx/color_grading');
      expect(shouldBeGone).toBeUndefined();
    });
  });
});
