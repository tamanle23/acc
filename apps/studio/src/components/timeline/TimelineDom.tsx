import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  DragOverlay,
  useDndMonitor,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { TrackHeaderCard } from './TrackHeaderCard';
import { DroppableTrackLane } from './DroppableTrackLane';
import { ClipItem } from './ClipItem';
import { ClipDragProxy } from './ClipDragProxy';
import { TimelineSnapCalculator } from '../../lib/timeline/interaction/TimelineSnapCalculator';
import { IRStateManager } from '../../lib/ir/irState';
import {
  getSequenceDurationFrames,
  getSequenceStartFrame,
  type StudioSequence,
  type StudioTrack,
} from '../../lib/ir/studioTypes';
import type { ModifierNode } from '@acc/ir';

export interface TimelineDomProps {
  tracks: StudioTrack[];
  lockedTracks: Record<string, boolean>;
  mutedTracks: Record<string, boolean>;
  onToggleLock: (trackId: string) => void;
  onToggleMute: (trackId: string) => void;
  onToggleVisible?: (trackId: string) => void;
  selectedSeqId: string | null;
  activeTool: 'select' | 'razor' | 'hand';
  fps: number;
  totalFrames: number;
  pixelsPerFrame: number;
  timelineWidth: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollLeft: number;
  clientWidth: number;
  snapEnabled: boolean;
  rippleEnabled: boolean;
  currentFrame: number;
  onActiveSnapGuidelineChange: (guideline: { frame: number; label?: string; isAbut?: boolean } | null) => void;
  onHoveredClipChange: (clip: unknown) => void;
}

export function TimelineDom({
  tracks,
  lockedTracks,
  mutedTracks,
  onToggleLock,
  onToggleMute,
  selectedSeqId,
  activeTool,
  fps,
  totalFrames,
  pixelsPerFrame,
  timelineWidth,
  scrollContainerRef,
  scrollLeft,
  clientWidth,
  snapEnabled,
  rippleEnabled,
  currentFrame,
  onActiveSnapGuidelineChange,
  onHoveredClipChange,
}: TimelineDomProps) {
  // Unified @dnd-kit Drag State for Timeline Clips & Trim Handles
  const [activeDragState, setActiveDragState] = useState<{
    type: 'clip' | 'trim';
    seqId: string;
    pairedSeqId?: string | null;
    handle?: 'start' | 'end';
    initialStartFrame: number;
    initialDurationFrames: number;
    deltaFrames: number;
    snappedStartFrame: number;
    sourceTrackId?: string;
    targetTrackId?: string;
    isInvalidDrop?: boolean;
    snapLabel?: string | null;
    activeSeq?: StudioSequence;
    activeTrack?: StudioTrack;
  } | null>(null);

  // rAF Throttle for DragMove to prevent state thrashing during 144Hz high-frequency mouse moves
  const dragRafRef = useRef<number | null>(null);

  useDndMonitor({
    onDragStart: (e) => handleDragStart(e),
    onDragMove: (e) => handleDragMove(e),
    onDragEnd: (e) => handleDragEnd(e),
    onDragCancel: () => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      onActiveSnapGuidelineChange(null);
      setActiveDragState(null);
    },
  });

  useEffect(() => {
    return () => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
      }
    };
  }, []);

  // Horizontal Sequence Virtualization (Active drag & paired sequences are never culled)
  const bufferFrames = Math.ceil(400 / pixelsPerFrame);
  const visibleStartFrame = Math.max(0, Math.floor(scrollLeft / pixelsPerFrame) - bufferFrames);
  const visibleEndFrame = Math.ceil((scrollLeft + clientWidth) / pixelsPerFrame) + bufferFrames;

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (!data) return;

    if (data.type === 'clip') {
      const seq = data.seq as StudioSequence;
      // Detect paired A/V linked sequence
      let pairedSeqId: string | null = null;
      const avLink = seq.modifiers?.find((m: ModifierNode) => m.type === 'editorial/av_link');
      if (avLink && avLink.params?.enabled !== false && avLink.params?.linkedSequenceId) {
        pairedSeqId = avLink.params.linkedSequenceId as string;
      }

      const initialStart = getSequenceStartFrame(seq);
      const initialDuration = getSequenceDurationFrames(seq, 30);
      const sourceTrack = tracks.find((t) => t.id === data.trackId);

      setActiveDragState({
        type: 'clip',
        seqId: seq.id,
        pairedSeqId,
        initialStartFrame: initialStart,
        initialDurationFrames: initialDuration,
        deltaFrames: 0,
        snappedStartFrame: initialStart,
        sourceTrackId: data.trackId as string,
        targetTrackId: data.trackId as string,
        isInvalidDrop: false,
        snapLabel: null,
        activeSeq: seq,
        activeTrack: sourceTrack,
      });
      IRStateManager.getInstance().setSelectedSequenceId(seq.id);
    } else if (data.type === 'trim') {
      const seq = data.seq as StudioSequence;
      const initialStart = getSequenceStartFrame(seq);
      const initialDuration = getSequenceDurationFrames(seq, 30);
      setActiveDragState({
        type: 'trim',
        handle: data.handle as 'start' | 'end',
        seqId: seq.id,
        initialStartFrame: initialStart,
        initialDurationFrames: initialDuration,
        deltaFrames: 0,
        snappedStartFrame: initialStart,
        isInvalidDrop: false,
        snapLabel: null,
        activeSeq: seq,
      });
      IRStateManager.getInstance().setSelectedSequenceId(seq.id);
    }
  };

  const handleDragMove = (e: DragMoveEvent) => {
    if (!activeDragState) return;

    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
    }

    const deltaX = e.delta.x;
    const overTrackIdFromEvent = (e.over?.data?.current as { trackId?: string } | undefined)?.trackId;

    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      const rawDeltaFrames = Math.round(deltaX / pixelsPerFrame);

      if (activeDragState.type === 'clip') {
        const overTrackId = overTrackIdFromEvent || activeDragState.targetTrackId;
        const rawTargetStart = Math.max(0, activeDragState.initialStartFrame + rawDeltaFrames);

        // Validate track compatibility: audio sequences stay on audio tracks, visual on visual
        const sourceTrack = tracks.find((t) => t.id === activeDragState.sourceTrackId);
        const targetTrack = tracks.find((t) => t.id === overTrackId);
        const isSourceAudio = sourceTrack?.type === 'audio' || activeDragState.activeSeq?.type === 'audio';
        const isTargetAudio = targetTrack?.type === 'audio';
        const isInvalidDrop = Boolean(targetTrack && isSourceAudio !== isTargetAudio);

        let targetStart = rawTargetStart;
        let snapGuideline: number | null = null;
        let snapLabel: string | null = null;

        if (snapEnabled && !isInvalidDrop) {
          const snapRes = TimelineSnapCalculator.calculateSnap({
            targetStart: rawTargetStart,
            durationFrames: activeDragState.initialDurationFrames,
            pixelsPerFrame,
            playheadFrame: currentFrame,
            tracks,
            excludeSeqIds: [
              activeDragState.seqId,
              ...(activeDragState.pairedSeqId ? [activeDragState.pairedSeqId] : []),
            ],
            activeGuidelineFrame: activeDragState.snapLabel ? activeDragState.snappedStartFrame : null,
          });

          if (snapRes.isSnapped) {
            targetStart = snapRes.snappedFrame;
            snapGuideline = snapRes.guidelineFrame;
            snapLabel = snapRes.label;
          }
        }

        onActiveSnapGuidelineChange(snapGuideline !== null ? { frame: snapGuideline, label: snapLabel || undefined } : null);

        const deltaFrames = targetStart - activeDragState.initialStartFrame;
        setActiveDragState((prev) =>
          prev
            ? {
                ...prev,
                deltaFrames,
                snappedStartFrame: targetStart,
                targetTrackId: overTrackId,
                isInvalidDrop,
                snapLabel,
              }
            : null
        );
      } else if (activeDragState.type === 'trim') {
        let deltaFrames = rawDeltaFrames;
        let snappedGuideline: number | null = null;

        if (snapEnabled) {
          const snapThresholdFrames = Math.max(1, Math.round(8 / pixelsPerFrame));
          const snapPoints: number[] = [currentFrame];
          for (const track of tracks) {
            for (const s of track.sequences) {
              if (s.id !== activeDragState.seqId) {
                const sStart = getSequenceStartFrame(s);
                const sDur = getSequenceDurationFrames(s, 30);
                snapPoints.push(sStart, sStart + sDur);
              }
            }
          }

          if (activeDragState.handle === 'start') {
            const rawTarget = activeDragState.initialStartFrame + deltaFrames;
            let closestDist = Infinity;
            for (const sp of snapPoints) {
              const dist = Math.abs(rawTarget - sp);
              if (dist <= snapThresholdFrames && dist < closestDist) {
                closestDist = dist;
                deltaFrames = sp - activeDragState.initialStartFrame;
                snappedGuideline = sp;
              }
            }
          } else {
            const rawTarget =
              activeDragState.initialStartFrame + activeDragState.initialDurationFrames + deltaFrames;
            let closestDist = Infinity;
            for (const sp of snapPoints) {
              const dist = Math.abs(rawTarget - sp);
              if (dist <= snapThresholdFrames && dist < closestDist) {
                closestDist = dist;
                deltaFrames =
                  sp - (activeDragState.initialStartFrame + activeDragState.initialDurationFrames);
                snappedGuideline = sp;
              }
            }
          }
        }

        onActiveSnapGuidelineChange(snappedGuideline !== null ? { frame: snappedGuideline } : null);
        setActiveDragState((prev) => (prev ? { ...prev, deltaFrames } : null));
      }
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    onActiveSnapGuidelineChange(null);
    if (!activeDragState) return;

    if (activeDragState.type === 'clip') {
      const targetTrackId =
        (e.over?.data?.current as { trackId?: string } | undefined)?.trackId || activeDragState.targetTrackId;
      const targetStartFrame = Math.max(
        0,
        activeDragState.snappedStartFrame ?? (activeDragState.initialStartFrame + activeDragState.deltaFrames)
      );

      const targetTrack = tracks.find((t) => t.id === targetTrackId);
      const isLocked = targetTrackId ? lockedTracks[targetTrackId] : false;

      if (targetTrackId && targetTrack && !isLocked && !activeDragState.isInvalidDrop) {
        // Professional track-scoped Ripple Push / Insert
        IRStateManager.getInstance().rippleMoveSequence(
          activeDragState.seqId,
          targetTrackId,
          targetStartFrame
        );
      }
    } else if (activeDragState.type === 'trim') {
      const dStart = activeDragState.handle === 'start' ? activeDragState.deltaFrames : 0;
      const dDur =
        activeDragState.handle === 'start'
          ? -activeDragState.deltaFrames
          : activeDragState.deltaFrames;

      if (rippleEnabled) {
        IRStateManager.getInstance().rippleTrimSequence(
          activeDragState.seqId,
          dStart,
          dDur
        );
      } else {
        IRStateManager.getInstance().trimSequence(
          activeDragState.seqId,
          dStart,
          dDur
        );
      }
    }

    setActiveDragState(null);
  };

  const handleClipClick = useCallback(
    (seq: StudioSequence, e: React.MouseEvent) => {
      e.stopPropagation();
      if (activeTool === 'razor') {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickPx = e.clientX - rect.left;
        const sStart = getSequenceStartFrame(seq);
        const sDuration = getSequenceDurationFrames(seq, 30);
        const clickedFrame = Math.max(
          sStart + 1,
          Math.min(
            sStart + sDuration - 1,
            sStart + Math.round(clickPx / pixelsPerFrame)
          )
        );
        IRStateManager.getInstance().splitSequence(seq.id, clickedFrame);
      } else {
        IRStateManager.getInstance().setSelectedSequenceId(seq.id);
      }
    },
    [activeTool, pixelsPerFrame]
  );

  const getTrackBadgeStyle = useCallback((track: StudioTrack) => {
    if (track.type === 'audio') return 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200 shadow-emerald-950/30';
    if (track.id.includes('v2') || track.id.includes('depth') || track.id.includes('vfx')) return 'bg-amber-950/85 border-amber-500/50 text-amber-200 shadow-amber-950/30';
    if (track.type === 'overlay' || track.type === 'timed_text' || track.id.includes('text') || track.id.includes('sub')) return 'bg-violet-950/85 border-violet-500/50 text-violet-200 shadow-violet-950/30';
    if (track.type === 'video') return 'bg-indigo-950/85 border-indigo-500/50 text-indigo-200 shadow-indigo-950/30';
    return 'bg-muted/85 border-glass-border text-foreground shadow-sm';
  }, []);

  const handleClipHover = useCallback(
    (
      hoverData: {
        seq: StudioSequence;
        track: StudioTrack;
        position: { leftPx: number; topPx: number; widthPx: number };
      } | null
    ) => {
      if (hoverData) {
        onHoveredClipChange({
          ...hoverData,
          fps,
        });
      } else {
        onHoveredClipChange(null);
      }
    },
    [fps, onHoveredClipChange]
  );

  return (
    <>
      <div
        style={{
          width: `${timelineWidth + 208}px`,
        }}
        className="flex flex-col gap-1 relative"
      >
        {tracks.map((track: StudioTrack, idx: number) => {
          const isLocked = lockedTracks[track.id] ?? track.locked ?? false;
          const isMuted = mutedTracks[track.id] ?? track.muted ?? false;
          const isVisible = track.visible !== false;
          const canMoveUp = idx > 0;
          const canMoveDown = idx < tracks.length - 1;

          // Horizontal sequence virtualization (Preserve dragged clip & paired A/V clip)
          const visibleSequences = track.sequences.filter((seq: StudioSequence) => {
            if (activeDragState?.seqId === seq.id || activeDragState?.pairedSeqId === seq.id) return true;
            const seqStart = getSequenceStartFrame(seq);
            const seqEnd = seqStart + getSequenceDurationFrames(seq, 30);
            return seqEnd >= visibleStartFrame && seqStart <= visibleEndFrame;
          });

          const isInvalidDropOverThisTrack =
            Boolean(activeDragState?.isInvalidDrop && activeDragState.targetTrackId === track.id);

          return (
            <div
              key={track.id}
              style={{
                width: `${timelineWidth + 208}px`,
                height: '40px',
              }}
              className="h-10 flex items-center gap-2 bg-[var(--glass-bg)] shrink-0"
            >
              {/* Sticky Track Header Card */}
              <TrackHeaderCard
                track={track}
                isLocked={isLocked}
                isMuted={isMuted}
                isVisible={isVisible}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onToggleLock={onToggleLock}
                onToggleMute={onToggleMute}
                onToggleVisible={onToggleVisible}
              />

              {/* Track Sequence Lane: Render DOM clips with CSS content-visibility optimization */}
              <div style={{ width: `${timelineWidth}px` }} className="h-full shrink-0">
                <DroppableTrackLane
                  track={track}
                  isLocked={isLocked}
                  isInvalidDrop={isInvalidDropOverThisTrack}
                  scrollLeft={scrollLeft}
                  viewportWidth={clientWidth}
                  pixelsPerFrame={pixelsPerFrame}
                  fps={fps}
                >
                  {visibleSequences.map((seq: StudioSequence) => {
                    const isSeqDragged = activeDragState?.seqId === seq.id;
                    const isSeqPairedDrag = activeDragState?.pairedSeqId === seq.id;
                    return (
                      <ClipItem
                        key={seq.id}
                        seq={seq}
                        track={track}
                        fps={fps}
                        pixelsPerFrame={pixelsPerFrame}
                        isSelected={selectedSeqId === seq.id}
                        activeTool={activeTool}
                        getTrackBadgeStyle={getTrackBadgeStyle}
                        onClipClick={handleClipClick}
                        onClipHover={handleClipHover}
                        isBeingDragged={isSeqDragged}
                        isPairedDrag={isSeqPairedDrag}
                        dragType={isSeqDragged ? activeDragState?.type ?? null : null}
                        trimHandle={isSeqDragged ? activeDragState?.handle : undefined}
                        trimDeltaFrames={isSeqDragged ? activeDragState?.deltaFrames ?? 0 : 0}
                        isAnyDragActive={Boolean(activeDragState)}
                      />
                    );
                  })}
                </DroppableTrackLane>
              </div>
            </div>
          );
        })}
      </div>

      {/* Elevated Portal Drag Proxy: Unclipped, follows pointer with grab offset */}
      <DragOverlay dropAnimation={null}>
        {activeDragState?.type === 'clip' && activeDragState.activeSeq ? (
          <ClipDragProxy
            seq={activeDragState.activeSeq}
            track={activeDragState.activeTrack}
            pixelsPerFrame={pixelsPerFrame}
            deltaFrames={activeDragState.deltaFrames}
            snappedStartFrame={activeDragState.snappedStartFrame}
            isInvalidDrop={activeDragState.isInvalidDrop}
            snapLabel={activeDragState.snapLabel}
            getTrackBadgeStyle={getTrackBadgeStyle}
          />
        ) : null}
      </DragOverlay>
    </>
  );
}
