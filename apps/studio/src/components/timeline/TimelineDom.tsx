import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
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

export interface TimelineDomProps {
  tracks: any[];
  lockedTracks: Record<string, boolean>;
  mutedTracks: Record<string, boolean>;
  onToggleLock: (trackId: string) => void;
  onToggleMute: (trackId: string) => void;
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
  onHoveredClipChange: (clip: any) => void;
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
    activeSeq?: any;
    activeTrack?: any;
  } | null>(null);

  const timelineSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  // Horizontal Sequence Virtualization (Active drag & paired sequences are never culled)
  const bufferFrames = Math.ceil(400 / pixelsPerFrame);
  const visibleStartFrame = Math.max(0, Math.floor(scrollLeft / pixelsPerFrame) - bufferFrames);
  const visibleEndFrame = Math.ceil((scrollLeft + clientWidth) / pixelsPerFrame) + bufferFrames;

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (!data) return;

    if (data.type === 'clip') {
      const seq = data.seq;
      // Detect paired A/V linked sequence
      let pairedSeqId: string | null = null;
      const avLink = seq.modifiers?.find((m: any) => m.type === 'editorial/av_link');
      if (avLink && avLink.params?.enabled !== false && avLink.params?.linkedSequenceId) {
        pairedSeqId = avLink.params.linkedSequenceId as string;
      }

      const initialStart = seq.startFrame ?? seq.timelineStartFrame ?? 0;
      const sourceTrack = tracks.find((t) => t.id === data.trackId);

      setActiveDragState({
        type: 'clip',
        seqId: seq.id,
        pairedSeqId,
        initialStartFrame: initialStart,
        initialDurationFrames: seq.durationFrames,
        deltaFrames: 0,
        snappedStartFrame: initialStart,
        sourceTrackId: data.trackId,
        targetTrackId: data.trackId,
        isInvalidDrop: false,
        snapLabel: null,
        activeSeq: seq,
        activeTrack: sourceTrack,
      });
      IRStateManager.getInstance().setSelectedSequenceId(seq.id);
    } else if (data.type === 'trim') {
      setActiveDragState({
        type: 'trim',
        handle: data.handle,
        seqId: data.seq.id,
        initialStartFrame: data.seq.startFrame ?? data.seq.timelineStartFrame ?? 0,
        initialDurationFrames: data.seq.durationFrames,
        deltaFrames: 0,
        snappedStartFrame: data.seq.startFrame ?? data.seq.timelineStartFrame ?? 0,
        isInvalidDrop: false,
        snapLabel: null,
        activeSeq: data.seq,
      });
      IRStateManager.getInstance().setSelectedSequenceId(data.seq.id);
    }
  };

  const handleDragMove = (e: DragMoveEvent) => {
    if (!activeDragState) return;

    const rawDeltaFrames = Math.round(e.delta.x / pixelsPerFrame);

    if (activeDragState.type === 'clip') {
      const overTrackId = (e.over?.data?.current as any)?.trackId || activeDragState.targetTrackId;
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
              snapPoints.push(s.startFrame, s.startFrame + s.durationFrames);
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
  };

  const handleDragEnd = (e: DragEndEvent) => {
    onActiveSnapGuidelineChange(null);
    if (!activeDragState) return;

    if (activeDragState.type === 'clip') {
      const targetTrackId =
        (e.over?.data?.current as any)?.trackId || activeDragState.targetTrackId;
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

  const handleClipClick = (seq: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTool === 'razor') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickPx = e.clientX - rect.left;
      const sStart = (seq as any).startFrame ?? (seq as any).timelineStartFrame ?? 0;
      const clickedFrame = Math.max(
        sStart + 1,
        Math.min(
          sStart + seq.durationFrames - 1,
          sStart + Math.round(clickPx / pixelsPerFrame)
        )
      );
      IRStateManager.getInstance().splitSequence(seq.id, clickedFrame);
    } else {
      IRStateManager.getInstance().setSelectedSequenceId(seq.id);
    }
  };

  const getTrackBadgeStyle = (track: any) => {
    if (track.type === 'audio') return 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200 shadow-emerald-950/30';
    if (track.id.includes('v2') || track.id.includes('depth') || track.id.includes('vfx')) return 'bg-amber-950/85 border-amber-500/50 text-amber-200 shadow-amber-950/30';
    if (track.type === 'overlay' || track.type === 'timed_text' || track.id.includes('text') || track.id.includes('sub')) return 'bg-violet-950/85 border-violet-500/50 text-violet-200 shadow-violet-950/30';
    if (track.type === 'video') return 'bg-indigo-950/85 border-indigo-500/50 text-indigo-200 shadow-indigo-950/30';
    return 'bg-muted/85 border-glass-border text-foreground shadow-sm';
  };

  return (
    <DndContext
      sensors={timelineSensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          width: `${timelineWidth + 208}px`,
        }}
        className="flex flex-col gap-1 relative"
      >
        {tracks.map((track: any, idx: number) => {
          const isLocked = lockedTracks[track.id] || false;
          const isMuted = mutedTracks[track.id] || false;
          const canMoveUp = idx > 0;
          const canMoveDown = idx < tracks.length - 1;

          // Horizontal sequence virtualization (Preserve dragged clip & paired A/V clip)
          const visibleSequences = track.sequences.filter((seq: any) => {
            if (activeDragState?.seqId === seq.id || activeDragState?.pairedSeqId === seq.id) return true;
            const seqStart = (seq as any).startFrame ?? (seq as any).timelineStartFrame ?? 0;
            const seqEnd = seqStart + seq.durationFrames;
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
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onToggleLock={onToggleLock}
                onToggleMute={onToggleMute}
              />

              {/* Track Sequence Lane: Render DOM clips with CSS content-visibility optimization */}
              <div style={{ width: `${timelineWidth}px` }} className="h-full shrink-0">
                <DroppableTrackLane
                  track={track}
                  isLocked={isLocked}
                  isInvalidDrop={isInvalidDropOverThisTrack}
                >
                  {visibleSequences.map((seq: any) => (
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
                      onClipHover={(hoverData) => {
                        if (hoverData) {
                          onHoveredClipChange({
                            ...hoverData,
                            fps,
                          });
                        } else {
                          onHoveredClipChange(null);
                        }
                      }}
                      activeDragState={activeDragState}
                    />
                  ))}
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
    </DndContext>
  );
}
