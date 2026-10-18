import React, { useState, useEffect } from 'react';
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

  let displayStartFrame = seq.startFrame;
  let displayDurationFrames = seq.durationFrames;

  if (isBeingDragged && activeDragState) {
    if (activeDragState.type === 'clip') {
      displayStartFrame = Math.max(0, seq.startFrame + activeDragState.deltaFrames);
    } else if (activeDragState.type === 'trim') {
      if (activeDragState.handle === 'start') {
        displayStartFrame = Math.max(0, seq.startFrame + activeDragState.deltaFrames);
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
            id={seq.id}
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
}: TimelineProps) {
  const currentFrame = playhead?.currentFrame || 0;
  const fps = playhead?.fps || 30;

  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : localIsPlaying;

  const togglePlay = () => {
    if (onTogglePlay) {
      onTogglePlay();
    } else {
      setLocalIsPlaying((prev) => !prev);
    }
  };

  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoomScale, setZoomScale] = useState(1.0); // 1.0 = ~4px per frame
  const [activeTool, setActiveTool] = useState<'select' | 'razor' | 'hand'>('select');
  const [lockedTracks, setLockedTracks] = useState<Record<string, boolean>>({});
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({});

  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const totalFrames = irState.timeline?.totalDurationFrames || playhead?.totalFrames || 300;
  const rawTracks = irState.timeline?.tracks;
  const tracks = rawTracks instanceof Map
    ? Array.from(rawTracks.values())
    : Array.isArray(rawTracks)
    ? rawTracks
    : [];
  const selectedSeqId = irState.selectedSequenceId;

  const pixelsPerFrame = Math.max(1, 4 * zoomScale);
  const timelineWidth = Math.max(800, totalFrames * pixelsPerFrame);

  // Standalone fallback playback loop if onTogglePlay was not provided
  useEffect(() => {
    if (onTogglePlay) return; // Managed by parent component
    let rafId: number;
    if (localIsPlaying) {
      WebAudioEngine.getInstance().startPlayback(currentFrame, fps, irState);
      let lastTime = performance.now();
      let acc = 0;
      const frameDuration = 1000 / fps;
      let frame = currentFrame;

      const loop = (now: number) => {
        const delta = now - lastTime;
        lastTime = now;
        acc += delta;
        if (acc >= frameDuration) {
          const adv = Math.floor(acc / frameDuration);
          acc %= frameDuration;
          frame = (frame + adv) % (totalFrames || 300);
          onScrub(frame);
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    } else {
      WebAudioEngine.getInstance().stopPlayback();
    }
    return () => {
      cancelAnimationFrame(rafId);
      if (!onTogglePlay) WebAudioEngine.getInstance().stopPlayback();
    };
  }, [localIsPlaying, fps, totalFrames, irState, onTogglePlay]);

  const handleScrub = (frame: number) => {
    WebAudioEngine.getInstance().playScrubFeedback(frame, fps, irState);
    onScrub(frame);
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

  // Backward-compatible aliases for trimmingState & startTrim unified under @dnd-kit
  const trimmingState = activeDragState?.type === 'trim' ? activeDragState : null;
  const startTrim = (seq: any, handle: 'start' | 'end') => {
    setActiveDragState({
      type: 'trim',
      handle,
      seqId: seq.id,
      initialStartFrame: seq.startFrame,
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
        initialStartFrame: data.seq.startFrame,
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
        initialStartFrame: data.seq.startFrame,
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

      if (snapEnabled) {
        const snapPoints: number[] = [currentFrame];
        for (const track of tracks) {
          for (const s of track.sequences) {
            if (s.id !== activeDragState.seqId) {
              snapPoints.push(s.startFrame, s.startFrame + s.durationFrames);
            }
          }
        }
        for (const sp of snapPoints) {
          if (Math.abs(targetStart - sp) <= 3) {
            targetStart = sp;
            break;
          }
        }
      }

      // Overlap prevention on target track
      const targetTrack = tracks.find((t) => t.id === overTrackId);
      if (targetTrack) {
        for (const s of targetTrack.sequences) {
          if (s.id !== activeDragState.seqId) {
            const sEnd = s.startFrame + s.durationFrames;
            const myEnd = targetStart + activeDragState.initialDurationFrames;
            if (targetStart < sEnd && myEnd > s.startFrame) {
              if (activeDragState.initialStartFrame >= sEnd) {
                targetStart = Math.max(targetStart, sEnd);
              } else if (activeDragState.initialStartFrame + activeDragState.initialDurationFrames <= s.startFrame) {
                targetStart = Math.min(targetStart, s.startFrame - activeDragState.initialDurationFrames);
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

      if (snapEnabled) {
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
          for (const sp of snapPoints) {
            if (Math.abs(rawTarget - sp) <= 3) {
              deltaFrames = sp - activeDragState.initialStartFrame;
              break;
            }
          }
        } else {
          const rawTarget =
            activeDragState.initialStartFrame + activeDragState.initialDurationFrames + deltaFrames;
          for (const sp of snapPoints) {
            if (Math.abs(rawTarget - sp) <= 3) {
              deltaFrames =
                sp - (activeDragState.initialStartFrame + activeDragState.initialDurationFrames);
              break;
            }
          }
        }
      }

      setActiveDragState((prev) => (prev ? { ...prev, deltaFrames } : null));
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
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
      const clickedFrame = Math.max(
        seq.startFrame + 1,
        Math.min(
          seq.startFrame + seq.durationFrames - 1,
          seq.startFrame + Math.round(clickPx / pixelsPerFrame)
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleScrub(Math.max(0, currentFrame - (e.shiftKey ? fps : 1)));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleScrub(Math.min(totalFrames, currentFrame + (e.shiftKey ? fps : 1)));
      } else if (e.key === 'c' || e.key === 'C') {
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
  }, [currentFrame, totalFrames, fps, selectedSeqId, onTogglePlay, isPlaying]);

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

          <Tooltip content={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
            <Button
              variant={isPlaying ? 'secondary' : 'default'}
              size="icon"
              onClick={togglePlay}
              className={`h-7 w-7 transition-transform active:scale-95 ${isPlaying ? 'bg-secondary text-secondary-foreground' : 'bg-[var(--accent-primary)] text-slate-950 shadow-[0_0_12px_var(--accent-glow)]'}`}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </Button>
          </Tooltip>

          <Tooltip content="Fast Forward 1s">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScrub(Math.min(totalFrames, currentFrame + fps))}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
            <Badge variant="outline" className="font-mono text-[11px] border-[var(--glass-border)] text-muted-foreground bg-[var(--glass-bg)] shadow-2xs">
              {(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(2)}s
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px] text-[var(--accent-primary)] border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 font-semibold shadow-2xs">
              F {currentFrame} / {totalFrames}
            </Badge>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Multi-Track Lanes with Integrated Timecode Ruler */}
      <div className="flex-1 overflow-x-auto overflow-y-auto px-6 py-1">
        <div style={{ minWidth: `${timelineWidth + 180}px` }} className="space-y-1 relative">
          {/* Header Row: Left spacer + Timecode Ruler */}
          <div className="flex items-center gap-2">
            <div className="w-44 shrink-0 text-[10px] font-mono text-slate-400 pl-2">
              TRACK HEADERS
            </div>
            <div className="flex-1">
              <TimecodeRuler
                totalFrames={totalFrames}
                fps={fps}
                pixelsPerFrame={pixelsPerFrame}
                timelineWidth={timelineWidth}
                onScrub={handleScrub}
              />
            </div>
          </div>

          {/* Global Playhead Vertical Needle */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none transition-all duration-75 flex flex-col items-center"
            style={{
              left: `${180 + currentFrame * pixelsPerFrame}px`,
            }}
          >
            <div className="w-2.5 h-2.5 bg-rose-500 rotate-45 -mt-1 shadow-xs" />
            <div className="w-0.5 flex-1 bg-rose-500/80" />
          </div>

          <DndContext
            sensors={timelineSensors}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            {tracks.length === 0 ? (
              <div className="flex items-center justify-center h-28 text-xs text-slate-400 italic">
                Compiling Video IR Tracks...
              </div>
            ) : (
              tracks.map((track) => {
                const isLocked = lockedTracks[track.id] || false;
                const isMuted = mutedTracks[track.id] || false;

                return (
                  <div key={track.id} className="h-10 flex items-center gap-2">
                    {/* Track Header / Controls */}
                    <div
                      onClick={() => {
                        IRStateManager.getInstance().setSelectedTrackId(track.id);
                        IRStateManager.getInstance().setInspectorMode('track');
                      }}
                      className="w-44 h-full bg-[var(--glass-bg)] hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors rounded-md border border-[var(--glass-border)] flex items-center justify-between px-2.5 shrink-0 shadow-2xs backdrop-blur-md"
                      title={`Inspect Track ${track.id}`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {track.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleLock(track.id)}
                          className={`h-6 w-6 rounded transition-colors ${
                            isLocked
                              ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 font-bold shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          title={isLocked ? 'Unlock Track' : 'Lock Track'}
                        >
                          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMute(track.id)}
                          className={`h-6 w-6 rounded transition-colors ${
                            isMuted
                              ? 'text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 font-bold shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          title={isMuted ? 'Unmute Track' : 'Mute Track'}
                        >
                          {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>

                    {/* Droppable Track Sequence Lane */}
                    <DroppableTrackLane track={track} isLocked={isLocked}>
                      {track.sequences.map((seq) => (
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
                );
              })
            )}
          </DndContext>

          {/* Empty timeline click target to switch to Project inspection mode */}
          <div
            onClick={() => IRStateManager.getInstance().setInspectorMode('project')}
            className="h-12 w-full cursor-pointer hover:bg-slate-500/5 transition-colors rounded-sm flex items-center justify-center text-[10px] text-slate-400 italic"
            title="Click empty timeline area to inspect Project Settings"
          >
            Click empty area to inspect Project Settings
          </div>
        </div>
      </div>
    </footer>
  );
}
