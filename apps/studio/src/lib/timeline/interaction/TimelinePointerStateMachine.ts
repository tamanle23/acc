import { TimelineHitTester, type HitTestTrack, type TimelineHitTestResult } from './TimelineHitTester';
import { TimelineMagneticSnapService, type SnapResult } from './TimelineMagneticSnapService';
import {
  TimelineCommandDispatcher,
  SelectClipCommand,
  MoveClipCommand,
  TrimClipCommand,
  RazorCutCommand,
} from '../commands/TimelineCommands';

export type PointerToolMode = 'select' | 'scissors' | 'hand';

export interface GhostDragState {
  type: 'clip' | 'trim';
  seqId: string;
  initialStartFrame: number;
  initialDurationFrames: number;
  currentStartFrame: number;
  currentDurationFrames: number;
  sourceTrackId: string;
  targetTrackId: string;
  targetTrackIndex: number;
  isValidDrop: boolean;
  deltaFrames: number;
  handle?: 'start' | 'end';
}

export interface PointerStateMachineListener {
  onCursorChange?: (cursor: string) => void;
  onGhostUpdate?: (ghost: GhostDragState | null) => void;
  onSnapGuideline?: (frame: number | null) => void;
  onTimecodeHUD?: (hud: { frame: number; deltaFrames: number } | null) => void;
}

export class TimelinePointerStateMachine {
  private currentState: 'IDLE' | 'DRAGGING_CLIP' | 'TRIMMING_CLIP' = 'IDLE';
  private toolMode: PointerToolMode = 'select';
  private isSnappingEnabled: boolean = true;

  // Drag session details
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private activeGhost: GhostDragState | null = null;
  private snapGuideline: number | null = null;

  constructor(private listeners: PointerStateMachineListener = {}) {}

  public setToolMode(mode: PointerToolMode): void {
    this.toolMode = mode;
  }

  public setSnappingEnabled(enabled: boolean): void {
    this.isSnappingEnabled = enabled;
  }

  public getCursor(): string {
    if (this.toolMode === 'scissors') return 'crosshair';
    if (this.toolMode === 'hand') return 'grab';
    if (this.currentState === 'DRAGGING_CLIP') return 'grabbing';
    if (this.currentState === 'TRIMMING_CLIP') return 'col-resize';
    return 'default';
  }

  public getGhostState(): GhostDragState | null {
    return this.activeGhost;
  }

  public getSnapGuideline(): number | null {
    return this.snapGuideline;
  }

  /**
   * Pointer Down handler
   */
  public handlePointerDown(
    localPoint: { x: number; y: number },
    scrollLeft: number,
    scrollTop: number,
    pixelsPerFrame: number,
    rowHeight: number,
    tracks: HitTestTrack[],
    playheadFrame: number
  ): void {
    const hit = TimelineHitTester.hitTest(
      localPoint,
      scrollLeft,
      scrollTop,
      pixelsPerFrame,
      rowHeight,
      tracks
    );

    // Razor tool instant cut on click
    if (this.toolMode === 'scissors' && (hit.type === 'clip' || hit.type === 'trim-start' || hit.type === 'trim-end')) {
      if (hit.seqId && hit.frame !== undefined) {
        TimelineCommandDispatcher.getInstance().dispatch(new RazorCutCommand(hit.seqId, hit.frame));
      }
      return;
    }

    if (hit.type === 'empty-track' || hit.type === 'none') {
      // Click on background: deselect clip
      TimelineCommandDispatcher.getInstance().dispatch(new SelectClipCommand(null));
      this.currentState = 'IDLE';
      this.activeGhost = null;
      this.notifyUpdates();
      return;
    }

    if (!hit.seq || !hit.trackId || hit.trackIndex === undefined) return;

    // Select the clicked clip
    TimelineCommandDispatcher.getInstance().dispatch(new SelectClipCommand(hit.seq.id));

    const startFrame = hit.seq.startFrame ?? hit.seq.timelineStartFrame ?? 0;
    const duration = hit.seq.durationFrames;

    this.dragStartX = localPoint.x;
    this.dragStartY = localPoint.y;

    if (hit.type === 'trim-start' || hit.type === 'trim-end') {
      const handle = hit.type === 'trim-start' ? 'start' : 'end';
      this.currentState = 'TRIMMING_CLIP';
      this.activeGhost = {
        type: 'trim',
        seqId: hit.seq.id,
        initialStartFrame: startFrame,
        initialDurationFrames: duration,
        currentStartFrame: startFrame,
        currentDurationFrames: duration,
        sourceTrackId: hit.trackId,
        targetTrackId: hit.trackId,
        targetTrackIndex: hit.trackIndex,
        isValidDrop: true,
        deltaFrames: 0,
        handle,
      };
      this.listeners.onCursorChange?.('col-resize');
    } else if (hit.type === 'clip') {
      this.currentState = 'DRAGGING_CLIP';
      this.activeGhost = {
        type: 'clip',
        seqId: hit.seq.id,
        initialStartFrame: startFrame,
        initialDurationFrames: duration,
        currentStartFrame: startFrame,
        currentDurationFrames: duration,
        sourceTrackId: hit.trackId,
        targetTrackId: hit.trackId,
        targetTrackIndex: hit.trackIndex,
        isValidDrop: true,
        deltaFrames: 0,
      };
      this.listeners.onCursorChange?.('grabbing');
    }

    this.notifyUpdates();
  }

  /**
   * Pointer Move handler
   */
  public handlePointerMove(
    localPoint: { x: number; y: number },
    scrollLeft: number,
    scrollTop: number,
    pixelsPerFrame: number,
    rowHeight: number,
    tracks: HitTestTrack[],
    playheadFrame: number
  ): void {
    if (this.currentState === 'IDLE') {
      // Hover hit-test to update cursor
      const hit = TimelineHitTester.hitTest(
        localPoint,
        scrollLeft,
        scrollTop,
        pixelsPerFrame,
        rowHeight,
        tracks
      );

      if (this.toolMode === 'scissors') {
        this.listeners.onCursorChange?.('crosshair');
      } else if (hit.type === 'trim-start' || hit.type === 'trim-end') {
        this.listeners.onCursorChange?.('col-resize');
      } else if (hit.type === 'clip') {
        this.listeners.onCursorChange?.('grab');
      } else {
        this.listeners.onCursorChange?.('default');
      }
      return;
    }

    if (!this.activeGhost) return;

    const deltaX = localPoint.x - this.dragStartX;
    const rawDeltaFrames = Math.round(deltaX / pixelsPerFrame);

    if (this.currentState === 'DRAGGING_CLIP') {
      // Target track from Y position
      const worldY = localPoint.y + scrollTop;
      const targetTrackIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor(worldY / rowHeight)));
      const targetTrack = tracks[targetTrackIndex];

      // Track compatibility check: audio only on audio, video only on video
      const sourceTrack = tracks.find((t) => t.id === this.activeGhost?.sourceTrackId);
      const isAudioSource = sourceTrack?.type === 'audio' || sourceTrack?.id.toLowerCase().includes('audio');
      const isAudioTarget = targetTrack?.type === 'audio' || targetTrack?.id.toLowerCase().includes('audio');
      const isCompatibleTrack = isAudioSource === isAudioTarget;

      let candidateStart = Math.max(0, this.activeGhost.initialStartFrame + rawDeltaFrames);
      let candidateEnd = candidateStart + this.activeGhost.initialDurationFrames;

      this.snapGuideline = null;

      // Magnetic Snapping
      if (this.isSnappingEnabled) {
        const snapStart = TimelineMagneticSnapService.calculateSnap(
          candidateStart,
          pixelsPerFrame,
          playheadFrame,
          tracks,
          this.activeGhost.seqId
        );
        if (snapStart.isSnapped) {
          candidateStart = snapStart.snappedFrame;
          candidateEnd = candidateStart + this.activeGhost.initialDurationFrames;
          this.snapGuideline = snapStart.snappedFrame;
        } else {
          const snapEnd = TimelineMagneticSnapService.calculateSnap(
            candidateEnd,
            pixelsPerFrame,
            playheadFrame,
            tracks,
            this.activeGhost.seqId
          );
          if (snapEnd.isSnapped) {
            candidateStart = snapEnd.snappedFrame - this.activeGhost.initialDurationFrames;
            this.snapGuideline = snapEnd.snappedFrame;
          }
        }
      }

      // Check collisions on target track
      let hasCollision = false;
      if (targetTrack) {
        for (const seq of targetTrack.sequences) {
          if (seq.id === this.activeGhost.seqId) continue;
          const sStart = seq.startFrame ?? seq.timelineStartFrame ?? 0;
          const sEnd = sStart + seq.durationFrames;
          // Check overlap
          if (candidateStart < sEnd && candidateStart + this.activeGhost.initialDurationFrames > sStart) {
            hasCollision = true;
            break;
          }
        }
      }

      const isValidDrop = isCompatibleTrack && !hasCollision;
      const finalDelta = candidateStart - this.activeGhost.initialStartFrame;

      this.activeGhost = {
        ...this.activeGhost,
        targetTrackId: targetTrack?.id || this.activeGhost.sourceTrackId,
        targetTrackIndex,
        currentStartFrame: candidateStart,
        deltaFrames: finalDelta,
        isValidDrop,
      };

      this.listeners.onTimecodeHUD?.({
        frame: candidateStart,
        deltaFrames: finalDelta,
      });
    } else if (this.currentState === 'TRIMMING_CLIP') {
      const handle = this.activeGhost.handle || 'start';
      this.snapGuideline = null;

      if (handle === 'start') {
        let candidateStart = this.activeGhost.initialStartFrame + rawDeltaFrames;
        const maxStart = this.activeGhost.initialStartFrame + this.activeGhost.initialDurationFrames - 1; // min 1 frame
        candidateStart = Math.min(maxStart, Math.max(0, candidateStart));

        if (this.isSnappingEnabled) {
          const snap = TimelineMagneticSnapService.calculateSnap(
            candidateStart,
            pixelsPerFrame,
            playheadFrame,
            tracks,
            this.activeGhost.seqId
          );
          if (snap.isSnapped && snap.snappedFrame <= maxStart) {
            candidateStart = snap.snappedFrame;
            this.snapGuideline = snap.snappedFrame;
          }
        }

        const delta = candidateStart - this.activeGhost.initialStartFrame;
        this.activeGhost = {
          ...this.activeGhost,
          currentStartFrame: candidateStart,
          currentDurationFrames: this.activeGhost.initialDurationFrames - delta,
          deltaFrames: delta,
        };

        this.listeners.onTimecodeHUD?.({
          frame: candidateStart,
          deltaFrames: delta,
        });
      } else {
        // Trim end
        let candidateDuration = Math.max(1, this.activeGhost.initialDurationFrames + rawDeltaFrames);
        const candidateEnd = this.activeGhost.initialStartFrame + candidateDuration;

        if (this.isSnappingEnabled) {
          const snap = TimelineMagneticSnapService.calculateSnap(
            candidateEnd,
            pixelsPerFrame,
            playheadFrame,
            tracks,
            this.activeGhost.seqId
          );
          if (snap.isSnapped && snap.snappedFrame > this.activeGhost.initialStartFrame) {
            candidateDuration = snap.snappedFrame - this.activeGhost.initialStartFrame;
            this.snapGuideline = snap.snappedFrame;
          }
        }

        const delta = candidateDuration - this.activeGhost.initialDurationFrames;
        this.activeGhost = {
          ...this.activeGhost,
          currentDurationFrames: candidateDuration,
          deltaFrames: delta,
        };

        this.listeners.onTimecodeHUD?.({
          frame: this.activeGhost.initialStartFrame + candidateDuration,
          deltaFrames: delta,
        });
      }
    }

    this.notifyUpdates();
  }

  /**
   * Pointer Up handler
   */
  public handlePointerUp(): void {
    if (!this.activeGhost) {
      this.currentState = 'IDLE';
      this.snapGuideline = null;
      this.notifyUpdates();
      return;
    }

    if (this.currentState === 'DRAGGING_CLIP') {
      if (this.activeGhost.isValidDrop && this.activeGhost.deltaFrames !== 0) {
        TimelineCommandDispatcher.getInstance().dispatch(
          new MoveClipCommand(
            this.activeGhost.seqId,
            this.activeGhost.targetTrackId,
            this.activeGhost.currentStartFrame
          )
        );
      }
    } else if (this.currentState === 'TRIMMING_CLIP') {
      if (this.activeGhost.deltaFrames !== 0 && this.activeGhost.handle) {
        TimelineCommandDispatcher.getInstance().dispatch(
          new TrimClipCommand(
            this.activeGhost.seqId,
            this.activeGhost.handle,
            this.activeGhost.deltaFrames
          )
        );
      }
    }

    this.currentState = 'IDLE';
    this.activeGhost = null;
    this.snapGuideline = null;
    this.listeners.onCursorChange?.(this.getCursor());
    this.listeners.onTimecodeHUD?.(null);
    this.notifyUpdates();
  }

  private notifyUpdates(): void {
    this.listeners.onGhostUpdate?.(this.activeGhost);
    this.listeners.onSnapGuideline?.(this.snapGuideline);
  }
}
