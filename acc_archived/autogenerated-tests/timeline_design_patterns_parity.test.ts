import { describe, it, expect, beforeEach } from 'bun:test';
import {
  TimelineCommandDispatcher,
  SelectClipCommand,
  MoveClipCommand,
  TrimClipCommand,
  RazorCutCommand,
} from '../apps/studio/src/lib/timeline/commands/TimelineCommands';
import { TimelineHitTester, type HitTestTrack } from '../apps/studio/src/lib/timeline/interaction/TimelineHitTester';
import { TimelineMagneticSnapService } from '../apps/studio/src/lib/timeline/interaction/TimelineMagneticSnapService';
import { TimelinePointerStateMachine, type GhostDragState } from '../apps/studio/src/lib/timeline/interaction/TimelinePointerStateMachine';

describe('Timeline Design Patterns Parity Suite', () => {
  const sampleTracks: HitTestTrack[] = [
    {
      id: 'track-v1',
      type: 'video',
      sequences: [
        { id: 'seq-1', startFrame: 0, durationFrames: 60, type: 'video' },
        { id: 'seq-2', startFrame: 90, durationFrames: 60, type: 'video' },
      ],
    },
    {
      id: 'track-a1',
      type: 'audio',
      sequences: [
        { id: 'seq-3', startFrame: 0, durationFrames: 120, type: 'audio' },
      ],
    },
  ];

  describe('Pattern 2: Command Pattern & Dispatcher', () => {
    it('dispatches commands and records them in history', () => {
      const dispatcher = TimelineCommandDispatcher.getInstance();
      dispatcher.clearHistory();

      const cmd1 = new SelectClipCommand('seq-1');
      dispatcher.dispatch(cmd1);

      const cmd2 = new MoveClipCommand('seq-1', 'track-v1', 30);
      dispatcher.dispatch(cmd2);

      const history = dispatcher.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].type).toBe('SELECT_CLIP');
      expect(history[1].type).toBe('MOVE_CLIP');
    });
  });

  describe('Pattern 4: Mathematical Hit Testing & Snap Service', () => {
    it('accurately detects clip body vs edge trim handles', () => {
      const pixelsPerFrame = 4; // 1 frame = 4px, seq-1 is [0, 240px]

      // Hit at x = 2px (within 8px left edge): trim-start
      const hitLeft = TimelineHitTester.hitTest(
        { x: 2, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks
      );
      expect(hitLeft.type).toBe('trim-start');
      expect(hitLeft.seqId).toBe('seq-1');

      // Hit at x = 50px (middle of clip): clip body
      const hitBody = TimelineHitTester.hitTest(
        { x: 50, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks
      );
      expect(hitBody.type).toBe('clip');
      expect(hitBody.seqId).toBe('seq-1');

      // Hit at x = 236px (within 8px right edge): trim-end
      const hitRight = TimelineHitTester.hitTest(
        { x: 236, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks
      );
      expect(hitRight.type).toBe('trim-end');
      expect(hitRight.seqId).toBe('seq-1');

      // Hit at empty track gap (x = 300px, frame 75): empty-track
      const hitGap = TimelineHitTester.hitTest(
        { x: 300, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks
      );
      expect(hitGap.type).toBe('empty-track');
      expect(hitGap.trackId).toBe('track-v1');
    });

    it('calculates magnetic snap against playhead and adjacent clip boundaries', () => {
      const pixelsPerFrame = 4;
      const playheadFrame = 50;

      // Candidate at 49f (1 frame from playhead 50f): snaps to playhead
      const snapPlayhead = TimelineMagneticSnapService.calculateSnap(
        49, pixelsPerFrame, playheadFrame, sampleTracks
      );
      expect(snapPlayhead.isSnapped).toBe(true);
      expect(snapPlayhead.snappedFrame).toBe(50);
      expect(snapPlayhead.target?.type).toBe('playhead');

      // Candidate at 89f (1 frame from seq-2 start 90f): snaps to clip edge
      const snapEdge = TimelineMagneticSnapService.calculateSnap(
        89, pixelsPerFrame, playheadFrame, sampleTracks
      );
      expect(snapEdge.isSnapped).toBe(true);
      expect(snapEdge.snappedFrame).toBe(90);
      expect(snapEdge.target?.type).toBe('clip-edge');

      // Candidate far away at 75f (no snap targets near): no snap
      const snapNone = TimelineMagneticSnapService.calculateSnap(
        75, pixelsPerFrame, playheadFrame, sampleTracks
      );
      expect(snapNone.isSnapped).toBe(false);
      expect(snapNone.snappedFrame).toBe(75);
    });
  });

  describe('Pattern 3: Pointer State Machine & Interaction', () => {
    it('manages drag lifecycle and calculates ghost state', () => {
      let cursor = 'default';
      let ghost: GhostDragState | null = null;
      let snapLine: number | null = null;

      const fsm = new TimelinePointerStateMachine({
        onCursorChange: (c) => { cursor = c; },
        onGhostUpdate: (g) => { ghost = g; },
        onSnapGuideline: (s) => { snapLine = s; },
      });

      const pixelsPerFrame = 4;

      // 1. Pointer down on clip body
      fsm.handlePointerDown(
        { x: 50, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks, 0
      );
      expect(cursor).toBe('grabbing');
      expect(ghost).toBeDefined();
      expect(ghost?.seqId).toBe('seq-1');
      expect(ghost?.type).toBe('clip');

      // 2. Pointer move: drag right by 40px (10 frames)
      fsm.handlePointerMove(
        { x: 90, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks, 0
      );
      expect(ghost?.currentStartFrame).toBe(10);
      expect(ghost?.deltaFrames).toBe(10);

      // 3. Pointer up: commits move
      fsm.handlePointerUp();
      expect(fsm.getCursor()).toBe('default');
    });

    it('manages edge trimming lifecycle with handles', () => {
      let ghost: GhostDragState | null = null;

      const fsm = new TimelinePointerStateMachine({
        onGhostUpdate: (g) => { ghost = g; },
      });

      const pixelsPerFrame = 4;

      // Pointer down on trim-end handle of seq-1 (x = 238px)
      fsm.handlePointerDown(
        { x: 238, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks, 0
      );
      expect(ghost?.type).toBe('trim');
      expect(ghost?.handle).toBe('end');

      // Pointer move: trim out by 20px (+5 frames)
      fsm.handlePointerMove(
        { x: 258, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks, 0
      );
      expect(ghost?.currentDurationFrames).toBe(65);
      expect(ghost?.deltaFrames).toBe(5);

      fsm.handlePointerUp();
    });

    it('enforces cross-lane track compatibility and flags invalid drop collisions', () => {
      let ghost: GhostDragState | null = null;
      let cursor = 'default';

      const fsm = new TimelinePointerStateMachine({
        onGhostUpdate: (g) => { ghost = g; },
        onCursorChange: (c) => { cursor = c; },
      });

      const pixelsPerFrame = 4;

      // Pointer down on video clip seq-1 on track-v1 (y = 15)
      fsm.handlePointerDown(
        { x: 50, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks, 0
      );
      expect(ghost?.isValidDrop).toBe(true);

      // Drag downward into audio track track-a1 (y = 65, which is trackIndex 1)
      fsm.handlePointerMove(
        { x: 50, y: 65 },
        0, 0, pixelsPerFrame, 44, sampleTracks, 0
      );
      expect(ghost?.isValidDrop).toBe(false);
      expect(ghost?.dropMessage).toBe('Video track only');
      expect(cursor).toBe('not-allowed');

      // Drag back up to track-v1 but overlapping seq-2 (seq-2 is at frame 90..150, so move seq-1 to frame 80..140)
      // delta = 80f * 4px = 320px
      fsm.handlePointerMove(
        { x: 370, y: 15 },
        0, 0, pixelsPerFrame, 44, sampleTracks, 0
      );
      expect(ghost?.isValidDrop).toBe(false);
      expect(ghost?.dropMessage).toBe('Overlap Collision');
      expect(cursor).toBe('not-allowed');

      fsm.handlePointerUp();
      expect(fsm.getCursor()).toBe('default');
    });

    it('snaps candidate frames to major timecode grid seconds', () => {
      const pixelsPerFrame = 4;
      const playheadFrame = 100;

      // Candidate at 211f (1 frame away from 210f = 7s grid at 30fps, far from any clip): snaps to grid
      const snapGrid = TimelineMagneticSnapService.calculateSnap(
        211, pixelsPerFrame, playheadFrame, sampleTracks
      );
      expect(snapGrid.isSnapped).toBe(true);
      expect(snapGrid.snappedFrame).toBe(210);
      expect(snapGrid.target?.type).toBe('grid');
    });
  });
});
