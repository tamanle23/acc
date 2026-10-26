import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TrackHeaderCard } from './TrackHeaderCard';
import { TimelineWorkerBridge } from '../../lib/timeline/TimelineWorkerBridge';
import { WebAudioEngine } from '../../lib/audio/WebAudioEngine';
import {
  TimelinePointerStateMachine,
  type GhostDragState,
} from '../../lib/timeline/interaction/TimelinePointerStateMachine';
import type { HitTestTrack } from '../../lib/timeline/interaction/TimelineHitTester';
import type { TimelineRenderModel, ClipLayoutEntry } from '../../workers/timelineTypes';

export interface TimelineCanvasProps {
  tracks: any[];
  lockedTracks: Record<string, boolean>;
  mutedTracks: Record<string, boolean>;
  onToggleLock: (trackId: string) => void;
  onToggleMute: (trackId: string) => void;
  selectedSeqId: string | null;
  activeTool: 'select' | 'razor' | 'hand';
  snapEnabled: boolean;
  fps: number;
  totalFrames: number;
  pixelsPerFrame: number;
  timelineWidth: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollLeft: number;
  clientWidth: number;
  currentFrame: number;
  onCursorChange: (cursor: string) => void;
  onRazorHoverFrameChange: (frame: number | null) => void;
  onTimecodeHUDChange: (hud: any) => void;
  onActiveSnapGuidelineChange: (guideline: { frame: number; label?: string; isAbut?: boolean } | null) => void;
}

export function TimelineCanvas({
  tracks,
  lockedTracks,
  mutedTracks,
  onToggleLock,
  onToggleMute,
  selectedSeqId,
  activeTool,
  snapEnabled,
  fps,
  totalFrames,
  pixelsPerFrame,
  timelineWidth,
  scrollContainerRef,
  scrollLeft,
  clientWidth,
  currentFrame,
  onCursorChange,
  onRazorHoverFrameChange,
  onTimecodeHUDChange,
  onActiveSnapGuidelineChange,
}: TimelineCanvasProps) {
  const offscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerBridgeRef = useRef<TimelineWorkerBridge | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [canvasCursor, setCanvasCursor] = useState<string>('default');
  const [canvasGhostDrag, setCanvasGhostDrag] = useState<GhostDragState | null>(null);

  // TanStack Vertical Track Virtualization for sticky track headers
  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 48,
    overscan: 4,
  });

  // Design Pattern: State Machine for pointer interactions in Canvas Mode
  const pointerStateMachineRef = useRef<TimelinePointerStateMachine | null>(null);
  if (!pointerStateMachineRef.current) {
    pointerStateMachineRef.current = new TimelinePointerStateMachine({
      onCursorChange: (c) => {
        setCanvasCursor(c);
        onCursorChange(c);
      },
      onGhostUpdate: (ghost) => setCanvasGhostDrag(ghost),
      onSnapGuideline: (g, label) => onActiveSnapGuidelineChange(g !== null ? { frame: g, label } : null),
      onTimecodeHUD: (hud) => onTimecodeHUDChange(hud),
    });
  }

  // Keep state machine synced with tools & snap
  useEffect(() => {
    if (pointerStateMachineRef.current) {
      pointerStateMachineRef.current.setToolMode(
        activeTool === 'razor' ? 'scissors' : activeTool === 'hand' ? 'hand' : 'select'
      );
      pointerStateMachineRef.current.setSnappingEnabled(snapEnabled);
    }
  }, [activeTool, snapEnabled]);

  // Convert tracks to HitTestTrack[] format for pure State Machine & HitTester
  const hitTestTracks: HitTestTrack[] = tracks.map((t: any) => ({
    id: t.id,
    type: t.type || 'video',
    sequences: Array.isArray(t.sequences) ? t.sequences : [],
  }));

  // Update OffscreenCanvas model and viewport in worker
  useEffect(() => {
    const canvas = offscreenCanvasRef.current;
    if (!canvas) return;

    if (!workerBridgeRef.current) {
      workerBridgeRef.current = new TimelineWorkerBridge();
    }
    const bridge = workerBridgeRef.current;

    const clips: ClipLayoutEntry[] = [];
    tracks.forEach((track: any, trackIndex: number) => {
      if (Array.isArray(track.sequences)) {
        track.sequences.forEach((seq: any) => {
          const sStart = seq.startFrame ?? seq.timelineStartFrame ?? 0;
          const isAudio = track.type === 'audio';
          let peaks: number[] | undefined;
          let thumbnailUrl: string | undefined;

          if (isAudio) {
            const raw = WebAudioEngine.getInstance().getWaveformPeaks(
              seq.assetId || seq.id,
              seq.durationFrames,
              120
            );
            peaks = Array.from(raw);
          } else {
            thumbnailUrl = seq.assetId || seq.id;
          }

          clips.push({
            id: seq.id,
            trackId: track.id,
            startFrame: sStart,
            durationFrames: seq.durationFrames,
            endFrame: sStart + seq.durationFrames,
            trackIndex,
            type: track.type || 'video',
            color: track.type === 'audio' ? '#a855f7' : '#3b82f6',
            name: seq.id,
            peaks,
            thumbnailUrl,
          });
        });
      }
    });

    const model: TimelineRenderModel = {
      tracks: tracks.map((t: any) => ({
        id: t.id,
        type: t.type || 'video',
        name: t.id,
        isLocked: lockedTracks[t.id],
        isMuted: mutedTracks[t.id],
      })),
      clips,
      totalFrames,
      fps,
      mode: 'canvas',
      selectedClipId: selectedSeqId,
      ghostDrag: canvasGhostDrag
        ? {
            seqId: canvasGhostDrag.seqId,
            startFrame: canvasGhostDrag.currentStartFrame,
            durationFrames: canvasGhostDrag.currentDurationFrames,
            trackIndex: canvasGhostDrag.targetTrackIndex,
            isValid: canvasGhostDrag.isValidDrop,
            ghostType: canvasGhostDrag.type,
            handle: canvasGhostDrag.handle,
            dropMessage: canvasGhostDrag.dropMessage,
          }
        : null,
    };

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1.0 : 1.0;
    const initialViewport = {
      scrollLeft: scrollContainerRef.current?.scrollLeft || 0,
      scrollTop: scrollContainerRef.current?.scrollTop || 0,
      viewportWidth: scrollContainerRef.current?.clientWidth || 1200,
      viewportHeight: Math.max(300, tracks.length * 48),
      pixelsPerFrame,
      dpr,
    };

    if (bridge.supportsOffscreen() && !bridge.hasTransferred?.()) {
      const initialized = bridge.init(canvas, model, initialViewport);
      if (!initialized && (canvas as any).__transferred) {
        setCanvasKey((k) => k + 1);
      }
    } else {
      bridge.updateModel(model);
      bridge.updateViewport(initialViewport);
    }
  }, [
    tracks,
    lockedTracks,
    mutedTracks,
    totalFrames,
    fps,
    pixelsPerFrame,
    canvasKey,
    selectedSeqId,
    canvasGhostDrag,
    scrollContainerRef,
  ]);

  useEffect(() => {
    return () => {
      if (workerBridgeRef.current) {
        workerBridgeRef.current.dispose();
        workerBridgeRef.current = null;
      }
    };
  }, []);

  // Update worker viewport on scroll/resize
  useEffect(() => {
    if (workerBridgeRef.current && scrollContainerRef.current) {
      workerBridgeRef.current.updateViewport({
        scrollLeft,
        viewportWidth: clientWidth,
      });
    }
  }, [scrollLeft, clientWidth, scrollContainerRef]);

  // Pointer event handlers wired directly to TimelinePointerStateMachine
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const localPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    pointerStateMachineRef.current?.handlePointerDown(
      localPoint,
      scrollLeft,
      0,
      pixelsPerFrame,
      40, // 40px rowHeight
      hitTestTracks,
      currentFrame
    );
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const localPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (activeTool === 'razor') {
      const frameAtPointer = Math.max(0, Math.floor((localPoint.x + scrollLeft) / pixelsPerFrame));
      onRazorHoverFrameChange(frameAtPointer);
    } else {
      onRazorHoverFrameChange(null);
    }

    pointerStateMachineRef.current?.handlePointerMove(
      localPoint,
      scrollLeft,
      0,
      pixelsPerFrame,
      40,
      hitTestTracks,
      currentFrame
    );
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if pointer was not captured
    }
    onRazorHoverFrameChange(null);
    pointerStateMachineRef.current?.handlePointerUp();
  };

  return (
    <div
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        width: `${timelineWidth + 208}px`,
        position: 'relative',
      }}
    >
      {/* OffscreenCanvas Background Track Renderer (Worker accelerated) */}
      <canvas
        key={canvasKey}
        ref={offscreenCanvasRef}
        className="absolute top-0 left-52 pointer-events-none z-10"
        style={{
          width: `${timelineWidth}px`,
          height: `${Math.max(120, rowVirtualizer.getTotalSize())}px`,
        }}
      />

      {/* Transparent Pointer Interaction Overlay */}
      <canvas
        className="absolute top-0 left-52 z-25"
        style={{
          width: `${timelineWidth}px`,
          height: `${Math.max(120, rowVirtualizer.getTotalSize())}px`,
          cursor: canvasCursor,
        }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
      />

      {/* Virtualized Sticky Track Header Cards */}
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const track = tracks[virtualRow.index];
        if (!track) return null;
        const idx = virtualRow.index;
        const isLocked = lockedTracks[track.id] || false;
        const isMuted = mutedTracks[track.id] || false;
        const canMoveUp = idx > 0;
        const canMoveDown = idx < tracks.length - 1;

        return (
          <div
            key={track.id}
            style={{
              position: 'absolute',
              top: `${virtualRow.start}px`,
              left: 0,
              width: `${timelineWidth + 208}px`,
              height: '40px',
            }}
            className="h-10 flex items-center gap-2 bg-transparent pointer-events-none"
          >
            {/* Sticky Track Header Card */}
            <div className="pointer-events-auto h-full flex items-center">
              <TrackHeaderCard
                track={track}
                isLocked={isLocked}
                isMuted={isMuted}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onToggleLock={onToggleLock}
                onToggleMute={onToggleMute}
              />
            </div>
            {/* Placeholder lane slot matching canvas coordinates */}
            <div style={{ width: `${timelineWidth}px` }} className="h-full shrink-0" />
          </div>
        );
      })}
    </div>
  );
}
