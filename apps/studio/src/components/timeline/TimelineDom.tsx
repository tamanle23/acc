import { createSignal, createMemo, onCleanup, Show, For } from 'solid-js';
import { Type, Video, Music, Layers } from 'lucide-solid';
import {
  DragOverlay,
  useDragDropMonitor,
} from '@dnd-kit/solid';
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
import { type ModifierNode, VideoIRAuthoringEngine } from '@acc/ir';

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
  scrollContainerRef?: HTMLDivElement | null;
  scrollLeft: number;
  clientWidth: number;
  snapEnabled: boolean;
  rippleEnabled: boolean;
  currentFrame: number;
  onActiveSnapGuidelineChange: (guideline: { frame: number; label?: string; isAbut?: boolean } | null) => void;
  onHoveredClipChange: (clip: unknown) => void;
}

export function TimelineDom(props: TimelineDomProps) {
  // Unified @dnd-kit Drag State for Timeline Clips & Trim Handles
  const [activeDragState, setActiveDragState] = createSignal<{
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
  let dragRafRef: number | null = null;

  onCleanup(() => {
    if (dragRafRef !== null) {
      cancelAnimationFrame(dragRafRef);
      dragRafRef = null;
    }
  });

  const handleDragStart = (e: any) => {
    const data = e.operation?.source?.data || e.source?.data || e.active?.data?.current;
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
      const sourceTrack = props.tracks.find((t) => t.id === data.trackId);

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

  const handleDragMove = (e: any) => {
    const curState = activeDragState();
    if (!curState) return;

    if (dragRafRef !== null) {
      cancelAnimationFrame(dragRafRef);
    }

    const deltaX = e.operation?.transform?.x ?? e.delta?.x ?? 0;
    const overTrackIdFromEvent =
      (e.operation?.target?.data as { trackId?: string } | undefined)?.trackId ||
      (e.over?.data?.current as { trackId?: string } | undefined)?.trackId;

    dragRafRef = requestAnimationFrame(() => {
      dragRafRef = null;
      const rawDeltaFrames = Math.round(deltaX / props.pixelsPerFrame);

      if (curState.type === 'clip') {
        const overTrackId = overTrackIdFromEvent || curState.targetTrackId;
        const rawTargetStart = Math.max(0, curState.initialStartFrame + rawDeltaFrames);

        // Validate track compatibility: audio sequences stay on audio tracks, visual on visual
        const sourceTrack = props.tracks.find((t) => t.id === curState.sourceTrackId);
        const targetTrack = props.tracks.find((t) => t.id === overTrackId);
        const isSourceAudio = sourceTrack?.type === 'audio' || curState.activeSeq?.type === 'audio';
        const isTargetAudio = targetTrack?.type === 'audio';
        const isInvalidDrop = Boolean(targetTrack && isSourceAudio !== isTargetAudio);

        let targetStart = rawTargetStart;
        let snapGuideline: number | null = null;
        let snapLabel: string | null = null;

        if (props.snapEnabled && !isInvalidDrop) {
          const snapRes = TimelineSnapCalculator.calculateSnap({
            targetStart: rawTargetStart,
            durationFrames: curState.initialDurationFrames,
            pixelsPerFrame: props.pixelsPerFrame,
            playheadFrame: props.currentFrame,
            tracks: props.tracks,
            excludeSeqIds: [
              curState.seqId,
              ...(curState.pairedSeqId ? [curState.pairedSeqId] : []),
            ],
            activeGuidelineFrame: curState.snapLabel ? curState.snappedStartFrame : null,
          });

          if (snapRes.isSnapped) {
            targetStart = snapRes.snappedFrame;
            snapGuideline = snapRes.guidelineFrame;
            snapLabel = snapRes.label;
          }
        }

        props.onActiveSnapGuidelineChange(
          snapGuideline !== null ? { frame: snapGuideline, label: snapLabel || undefined } : null
        );

        const deltaFrames = targetStart - curState.initialStartFrame;
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
      } else if (curState.type === 'trim') {
        let deltaFrames = rawDeltaFrames;
        let snappedGuideline: number | null = null;

        if (props.snapEnabled) {
          const snapThresholdFrames = Math.max(1, Math.round(8 / props.pixelsPerFrame));
          const snapPoints: number[] = [props.currentFrame];
          for (const track of props.tracks) {
            for (const s of track.sequences) {
              if (s.id !== curState.seqId) {
                const sStart = getSequenceStartFrame(s);
                const sDur = getSequenceDurationFrames(s, 30);
                snapPoints.push(sStart, sStart + sDur);
              }
            }
          }

          if (curState.handle === 'start') {
            const rawTarget = curState.initialStartFrame + deltaFrames;
            let closestDist = Infinity;
            for (const sp of snapPoints) {
              const dist = Math.abs(rawTarget - sp);
              if (dist <= snapThresholdFrames && dist < closestDist) {
                closestDist = dist;
                deltaFrames = sp - curState.initialStartFrame;
                snappedGuideline = sp;
              }
            }
          } else {
            const rawTarget = curState.initialStartFrame + curState.initialDurationFrames + deltaFrames;
            let closestDist = Infinity;
            for (const sp of snapPoints) {
              const dist = Math.abs(rawTarget - sp);
              if (dist <= snapThresholdFrames && dist < closestDist) {
                closestDist = dist;
                deltaFrames = sp - (curState.initialStartFrame + curState.initialDurationFrames);
                snappedGuideline = sp;
              }
            }
          }
        }

        props.onActiveSnapGuidelineChange(snappedGuideline !== null ? { frame: snappedGuideline } : null);
        setActiveDragState((prev) => (prev ? { ...prev, deltaFrames } : null));
      }
    });
  };

  const handleDragEnd = (e: any) => {
    if (dragRafRef !== null) {
      cancelAnimationFrame(dragRafRef);
      dragRafRef = null;
    }
    props.onActiveSnapGuidelineChange(null);
    const curState = activeDragState();
    if (!curState) return;

    if (e.operation?.canceled) {
      setActiveDragState(null);
      return;
    }

    if (curState.type === 'clip') {
      const targetTrackId =
        (e.operation?.target?.data as { trackId?: string } | undefined)?.trackId ||
        (e.over?.data?.current as { trackId?: string } | undefined)?.trackId ||
        curState.targetTrackId;
      const targetStartFrame = Math.max(
        0,
        curState.snappedStartFrame ?? (curState.initialStartFrame + curState.deltaFrames)
      );

      const targetTrack = props.tracks.find((t) => t.id === targetTrackId);
      const isLocked = targetTrackId ? props.lockedTracks[targetTrackId] : false;

      if (targetTrackId && targetTrack && !isLocked && !curState.isInvalidDrop) {
        // Professional track-scoped Ripple Push / Insert
        IRStateManager.getInstance().rippleMoveSequence(
          curState.seqId,
          targetTrackId,
          targetStartFrame
        );
      }
    } else if (curState.type === 'trim') {
      const dStart = curState.handle === 'start' ? curState.deltaFrames : 0;
      const dDur =
        curState.handle === 'start'
          ? -curState.deltaFrames
          : curState.deltaFrames;

      if (props.rippleEnabled) {
        IRStateManager.getInstance().rippleTrimSequence(
          curState.seqId,
          dStart,
          dDur
        );
      } else {
        IRStateManager.getInstance().trimSequence(
          curState.seqId,
          dStart,
          dDur
        );
      }
    }

    setActiveDragState(null);
  };

  useDragDropMonitor({
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
  });

  // Horizontal Sequence Virtualization (Active drag & paired sequences are never culled)
  const bufferFrames = () => Math.ceil(400 / props.pixelsPerFrame);
  const visibleStartFrame = () => Math.max(0, Math.floor(props.scrollLeft / props.pixelsPerFrame) - bufferFrames());
  const visibleEndFrame = () => Math.ceil((props.scrollLeft + props.clientWidth) / props.pixelsPerFrame) + bufferFrames();

  const handleClipClick = (seq: StudioSequence, e: MouseEvent) => {
    e.stopPropagation();
    if (props.activeTool === 'razor') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clickPx = e.clientX - rect.left;
      const sStart = getSequenceStartFrame(seq);
      const sDuration = getSequenceDurationFrames(seq, 30);
      const clickedFrame = Math.max(
        sStart + 1,
        Math.min(
          sStart + sDuration - 1,
          sStart + Math.round(clickPx / props.pixelsPerFrame)
        )
      );
      IRStateManager.getInstance().splitSequence(seq.id, clickedFrame);
    } else {
      IRStateManager.getInstance().setSelectedSequenceId(seq.id);
    }
  };

  const getTrackBadgeStyle = (track: StudioTrack) => {
    if (track.type === 'audio') return 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200 shadow-emerald-950/30';
    if (track.id.includes('v2') || track.id.includes('depth') || track.id.includes('vfx'))
      return 'bg-amber-950/85 border-amber-500/50 text-amber-200 shadow-amber-950/30';
    if (track.type === 'overlay' || track.type === 'timed_text' || track.id.includes('text') || track.id.includes('sub'))
      return 'bg-violet-950/85 border-violet-500/50 text-violet-200 shadow-violet-950/30';
    if (track.type === 'video') return 'bg-indigo-950/85 border-indigo-500/50 text-indigo-200 shadow-indigo-950/30';
    return 'bg-muted/85 border-glass-border text-foreground shadow-sm';
  };

  const handleClipHover = (
    hoverData: {
      seq: StudioSequence;
      track: StudioTrack;
      position: { leftPx: number; topPx: number; widthPx: number };
    } | null
  ) => {
    if (hoverData) {
      props.onHoveredClipChange({
        ...hoverData,
        fps: props.fps,
      });
    } else {
      props.onHoveredClipChange(null);
    }
  };

  const quotas = createMemo(() => IRStateManager.getInstance().getTrackQuotas());

  const groupedSections = createMemo(() => {
    const grouped = VideoIRAuthoringEngine.groupTracksByType(props.tracks);
    const sections: {
      id: string;
      title: string;
      icon: any;
      tracks: StudioTrack[];
    }[] = [];

    if (grouped.timed_text.length > 0) {
      sections.push({
        id: 'section_timed_text',
        title: 'Text & Captions',
        icon: <Type class="w-3 h-3 text-violet-400" />,
        tracks: grouped.timed_text,
      });
    }

    if (grouped.video.length > 0) {
      sections.push({
        id: 'section_video',
        title: 'Video & Overlays',
        icon: <Video class="w-3 h-3 text-sky-400" />,
        tracks: grouped.video,
      });
    }

    if (grouped.audio.length > 0) {
      sections.push({
        id: 'section_audio',
        title: 'Audio Tracks',
        icon: <Music class="w-3 h-3 text-emerald-400" />,
        tracks: grouped.audio,
      });
    }

    if (grouped.data.length > 0) {
      sections.push({
        id: 'section_data',
        title: 'Data Tracks',
        icon: <Layers class="w-3 h-3 text-amber-400" />,
        tracks: grouped.data,
      });
    }

    if (sections.length === 0 && props.tracks.length > 0) {
      sections.push({
        id: 'section_default',
        title: 'Tracks',
        icon: <Video class="w-3 h-3 text-muted-foreground" />,
        tracks: props.tracks,
      });
    }

    return sections;
  });

  return (
    <>
      <div
        style={{
          width: `${props.timelineWidth + 208}px`,
        }}
        class="flex flex-col gap-1 relative"
      >
        <For each={groupedSections()}>
          {(section) => (
            <div class="flex flex-col gap-1">
              {/* Liquid Glass Modality Group Header Divider */}
              <div
                style={{ width: `${props.timelineWidth + 208}px` }}
                class="h-6 flex items-center bg-[var(--glass-bg)]/80 border-y border-[var(--glass-border)] shrink-0 px-2 mt-1 first:mt-0 select-none shadow-2xs"
              >
                <div class="sticky left-0 flex items-center justify-between w-52 pr-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div class="flex items-center gap-1.5 min-w-0">
                    {section.icon}
                    <span class="truncate">{section.title}</span>
                  </div>
                  <span class="font-mono text-[9px] text-muted-foreground/60 shrink-0">
                    {section.tracks.length}
                  </span>
                </div>
              </div>

              {/* Tracks in this Modality Group */}
              <For each={section.tracks}>
                {(track, idxInGroup) => {
                  const isLocked = () => props.lockedTracks[track.id] ?? track.locked ?? false;
                  const isMuted = () => props.mutedTracks[track.id] ?? track.muted ?? false;
                  const isVisible = () => track.visible !== false;
                  const canMoveUp = () => idxInGroup() > 0;
                  const canMoveDown = () => idxInGroup() < section.tracks.length - 1;
                  const role = () => VideoIRAuthoringEngine.classifyTrackRole(track, track.groupOrder ?? idxInGroup());
                  const quotaStatus = () => quotas()[role()];

                  // Horizontal sequence virtualization (Preserve dragged clip & paired A/V clip)
                  const visibleSequences = () =>
                    track.sequences.filter((seq: StudioSequence) => {
                      const cur = activeDragState();
                      if (cur?.seqId === seq.id || cur?.pairedSeqId === seq.id) return true;
                      const seqStart = getSequenceStartFrame(seq);
                      const seqEnd = seqStart + getSequenceDurationFrames(seq, 30);
                      return seqEnd >= visibleStartFrame() && seqStart <= visibleEndFrame();
                    });

                  const isInvalidDropOverThisTrack = () => {
                    const cur = activeDragState();
                    return Boolean(cur?.isInvalidDrop && cur?.targetTrackId === track.id);
                  };

                  return (
                    <div
                      style={{
                        width: `${props.timelineWidth + 208}px`,
                        height: '40px',
                      }}
                      class="h-10 flex items-center gap-2 bg-[var(--glass-bg)] shrink-0"
                    >
                      {/* Sticky Track Header Card */}
                      <TrackHeaderCard
                        track={track}
                        isLocked={isLocked()}
                        isMuted={isMuted()}
                        isVisible={isVisible()}
                        canMoveUp={canMoveUp()}
                        canMoveDown={canMoveDown()}
                        onToggleLock={props.onToggleLock}
                        onToggleMute={props.onToggleMute}
                        onToggleVisible={props.onToggleVisible}
                        quotaStatus={quotaStatus()}
                      />

                      {/* Track Sequence Lane */}
                      <div style={{ width: `${props.timelineWidth}px` }} class="h-full shrink-0">
                        <DroppableTrackLane
                          track={track}
                          isLocked={isLocked()}
                          isInvalidDrop={isInvalidDropOverThisTrack()}
                          scrollLeft={props.scrollLeft}
                          viewportWidth={props.clientWidth}
                          pixelsPerFrame={props.pixelsPerFrame}
                          fps={props.fps}
                        >
                          <For each={visibleSequences()}>
                            {(seq) => {
                              const isSeqDragged = () => activeDragState()?.seqId === seq.id;
                              const isSeqPairedDrag = () => activeDragState()?.pairedSeqId === seq.id;
                              return (
                                <ClipItem
                                  seq={seq}
                                  track={track}
                                  fps={props.fps}
                                  pixelsPerFrame={props.pixelsPerFrame}
                                  isSelected={props.selectedSeqId === seq.id}
                                  activeTool={props.activeTool}
                                  getTrackBadgeStyle={getTrackBadgeStyle}
                                  onClipClick={handleClipClick}
                                  onClipHover={handleClipHover}
                                  isBeingDragged={isSeqDragged()}
                                  isPairedDrag={isSeqPairedDrag()}
                                  dragType={isSeqDragged() ? activeDragState()?.type ?? null : null}
                                  trimHandle={isSeqDragged() ? activeDragState()?.handle : undefined}
                                  trimDeltaFrames={isSeqDragged() ? activeDragState()?.deltaFrames ?? 0 : 0}
                                  isAnyDragActive={Boolean(activeDragState())}
                                />
                              );
                            }}
                          </For>
                        </DroppableTrackLane>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </div>

      {/* Elevated Portal Drag Proxy: Unclipped, follows pointer with grab offset */}
      <DragOverlay dropAnimation={null}>
        <Show when={activeDragState()?.type === 'clip' && activeDragState()?.activeSeq}>
          <ClipDragProxy
            seq={activeDragState()!.activeSeq!}
            track={activeDragState()!.activeTrack}
            pixelsPerFrame={props.pixelsPerFrame}
            deltaFrames={activeDragState()!.deltaFrames}
            snappedStartFrame={activeDragState()!.snappedStartFrame}
            isInvalidDrop={activeDragState()!.isInvalidDrop}
            snapLabel={activeDragState()!.snapLabel}
            getTrackBadgeStyle={getTrackBadgeStyle}
          />
        </Show>
      </DragOverlay>
    </>
  );
}
