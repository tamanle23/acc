import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Magnet,
  Scissors,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  MousePointer,
  Hand,
  Maximize,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { Tooltip } from './ui/tooltip';
import { Toggle } from './ui/toggle';
import { Separator } from './ui/separator';
import { AudioWaveform } from './timeline/AudioWaveform';
import { TimecodeRuler } from './timeline/TimecodeRuler';
import { FilmstripThumbnail } from './timeline/FilmstripThumbnail';
import { MasterAudioMeter } from './audio/MasterAudioMeter';
import { IRStateManager } from '../lib/ir/irState';
import { WebAudioEngine } from '../lib/audio/WebAudioEngine';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useShuttleEngine, type UseShuttleEngineReturn } from '../lib/shuttle/useShuttleEngine';
import { snapToDiscreteFrame } from '../lib/shuttle/shuttleTypes';
import { StudioPlayheadController } from '../lib/playhead/StudioPlayheadController';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

interface TimelineProps {
  playhead: {
    currentFrame: number;
    totalFrames: number;
    fps: number;
  };
  onScrub: (frame: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  shuttle?: UseShuttleEngineReturn;
}

interface TrimHandleProps {
  seq: any;
  handle: 'start' | 'end';
}

function TrimHandle({ seq, handle }: TrimHandleProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `trim-${handle}-${seq.id}`,
    data: {
      type: 'trim',
      handle,
      seq,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => e.stopPropagation()}
      className={`w-2 h-full ${
        handle === 'start' ? '-ml-2 rounded-l-xs' : '-mr-2 rounded-r-xs'
      } cursor-col-resize hover:bg-white/50 active:bg-[var(--accent-primary)]/60 flex items-center justify-center transition-colors z-30`}
      title={`Drag to Trim ${handle === 'start' ? 'Start' : 'End'} (Snap enabled)`}
    >
      <div className="w-0.5 h-3 bg-white/60 rounded-full" />
    </div>
  );
}

interface TimelineClipItemProps {
  seq: any;
  track: any;
  pixelsPerFrame: number;
  isSelected: boolean;
  activeTool: 'select' | 'razor' | 'hand';
  getTrackBadgeStyle: (track: any) => string;
  onClipClick: (seq: any, e: React.MouseEvent) => void;
  activeDragState: {
    type: 'clip' | 'trim';
    seqId: string;
    handle?: 'start' | 'end';
    initialStartFrame: number;
    initialDurationFrames: number;
    deltaFrames: number;
    targetTrackId?: string;
  } | null;
}

function TimelineClipItem({
  seq,
  track,
  pixelsPerFrame,
  isSelected,
  activeTool,
  getTrackBadgeStyle,
  onClipClick,
  activeDragState,
}: TimelineClipItemProps) {
  const isBeingDragged = activeDragState?.seqId === seq.id;
  const isAudio = track.type === 'audio';

  const rawStart = (seq as any).startFrame ?? (seq as any).timelineStartFrame ?? 0;
  let displayStartFrame = rawStart;
  let displayDurationFrames = seq.durationFrames;

  if (isBeingDragged && activeDragState) {
    if (activeDragState.type === 'clip') {
      displayStartFrame = Math.max(0, rawStart + activeDragState.deltaFrames);
    } else if (activeDragState.type === 'trim') {
      if (activeDragState.handle === 'start') {
        displayStartFrame = Math.max(0, rawStart + activeDragState.deltaFrames);
        displayDurationFrames = Math.max(1, seq.durationFrames - activeDragState.deltaFrames);
      } else {
        displayDurationFrames = Math.max(1, seq.durationFrames + activeDragState.deltaFrames);
      }
    }
  }

  const leftPx = displayStartFrame * pixelsPerFrame;
  const widthPx = Math.max(16, displayDurationFrames * pixelsPerFrame);

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `clip-${seq.id}`,
    data: {
      type: 'clip',
      seq,
      trackId: track.id,
    },
    disabled: activeTool === 'razor',
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => onClipClick(seq, e)}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
      }}
      className={`absolute top-1 bottom-1 rounded-sm border px-2 flex items-center justify-between select-none group transition-all ${
        activeTool === 'razor'
          ? 'cursor-crosshair'
          : isBeingDragged && activeDragState?.type === 'clip'
          ? 'cursor-grabbing opacity-90 shadow-xl ring-2 ring-[var(--accent-primary)]/80 z-30'
          : 'cursor-grab'
      } ${
        isSelected
          ? 'ring-2 ring-[var(--accent-primary)] shadow-md z-20'
          : 'hover:brightness-95 z-10'
      } ${getTrackBadgeStyle(track)}`}
    >
      <TrimHandle seq={seq} handle="start" />

      <div className="flex-1 truncate px-1 flex items-center gap-1.5 relative overflow-hidden h-full pointer-events-none">
        {isAudio ? (
          <AudioWaveform
            id={seq.assetId || seq.id}
            durationFrames={seq.durationFrames}
            width={widthPx}
            height={28}
          />
        ) : (
          <FilmstripThumbnail
            assetId={seq.assetId || seq.id}
            width={widthPx}
            height={28}
          />
        )}
        <span className="text-[10px] font-mono font-medium truncate relative z-10 drop-shadow-xs">
          {seq.id}
        </span>
        {seq.modifiers && seq.modifiers.length > 0 && (
          <span className="text-[8px] bg-white/20 px-1 py-0.5 rounded-xs relative z-10 backdrop-blur-xs">
            {seq.modifiers.length} mod
          </span>
        )}
      </div>

      <TrimHandle seq={seq} handle="end" />
    </div>
  );
}

interface DroppableTrackLaneProps {
  track: any;
  isLocked: boolean;
  children: React.ReactNode;
}

function DroppableTrackLane({ track, isLocked, children }: DroppableTrackLaneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `track-${track.id}`,
    data: {
      type: 'track',
      trackId: track.id,
    },
    disabled: isLocked,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 h-full rounded-md border relative overflow-hidden transition-colors ${
        isLocked
          ? 'opacity-60 pointer-events-none bg-muted/40 border-[var(--glass-border)]'
          : isOver
          ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40 ring-1 ring-[var(--accent-primary)]/30'
          : 'bg-background/25 border-[var(--glass-border)] hover:border-[var(--glass-border-highlight)]/40'
      }`}
    >
      {children}
    </div>
  );
}

export function Timeline({
  playhead,
  onScrub,
  isPlaying: externalIsPlaying,
  onTogglePlay,
  shuttle: externalShuttle,
}: TimelineProps) {
  const currentFrame = playhead?.currentFrame || 0;
  const fps = playhead?.fps || 30;

  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoomScale, setZoomScale] = useState(1.0); // 1.0 = ~4px per frame
  const [activeTool, setActiveTool] = useState<'select' | 'razor' | 'hand'>('select');
  const [lockedTracks, setLockedTracks] = useState<Record<string, boolean>>({});
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({});

  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const totalFrames = irState.timeline?.totalFrames || playhead?.totalFrames || 300;
  const rawTracks = irState.timeline?.tracks;
  const tracks = rawTracks instanceof Map
    ? Array.from(rawTracks.values())
    : Array.isArray(rawTracks)
    ? rawTracks
    : [];
  const selectedSeqId = irState.selectedSequenceId;

  const pixelsPerFrame = Math.max(1, 4 * zoomScale);
  const timelineWidth = Math.max(800, totalFrames * pixelsPerFrame);

  const handleScrub = (frame: number) => {
    const discreteFrame = snapToDiscreteFrame(frame);
    WebAudioEngine.getInstance().playScrubFeedback(discreteFrame, fps, irState);
    onScrub(discreteFrame);
  };

  // Frame-Accurate J-K-L Shuttle Engine with Discrete Frame Snapping & Audio Clock Sync
  const internalShuttle = useShuttleEngine({
    currentFrame,
    totalFrames,
    fps,
    onScrub: handleScrub,
    irState,
    enableKeybindings: !externalShuttle,
  });

  const shuttle = externalShuttle || internalShuttle;

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : shuttle.isPlaying;

  const togglePlay = () => {
    if (onTogglePlay) {
      onTogglePlay();
    } else {
      shuttle.togglePlay();
    }
  };

  const handleSplit = () => {
    if (!selectedSeqId) return;
    IRStateManager.getInstance().splitSequence(selectedSeqId, currentFrame);
  };

  const handleTrim = (seqId: string, deltaStart: number, deltaDuration: number) => {
    IRStateManager.getInstance().trimSequence(seqId, deltaStart, deltaDuration);
  };

  // Unified @dnd-kit Drag State for Timeline Clips & Trim Handles
  const [activeDragState, setActiveDragState] = useState<{
    type: 'clip' | 'trim';
    seqId: string;
    handle?: 'start' | 'end';
    initialStartFrame: number;
    initialDurationFrames: number;
    deltaFrames: number;
    targetTrackId?: string;
  } | null>(null);

  // Active snap guideline (frame position or null)
  const [activeSnapGuideline, setActiveSnapGuideline] = useState<number | null>(null);

  // Hand tool panning ref & state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const playheadNeedleRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; scrollLeft: number }>({ x: 0, scrollLeft: 0 });

  // High-Frequency Direct DOM transform for 60fps playhead needle (Zero React reconciliation)
  useEffect(() => {
    const needle = playheadNeedleRef.current;
    if (!needle) return;

    return StudioPlayheadController.getInstance().subscribeHighFrequency((frame) => {
      const leftPx = 208 + frame * pixelsPerFrame;
      needle.style.transform = `translate3d(${leftPx}px, 0, 0)`;
    });
  }, [pixelsPerFrame]);

  // Virtualization Scroll & Viewport Observers
  const [scrollLeft, setScrollLeft] = useState(0);
  const [clientWidth, setClientWidth] = useState(1200);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollLeft(scrollContainerRef.current.scrollLeft);
      setClientWidth(scrollContainerRef.current.clientWidth);
    }
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

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

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'hand' || !scrollContainerRef.current) return;
    isPanningRef.current = true;
    panStartRef.current = {
      x: e.clientX,
      scrollLeft: scrollContainerRef.current.scrollLeft,
    };
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || activeTool !== 'hand' || !scrollContainerRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
  };

  const handleTimelineMouseUp = () => {
    isPanningRef.current = false;
  };

  // Backward-compatible aliases for trimmingState & startTrim unified under @dnd-kit
  const trimmingState = activeDragState?.type === 'trim' ? activeDragState : null;
  const startTrim = (seq: any, handle: 'start' | 'end') => {
    setActiveDragState({
      type: 'trim',
      handle,
      seqId: seq.id,
      initialStartFrame: seq.startFrame ?? seq.timelineStartFrame ?? 0,
      initialDurationFrames: seq.durationFrames,
      deltaFrames: 0,
    });
  };

  const timelineSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (!data) return;

    if (data.type === 'clip') {
      setActiveDragState({
        type: 'clip',
        seqId: data.seq.id,
        initialStartFrame: data.seq.startFrame ?? data.seq.timelineStartFrame ?? 0,
        initialDurationFrames: data.seq.durationFrames,
        deltaFrames: 0,
        targetTrackId: data.trackId,
      });
      IRStateManager.getInstance().setSelectedSequenceId(data.seq.id);
    } else if (data.type === 'trim') {
      setActiveDragState({
        type: 'trim',
        handle: data.handle,
        seqId: data.seq.id,
        initialStartFrame: data.seq.startFrame ?? data.seq.timelineStartFrame ?? 0,
        initialDurationFrames: data.seq.durationFrames,
        deltaFrames: 0,
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
      let snappedGuideline: number | null = null;

      if (snapEnabled) {
        // Collect candidate snap points: playhead, sequence boundaries, and 1s ticks
        const snapPoints: number[] = [currentFrame];
        for (const track of tracks) {
          for (const s of track.sequences) {
            if (s.id !== activeDragState.seqId) {
              const sStart = (s as any).startFrame ?? (s as any).timelineStartFrame ?? 0;
              snapPoints.push(sStart, sStart + s.durationFrames);
            }
          }
        }
        // 1-second grid ticks
        const totalSeconds = Math.ceil(totalFrames / fps);
        for (let sec = 0; sec <= totalSeconds; sec++) {
          snapPoints.push(sec * fps);
        }

        // Test start edge and end edge against snap points (within 4 frames)
        const targetEnd = targetStart + activeDragState.initialDurationFrames;
        for (const sp of snapPoints) {
          if (Math.abs(targetStart - sp) <= 4) {
            targetStart = sp;
            snappedGuideline = sp;
            break;
          } else if (Math.abs(targetEnd - sp) <= 4) {
            targetStart = sp - activeDragState.initialDurationFrames;
            snappedGuideline = sp;
            break;
          }
        }
      }

      setActiveSnapGuideline(snappedGuideline);

      // Overlap prevention on target track
      const targetTrack = tracks.find((t) => t.id === overTrackId);
      if (targetTrack) {
        for (const s of targetTrack.sequences) {
          if (s.id !== activeDragState.seqId) {
            const sStart = (s as any).startFrame ?? (s as any).timelineStartFrame ?? 0;
            const sEnd = sStart + s.durationFrames;
            const myEnd = targetStart + activeDragState.initialDurationFrames;
            if (targetStart < sEnd && myEnd > sStart) {
              if (activeDragState.initialStartFrame >= sEnd) {
                targetStart = Math.max(targetStart, sEnd);
              } else if (activeDragState.initialStartFrame + activeDragState.initialDurationFrames <= sStart) {
                targetStart = Math.min(targetStart, sStart - activeDragState.initialDurationFrames);
              }
            }
          }
        }
      }

      const deltaFrames = targetStart - activeDragState.initialStartFrame;
      setActiveDragState((prev) =>
        prev
          ? {
              ...prev,
              deltaFrames,
              targetTrackId: overTrackId,
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

      setActiveSnapGuideline(snappedGuideline);
      setActiveDragState((prev) => (prev ? { ...prev, deltaFrames } : null));
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveSnapGuideline(null);
    if (!activeDragState) return;

    if (activeDragState.type === 'clip') {
      const targetTrackId =
        (e.over?.data?.current as any)?.trackId || activeDragState.targetTrackId;
      const targetStartFrame = Math.max(
        0,
        activeDragState.initialStartFrame + activeDragState.deltaFrames
      );

      if (targetTrackId) {
        IRStateManager.getInstance().moveSequence(
          activeDragState.seqId,
          targetTrackId,
          targetStartFrame
        );
      }
    } else if (activeDragState.type === 'trim') {
      if (activeDragState.handle === 'start') {
        IRStateManager.getInstance().trimSequence(
          activeDragState.seqId,
          activeDragState.deltaFrames,
          -activeDragState.deltaFrames
        );
      } else {
        IRStateManager.getInstance().trimSequence(
          activeDragState.seqId,
          0,
          activeDragState.deltaFrames
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

  const toggleLock = (trackId: string) => {
    setLockedTracks((prev) => ({ ...prev, [trackId]: !prev[trackId] }));
  };

  const toggleMute = (trackId: string) => {
    setMutedTracks((prev) => ({ ...prev, [trackId]: !prev[trackId] }));
  };

  // Keyboard shortcuts (editing tools and zoom; transport/scrubbing handled by useShuttleEngine)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'c' || e.key === 'C') {
        setActiveTool('razor');
        handleSplit();
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('hand');
      } else if (e.key === 'z' || e.key === 'Z') {
        // Zoom to fit
        setZoomScale(1.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSeqId, currentFrame]);

  const getTrackBadgeStyle = (track: any) => {
    if (track.type === 'audio') return 'bg-emerald-600 border-emerald-700 text-white';
    if (track.id.includes('v2') || track.id.includes('depth')) return 'bg-violet-600 border-violet-700 text-white';
    if (track.type === 'video') return 'bg-indigo-600 border-indigo-700 text-white';
    return 'bg-amber-600 border-amber-700 text-white';
  };

  return (
    <footer className="h-72 glass-panel border-t border-border/50 flex flex-col select-none shadow-sm z-10 shrink-0">
      {/* 1. Pro Transport & Utility Bar */}
      <div className="h-11 border-b border-[var(--glass-border)] px-6 flex items-center justify-between bg-[var(--glass-bg)]/40 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          {/* Tool Selector Bar */}
          <Tooltip content="Selection Tool (V)">
            <Button
              variant={activeTool === 'select' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setActiveTool('select')}
              className={`h-7 w-7 transition-colors ${activeTool === 'select' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <MousePointer className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Razor Split Tool (C)">
            <Button
              variant={activeTool === 'razor' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => {
                setActiveTool((prev) => (prev === 'razor' ? 'select' : 'razor'));
              }}
              className={`h-7 w-7 transition-colors ${activeTool === 'razor' ? 'bg-[var(--accent-primary)] text-slate-950 font-semibold shadow-[0_0_10px_var(--accent-glow)]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Scissors className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Hand Pan Tool (H)">
            <Button
              variant={activeTool === 'hand' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setActiveTool('hand')}
              className={`h-7 w-7 transition-colors ${activeTool === 'hand' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Hand className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Transport Controls */}
          <Tooltip content="Rewind to Start (Home)">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScrub(0)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content={`Shuttle Reverse (J): ${shuttle.speed < 0 ? shuttle.speed + 'x' : '-1x'}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={shuttle.shuttleReverse}
              className={`h-7 w-7 transition-colors ${shuttle.speed < 0 ? 'text-amber-400 bg-amber-500/15' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content={shuttle.isPlaying ? `Pause / Stop (K / Space): ${shuttle.speed}x` : 'Play (Space / L)'}>
            <Button
              variant={shuttle.isPlaying ? 'secondary' : 'default'}
              size="icon"
              onClick={togglePlay}
              className={`h-7 w-7 transition-transform active:scale-95 ${shuttle.isPlaying ? 'bg-secondary text-secondary-foreground' : 'bg-[var(--accent-primary)] text-slate-950 shadow-[0_0_12px_var(--accent-glow)]'}`}
            >
              {shuttle.isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </Button>
          </Tooltip>

          <Tooltip content={`Shuttle Forward (L): ${shuttle.speed > 0 ? shuttle.speed + 'x' : '1x'}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={shuttle.shuttleForward}
              className={`h-7 w-7 transition-colors ${shuttle.speed > 0 ? 'text-emerald-400 bg-emerald-500/15' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <Tooltip content="Magnetic Snapping">
            <Toggle
              pressed={snapEnabled}
              onPressedChange={setSnapEnabled}
              size="sm"
              className="h-7 px-2 text-[11px] gap-1 data-[state=on]:bg-[var(--accent-primary)]/15 data-[state=on]:text-[var(--accent-primary)] data-[state=on]:border-[var(--accent-primary)]/30 border border-transparent transition-colors"
            >
              <Magnet className="w-3 h-3" />
              Snap
            </Toggle>
          </Tooltip>
        </div>

        {/* Center: Zoom Controls & Fit */}
        <div className="flex items-center gap-2">
          <ZoomOut
            className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setZoomScale((z) => Math.max(0.4, z - 0.2))}
          />
          <Slider
            min={0.4}
            max={3.0}
            step={0.1}
            value={zoomScale}
            onValueChange={setZoomScale}
            className="w-24 cursor-pointer"
          />
          <ZoomIn
            className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setZoomScale((z) => Math.min(3.0, z + 0.2))}
          />

          <Tooltip content="Zoom to Fit (Z)">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoomScale(1.0)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Maximize className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>
        </div>

        {/* Right: Master Audio VU Meter & Timecode Readout */}
        <div className="flex items-center gap-3">
          <MasterAudioMeter isPlaying={isPlaying} currentFrame={currentFrame} />

          <div className="flex items-center gap-1.5">
            {shuttle.speed !== 0 && (
              <Badge variant="outline" className="font-mono text-[11px] text-amber-400 border-amber-500/30 bg-amber-500/10 font-semibold shadow-2xs">
                {shuttle.speed}x
              </Badge>
            )}
            <Badge variant="outline" className="font-mono text-[11px] border-[var(--glass-border)] text-muted-foreground bg-[var(--glass-bg)] shadow-2xs">
              {(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(2)}s
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px] text-[var(--accent-primary)] border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 font-semibold shadow-2xs">
              F {currentFrame} / {totalFrames}
            </Badge>
          </div>
        </div>
      </div>

      {/* 2. Unified Scroll Container with Sticky Track Headers and Sticky Timecode Ruler */}
      <DndContext
        sensors={timelineSensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={scrollContainerRef}
          onMouseDown={handleTimelineMouseDown}
          onMouseMove={handleTimelineMouseMove}
          onMouseUp={handleTimelineMouseUp}
          className={`flex-1 overflow-x-auto overflow-y-auto px-4 py-2 relative select-none ${
            activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          <div style={{ width: `${timelineWidth + 208}px` }} className="space-y-1 relative">
            {/* Sticky Timeline Head: Track Headers title & Timecode Ruler */}
            <div className="sticky top-0 z-40 bg-[var(--glass-bg)]/95 backdrop-blur-md pb-1 flex items-center gap-2">
              {/* Sticky "Track Headers" Title Block */}
              <div className="w-52 shrink-0 h-6 px-2.5 flex items-center justify-between rounded bg-muted/30 border border-border/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground shadow-2xs">
                <span>Track Headers</span>
                <span className="text-[9px] lowercase opacity-70">({tracks.length} tracks)</span>
              </div>

              {/* Timecode Ruler */}
              <div style={{ width: `${timelineWidth}px` }} className="shrink-0 h-6">
                <TimecodeRuler
                  totalFrames={totalFrames}
                  fps={fps}
                  pixelsPerFrame={pixelsPerFrame}
                  timelineWidth={timelineWidth}
                  onScrub={handleScrub}
                />
              </div>
            </div>

            {/* Global Playhead Vertical Needle (Direct DOM Transform for 60fps Zero-Jank Movement) */}
            <div
              ref={playheadNeedleRef}
              className="absolute top-7 bottom-0 z-30 pointer-events-none will-change-transform flex flex-col items-center left-0"
              style={{
                transform: `translate3d(${208 + currentFrame * pixelsPerFrame}px, 0, 0)`,
              }}
            >
              <div className="w-2.5 h-2.5 bg-rose-500 rotate-45 -mt-1 shadow-xs" />
              <div className="w-0.5 flex-1 bg-rose-500/80" />
            </div>

            {/* Cyan Magnetic Snapping Guideline */}
            {activeSnapGuideline !== null && (
              <div
                className="absolute top-7 bottom-0 z-35 pointer-events-none flex flex-col items-center"
                style={{
                  left: `${208 + activeSnapGuideline * pixelsPerFrame}px`,
                }}
              >
                <div className="w-2 h-2 bg-cyan-400 rotate-45 -mt-1 shadow-[0_0_8px_#22d3ee]" />
                <div className="w-[1.5px] flex-1 bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                <span className="text-[9px] font-mono text-cyan-300 bg-slate-900/90 px-1 py-0.5 rounded -mt-4 shadow-sm border border-cyan-400/40">
                  {activeSnapGuideline}f
                </span>
              </div>
            )}

            {/* Track Rows: Virtualized outer container */}
            {tracks.length === 0 ? (
              <div className="flex items-center justify-center h-28 text-xs text-slate-400 italic">
                Compiling Video IR Tracks...
              </div>
            ) : (
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

                  // Horizontal sequence virtualization
                  const visibleSequences = track.sequences.filter((seq) => {
                    if (activeDragState?.seqId === seq.id) return true;
                    const seqStart = (seq as any).startFrame ?? (seq as any).timelineStartFrame ?? 0;
                    const seqEnd = seqStart + seq.durationFrames;
                    return seqEnd >= visibleStartFrame && seqStart <= visibleEndFrame;
                  });

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
                      className="h-10 flex items-center gap-2"
                    >
                      {/* Sticky Track Header Card */}
                      <div
                        onClick={() => {
                          IRStateManager.getInstance().setSelectedTrackId(track.id);
                          IRStateManager.getInstance().setInspectorMode('track');
                        }}
                        className="sticky left-0 z-20 w-52 h-full bg-[var(--glass-bg)] rounded-md border border-[var(--glass-border)] hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between px-2.5 shrink-0 shadow-2xs backdrop-blur-md"
                        title={`Inspect Track ${track.id}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />
                          <span className="text-[11px] font-medium text-foreground truncate max-w-[85px]">
                            {track.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          {/* Track Reorder Up/Down */}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canMoveUp}
                            onClick={(e) => {
                              e.stopPropagation();
                              IRStateManager.getInstance().reorderTrack(track.id, 'up');
                            }}
                            className="h-5 w-5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                            title="Move Track Up"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canMoveDown}
                            onClick={(e) => {
                              e.stopPropagation();
                              IRStateManager.getInstance().reorderTrack(track.id, 'down');
                            }}
                            className="h-5 w-5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                            title="Move Track Down"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLock(track.id);
                            }}
                            className={`h-5 w-5 rounded transition-colors ${
                              isLocked
                                ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 font-bold shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={isLocked ? 'Unlock Track' : 'Lock Track'}
                          >
                            {isLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMute(track.id);
                            }}
                            className={`h-5 w-5 rounded transition-colors ${
                              isMuted
                                ? 'text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 font-bold shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={isMuted ? 'Unmute Track' : 'Mute Track'}
                          >
                            {isMuted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                          </Button>
                        </div>
                      </div>

                      {/* Droppable Track Sequence Lane in the Exact Same Row */}
                      <div style={{ width: `${timelineWidth}px` }} className="h-full shrink-0">
                        <DroppableTrackLane track={track} isLocked={isLocked}>
                          {visibleSequences.map((seq) => (
                            <TimelineClipItem
                              key={seq.id}
                              seq={seq}
                              track={track}
                              pixelsPerFrame={pixelsPerFrame}
                              isSelected={selectedSeqId === seq.id}
                              activeTool={activeTool}
                              getTrackBadgeStyle={getTrackBadgeStyle}
                              onClipClick={handleClipClick}
                              activeDragState={activeDragState}
                            />
                          ))}
                        </DroppableTrackLane>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty timeline click target to switch to Project inspection mode */}
            <div
              onClick={() => IRStateManager.getInstance().setInspectorMode('project')}
              className="sticky left-0 w-52 h-8 rounded border border-dashed border-border/30 hover:border-border/60 hover:bg-muted/10 cursor-pointer transition-colors flex items-center justify-center text-[10px] text-muted-foreground italic px-2 text-center shadow-2xs mt-1"
              title="Click empty area to inspect Project Settings"
            >
              Project Settings
            </div>
          </div>
        </div>
      </DndContext>
    </footer>
  );
}
