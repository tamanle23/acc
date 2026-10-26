import React, { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TrackHeaderCard } from './TrackHeaderCard';
import { DroppableTrackLane } from './DroppableTrackLane';
import { ClipItem } from './ClipItem';
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
    sourceTrackId?: string;
    targetTrackId?: string;
    isInvalidDrop?: boolean;
    snapLabel?: string | null;
  } | null>(null);

  const timelineSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  // TanStack Vertical Track Virtualization
  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 48,
    overscan: 4,
  });

  // Horizontal Sequence Virtualization
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

      setActiveDragState({
        type: 'clip',
        seqId: seq.id,
        pairedSeqId,
        initialStartFrame: seq.startFrame ?? seq.timelineStartFrame ?? 0,
        initialDurationFrames: seq.durationFrames,
        deltaFrames: 0,
        sourceTrackId: data.trackId,
        targetTrackId: data.trackId,
        isInvalidDrop: false,
        snapLabel: null,
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
        isInvalidDrop: false,
        snapLabel: null,
      });
      IRStateManager.getInstance().setSelectedSequenceId(data.seq.id);
    }
  };

  const handleDragMove = (e: DragMoveEvent) => {
    if (!activeDragState) return;

    const rawDeltaFrames = Math.round(e.delta.x / pixelsPerFrame);

    if (activeDragState.type === 'clip') {
      const overTrackId = (e.over?.data?.current as any)?.trackId || activeDragState.targetTrackId;
      let targetStart = Math.max(0, activeDragState.initialStartFrame + rawDeltaFrames);
      let snapResult: { frame: number; label?: string; isAbut?: boolean } | null = null;

      // Validate track compatibility: audio must stay in audio, visual in visual
      const sourceTrack = tracks.find((t) => t.id === activeDragState.sourceTrackId);
      const targetTrack = tracks.find((t) => t.id === overTrackId);
      const isSourceAudio = sourceTrack?.type === 'audio';
      const isTargetAudio = targetTrack?.type === 'audio';
      const isInvalidDrop = Boolean(targetTrack && isSourceAudio !== isTargetAudio);

      if (snapEnabled && !isInvalidDrop) {
        interface SnapPointCandidate {
          frame: number;
          label?: string;
          isAbut?: boolean;
        }

        const candidatePoints: SnapPointCandidate[] = [{ frame: currentFrame, label: 'Playhead' }];

        for (const track of tracks) {
          for (const s of track.sequences) {
            if (s.id !== activeDragState.seqId && s.id !== activeDragState.pairedSeqId) {
              const sStart = (s as any).startFrame ?? (s as any).timelineStartFrame ?? 0;
              const sEnd = sStart + s.durationFrames;
              candidatePoints.push(
                { frame: sStart, label: `Abut ${s.id}`, isAbut: true },
                { frame: sEnd, label: `Abut ${s.id}`, isAbut: true }
              );
            }
          }
        }

        const totalSeconds = Math.ceil(totalFrames / fps);
        for (let sec = 0; sec <= totalSeconds; sec++) {
          candidatePoints.push({ frame: sec * fps, label: `${sec}s` });
        }

        const targetEnd = targetStart + activeDragState.initialDurationFrames;

        for (const pt of candidatePoints) {
          if (Math.abs(targetStart - pt.frame) <= 4) {
            targetStart = pt.frame;
            snapResult = pt;
            break;
          } else if (Math.abs(targetEnd - pt.frame) <= 4) {
            targetStart = pt.frame - activeDragState.initialDurationFrames;
            snapResult = pt;
            break;
          }
        }

        onActiveSnapGuidelineChange(snapResult);
      } else {
        onActiveSnapGuidelineChange(null);
      }

      const deltaFrames = targetStart - activeDragState.initialStartFrame;
      setActiveDragState((prev) =>
        prev
          ? {
              ...prev,
              deltaFrames,
              targetTrackId: overTrackId,
              isInvalidDrop,
              snapLabel: snapResult?.label || null,
            }
          : null
      );
    } else if (activeDragState.type === 'trim') {
      let deltaFrames = rawDeltaFrames;
      let snappedGuideline: number | null = null;

      if (snapEnabled) {
        const snapPoints: number[] = [currentFrame];
        for (const track of tracks) {
          for (const s of track.sequences) {
            if (s.id !== activeDragState.seqId) {
              snapPoints.push(s.startFrame, s.startFrame + s.durationFrames);
            }
          }
        }
        const totalSeconds = Math.ceil(totalFrames / fps);
        for (let sec = 0; sec <= totalSeconds; sec++) {
          snapPoints.push(sec * fps);
        }

        if (activeDragState.handle === 'start') {
          const rawTarget = activeDragState.initialStartFrame + deltaFrames;
          for (const sp of snapPoints) {
            if (Math.abs(rawTarget - sp) <= 4) {
              deltaFrames = sp - activeDragState.initialStartFrame;
              snappedGuideline = sp;
              break;
            }
          }
        } else {
          const rawTarget =
            activeDragState.initialStartFrame + activeDragState.initialDurationFrames + deltaFrames;
          for (const sp of snapPoints) {
            if (Math.abs(rawTarget - sp) <= 4) {
              deltaFrames =
                sp - (activeDragState.initialStartFrame + activeDragState.initialDurationFrames);
              snappedGuideline = sp;
              break;
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
        activeDragState.initialStartFrame + activeDragState.deltaFrames
      );

      // Verify not dropping on locked track or incompatible type
      const targetTrack = tracks.find((t) => t.id === targetTrackId);
      const isLocked = targetTrackId ? lockedTracks[targetTrackId] : false;

      if (targetTrackId && targetTrack && !isLocked && !activeDragState.isInvalidDrop) {
        // Execute track-scoped Ripple Push / Insert
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
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: `${timelineWidth + 208}px`,
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const track = tracks[virtualRow.index];
          if (!track) return null;
          const idx = virtualRow.index;
          const isLocked = lockedTracks[track.id] || false;
          const isMuted = mutedTracks[track.id] || false;
          const canMoveUp = idx > 0;
          const canMoveDown = idx < tracks.length - 1;

          // Horizontal sequence virtualization (preserve dragged clip and paired AV clip from being culled)
          const visibleSequences = track.sequences.filter((seq: any) => {
            if (activeDragState?.seqId === seq.id || activeDragState?.pairedSeqId === seq.id) return true;
            const seqStart = (seq as any).startFrame ?? (seq as any).timelineStartFrame ?? 0;
            const seqEnd = seqStart + seq.durationFrames;
            return seqEnd >= visibleStartFrame && seqStart <= visibleEndFrame;
          });

          // Check if hovering over this track is invalid
          const isInvalidDropOverThisTrack =
            Boolean(activeDragState?.isInvalidDrop && activeDragState.targetTrackId === track.id);

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
              className="h-10 flex items-center gap-2 bg-[var(--glass-bg)]"
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

              {/* Track Sequence Lane: Render DOM clips */}
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
    </DndContext>
  );
}
