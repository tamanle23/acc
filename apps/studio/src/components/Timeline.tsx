import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Film } from 'lucide-react';
import { AudioWaveform } from './timeline/AudioWaveform';
import { TimecodeRuler } from './timeline/TimecodeRuler';
import { FilmstripThumbnail } from './timeline/FilmstripThumbnail';
import { MasterAudioMeter } from './audio/MasterAudioMeter';
import { TransitionBlock } from './timeline/TransitionBlock';
import { TrimHandle } from './timeline/TrimHandle';
import { DroppableTrackLane } from './timeline/DroppableTrackLane';
import { ClipItem, TimelineClipItem } from './timeline/ClipItem';
import { TrackHeaderCard } from './timeline/TrackHeaderCard';
import { Toolbar } from './timeline/Toolbar';
import { OverlayHUD } from './timeline/OverlayHUD';
import { EmptyState } from './timeline/EmptyState';
import { IRStateManager } from '../lib/ir/irState';
import { WebAudioEngine } from '../lib/audio/WebAudioEngine';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useShuttleEngine, type UseShuttleEngineReturn } from '../lib/shuttle/useShuttleEngine';
import { snapToDiscreteFrame } from '../lib/shuttle/shuttleTypes';
import { StudioPlayheadController } from '../lib/playhead/StudioPlayheadController';
import { TimelineWorkerBridge } from '../lib/timeline/TimelineWorkerBridge';
import type { TimelineRenderModel, ClipLayoutEntry } from '../workers/timelineTypes';
import { RationalTime } from '@acc/core-isomorphic';
import { isTrackCompatibleWithSequence } from '../lib/timeline/trackCompatibility';
import {
  TimelinePointerStateMachine,
  type GhostDragState,
} from '../lib/timeline/interaction/TimelinePointerStateMachine';
import { TimelineCommandDispatcher, RazorCutCommand } from '../lib/timeline/commands/TimelineCommands';
import type { HitTestTrack } from '../lib/timeline/interaction/TimelineHitTester';
import type { TimelineMode } from '../lib/timeline/strategies/ITimelineRenderStrategy';

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
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.65); // 1.0 = ~1.5px per frame
  const [activeTool, setActiveTool] = useState<'select' | 'razor' | 'hand'>('select');
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('dom');
  const [canvasCursor, setCanvasCursor] = useState<string>('default');
  const [timecodeHUD, setTimecodeHUD] = useState<{
    frame: number;
    deltaFrames: number;
    snapLabel?: string;
    durationFrames?: number;
  } | null>(null);
  const [razorHoverFrame, setRazorHoverFrame] = useState<number | null>(null);
  const [canvasGhostDrag, setCanvasGhostDrag] = useState<GhostDragState | null>(null);
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

  // Adaptive Zoom Scaling: 1.5px/frame at 1.0x allows standard 3s (90f) clips to render at 135px (LOD 2)
  // Zooming out to 0.4x scales to 54px (LOD 1) and 0.2x to 27px (LOD 0)
  const pixelsPerFrame = Math.max(0.2, 1.5 * zoomScale);
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

  // Active snap guideline (frame position and label or null)
  const [activeSnapGuideline, setActiveSnapGuideline] = useState<{ frame: number; label?: string; isAbut?: boolean } | null>(null);

  // Hovered clip state for TimelineClipHoverHUD
  const [hoveredClip, setHoveredClip] = useState<{
    seq: any;
    track: any;
    fps: number;
    position: { leftPx: number; topPx: number; widthPx: number };
  } | null>(null);

  // Hand tool panning ref & state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const playheadNeedleRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerBridgeRef = useRef<TimelineWorkerBridge | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; scrollLeft: number }>({ x: 0, scrollLeft: 0 });

  // Design Pattern: State Machine for pointer interactions in Canvas Mode
  const pointerStateMachineRef = useRef<TimelinePointerStateMachine | null>(null);
  if (!pointerStateMachineRef.current) {
    pointerStateMachineRef.current = new TimelinePointerStateMachine({
      onCursorChange: (c) => setCanvasCursor(c),
      onGhostUpdate: (ghost) => setCanvasGhostDrag(ghost),
      onSnapGuideline: (g, label) => setActiveSnapGuideline(g !== null ? { frame: g, label } : null),
      onTimecodeHUD: (hud) => setTimecodeHUD(hud),
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
      const newScrollLeft = scrollContainerRef.current.scrollLeft;
      const newClientWidth = scrollContainerRef.current.clientWidth;
      setScrollLeft(newScrollLeft);
      setClientWidth(newClientWidth);

      if (workerBridgeRef.current) {
        workerBridgeRef.current.updateViewport({
          scrollLeft: newScrollLeft,
          viewportWidth: newClientWidth,
        });
      }
    }
  }, []);

  // Initialize TimelineWorkerBridge with OffscreenCanvas
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
            const raw = WebAudioEngine.getInstance().getWaveformPeaks(seq.assetId || seq.id, seq.durationFrames, 120);
            peaks = Array.from(raw);
          } else {
            thumbnailUrl = (seq.assetId || seq.id);
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
      mode: timelineMode,
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
        // The canvas was transferred in a previous lifecycle; trigger key update for a fresh DOM canvas node
        setCanvasKey((k) => k + 1);
      }
    } else {
      bridge.updateModel(model);
      bridge.updateViewport(initialViewport);
    }
  }, [tracks, lockedTracks, mutedTracks, totalFrames, fps, pixelsPerFrame, canvasKey, timelineMode, selectedSeqId, canvasGhostDrag]);

  useEffect(() => {
    return () => {
      if (workerBridgeRef.current) {
        workerBridgeRef.current.dispose();
        workerBridgeRef.current = null;
      }
    };
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

  // =========================================================================
  // Native @neodrag/react Drag & Drop Handlers for Timeline Clips & Trimming
  // =========================================================================

  const handleClipDragStart = (seq: any, track: any) => {
    setActiveDragState({
      type: 'clip',
      seqId: seq.id,
      initialStartFrame: seq.startFrame ?? seq.timelineStartFrame ?? 0,
      initialDurationFrames: seq.durationFrames,
      deltaFrames: 0,
      targetTrackId: track.id,
    });
    IRStateManager.getInstance().setSelectedSequenceId(seq.id);
  };

  const handleClipDrag = (seq: any, track: any, delta: { x: number; y: number }, event: PointerEvent) => {
    if (!activeDragState || activeDragState.type !== 'clip') return;

    const rawDeltaFrames = Math.round(delta.x / pixelsPerFrame);

    // Track lane vertical hopping with media-type compatibility validation
    let overTrackId = activeDragState.targetTrackId || track.id;
    if (scrollContainerRef.current) {
      const trackElements = scrollContainerRef.current.querySelectorAll<HTMLElement>('[data-track-lane-id]');
      for (const el of trackElements) {
        const rect = el.getBoundingClientRect();
        if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
          const tId = el.getAttribute('data-track-lane-id');
          const candidateTrack = tracks.find((t) => t.id === tId);
          if (candidateTrack) {
            const isCompatible = isTrackCompatibleWithSequence(candidateTrack.type, seq.type);
            const isTargetLocked = lockedTracks[candidateTrack.id] || false;
            if (isCompatible && !isTargetLocked) {
              overTrackId = candidateTrack.id;
            }
          }
          break;
        }
      }
    }

    let targetStart = Math.max(0, activeDragState.initialStartFrame + rawDeltaFrames);
    let snapResult: { frame: number; label?: string; isAbut?: boolean } | null = null;

    if (snapEnabled) {
      interface SnapPointCandidate {
        frame: number;
        label?: string;
        isAbut?: boolean;
      }

      const candidatePoints: SnapPointCandidate[] = [{ frame: currentFrame, label: 'Playhead' }];

      for (const t of tracks) {
        for (const s of t.sequences) {
          if (s.id !== activeDragState.seqId) {
            const sStart = (s as any).startFrame ?? (s as any).timelineStartFrame ?? 0;
            const sEnd = sStart + s.durationFrames;
            candidatePoints.push(
              { frame: sStart, label: `Abut ${s.id}`, isAbut: true },
              { frame: sEnd, label: `Abut ${s.id}`, isAbut: true }
            );
          }
        }
      }

      // 1-second grid ticks
      const totalSeconds = Math.ceil(totalFrames / fps);
      for (let sec = 0; sec <= totalSeconds; sec++) {
        candidatePoints.push({ frame: sec * fps, label: `${sec}s` });
      }

      // Test start edge and end edge against snap points (within 4 frames)
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

      setActiveSnapGuideline(snapResult);
    } else {
      setActiveSnapGuideline(null);
    }

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
  };

  const handleClipDragEnd = (seq: any, track: any) => {
    setActiveSnapGuideline(null);
    if (!activeDragState || activeDragState.type !== 'clip') return;

    const targetTrackId = activeDragState.targetTrackId || track.id;
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

    setActiveDragState(null);
  };

  const handleTrimDragStart = (seq: any, handle: 'start' | 'end') => {
    setActiveDragState({
      type: 'trim',
      handle,
      seqId: seq.id,
      initialStartFrame: seq.startFrame ?? seq.timelineStartFrame ?? 0,
      initialDurationFrames: seq.durationFrames,
      deltaFrames: 0,
    });
    IRStateManager.getInstance().setSelectedSequenceId(seq.id);
  };

  const handleTrimDrag = (seq: any, handle: 'start' | 'end', delta: { x: number; y: number }) => {
    if (!activeDragState || activeDragState.type !== 'trim') return;

    const rawDeltaFrames = Math.round(delta.x / pixelsPerFrame);
    let deltaFrames = rawDeltaFrames;
    let snappedGuideline: number | null = null;

    if (snapEnabled) {
      const snapPoints: number[] = [currentFrame];
      for (const t of tracks) {
        for (const s of t.sequences) {
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

    setActiveSnapGuideline(snappedGuideline !== null ? { frame: snappedGuideline } : null);
    setActiveDragState((prev) => (prev ? { ...prev, deltaFrames } : null));
  };

  const handleTrimDragEnd = (seq: any, handle: 'start' | 'end') => {
    setActiveSnapGuideline(null);
    if (!activeDragState || activeDragState.type !== 'trim') return;

    const dStart = activeDragState.handle === 'start' ? activeDragState.deltaFrames : 0;
    const dDur = activeDragState.handle === 'start' ? -activeDragState.deltaFrames : activeDragState.deltaFrames;

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

  // Convert tracks to HitTestTrack[] format for pure State Machine & HitTester
  const hitTestTracks: HitTestTrack[] = tracks.map((t: any, index: number) => ({
    id: t.id,
    type: t.type || 'video',
    sequences: Array.isArray(t.sequences) ? t.sequences : [],
  }));

  // Canvas Mode Pointer Event Handlers wired directly to TimelinePointerStateMachine
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (timelineMode !== 'canvas') return;
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
    if (timelineMode !== 'canvas') return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const localPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (activeTool === 'razor') {
      const frameAtPointer = Math.max(0, Math.floor((localPoint.x + scrollLeft) / pixelsPerFrame));
      setRazorHoverFrame(frameAtPointer);
    } else {
      setRazorHoverFrame(null);
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
    if (timelineMode !== 'canvas') return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if pointer was not captured
    }
    setRazorHoverFrame(null);
    pointerStateMachineRef.current?.handlePointerUp();
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
        setActiveTool((prev) => (prev === 'razor' ? 'select' : 'razor'));
      } else if (e.key === 's' || e.key === 'S') {
        // Split selected clip at playhead
        if (selectedSeqId) {
          TimelineCommandDispatcher.getInstance().dispatch(
            new RazorCutCommand(selectedSeqId, currentFrame)
          );
        }
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
    if (track.type === 'audio') return 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200 shadow-emerald-950/30';
    if (track.id.includes('v2') || track.id.includes('depth') || track.id.includes('vfx')) return 'bg-amber-950/85 border-amber-500/50 text-amber-200 shadow-amber-950/30';
    if (track.type === 'overlay' || track.type === 'timed_text' || track.id.includes('text') || track.id.includes('sub')) return 'bg-violet-950/85 border-violet-500/50 text-violet-200 shadow-violet-950/30';
    if (track.type === 'video') return 'bg-indigo-950/85 border-indigo-500/50 text-indigo-200 shadow-indigo-950/30';
    return 'bg-muted/85 border-glass-border text-foreground shadow-sm';
  };

  return (
    <footer className="h-72 glass-panel border-t border-border/50 flex flex-col select-none shadow-sm z-10 shrink-0">
      {/* 1. Pro Transport & Utility Bar */}
      <Toolbar
        activeTool={activeTool}
        onSetActiveTool={setActiveTool}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        shuttle={shuttle}
        snapEnabled={snapEnabled}
        onSetSnapEnabled={setSnapEnabled}
        rippleEnabled={rippleEnabled}
        onSetRippleEnabled={setRippleEnabled}
        timelineMode={timelineMode}
        onSetTimelineMode={setTimelineMode}
        zoomScale={zoomScale}
        onSetZoomScale={setZoomScale}
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        fps={fps}
      />

      {/* 2. Unified Scroll Container with Sticky Track Headers and Sticky Timecode Ruler */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleTimelineMouseDown}
        onMouseMove={handleTimelineMouseMove}
        onMouseUp={handleTimelineMouseUp}
        className={`flex-1 overflow-x-auto overflow-y-auto px-4 py-2 relative select-none ${activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
      >
          <div style={{ width: `${timelineWidth + 208}px` }} className="space-y-1 relative">
            {/* Sticky Timeline Head: Track Headers title & Timecode Ruler */}
            <div className="sticky top-0 z-40 bg-[var(--glass-bg)]/95 backdrop-blur-md pb-1 flex items-center gap-2">
              {/* Sticky "Track Headers" Title Block (Sticky both horizontally left-0 and vertically top-0) */}
              <div className="sticky left-0 z-50 w-52 shrink-0 h-6 px-2.5 flex items-center justify-between rounded bg-muted/90 border border-border/60 text-[10px] font-mono uppercase tracking-wider text-muted-foreground shadow-2xs backdrop-blur-md">
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

            {/* OffscreenCanvas Background Track Renderer (Transferred to dedicated Timeline Web Worker) */}
            <canvas
              key={canvasKey}
              ref={offscreenCanvasRef}
              className={`absolute top-7 left-52 pointer-events-none ${timelineMode === 'canvas' ? 'z-10' : 'z-0 opacity-0'
                }`}
              style={{
                width: `${timelineWidth}px`,
                height: `${Math.max(120, rowVirtualizer.getTotalSize())}px`,
              }}
            />

            {/* Canvas Mode Transparent Pointer Interaction Overlay (0ms direct cursor & pointer capture) */}
            {timelineMode === 'canvas' && (
              <canvas
                className="absolute top-7 left-52 z-25"
                style={{
                  width: `${timelineWidth}px`,
                  height: `${Math.max(120, rowVirtualizer.getTotalSize())}px`,
                  cursor: canvasCursor,
                }}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
              />
            )}

            {/* Magnetic Snapping, Razor Indicator, and Floating Timecode HUD Overlay */}
            <OverlayHUD
              pixelsPerFrame={pixelsPerFrame}
              activeSnapGuideline={activeSnapGuideline}
              timelineMode={timelineMode}
              razorHoverFrame={razorHoverFrame}
              timecodeHUD={timecodeHUD}
            />

            {/* Track Rows: Virtualized outer container */}
            {tracks.length === 0 ? (
              <EmptyState
                onLoadSample={() => IRStateManager.getInstance().switchTemplate('default')}
              />
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
                      className="h-10 flex items-center gap-2 bg-[var(--glass-bg)]"
                    >
                      {/* Sticky Track Header Card */}
                      <TrackHeaderCard
                        track={track}
                        isLocked={isLocked}
                        isMuted={isMuted}
                        canMoveUp={canMoveUp}
                        canMoveDown={canMoveDown}
                        onToggleLock={toggleLock}
                        onToggleMute={toggleMute}
                      />

                      {/* Track Sequence Lane: Render DOM clips only in DOM mode to prevent double rendering */}
                      <div style={{ width: `${timelineWidth}px` }} className="h-full shrink-0">
                        {timelineMode === 'dom' ? (
                          <DroppableTrackLane
                            track={track}
                            isLocked={isLocked}
                            isDropTarget={activeDragState?.targetTrackId === track.id && activeDragState?.type === 'clip'}
                          >
                            {visibleSequences.map((seq) => (
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
                                  if (hoverData && !activeDragState) {
                                    setHoveredClip({
                                      ...hoverData,
                                      fps,
                                    });
                                  } else {
                                    setHoveredClip(null);
                                  }
                                }}
                                activeDragState={activeDragState}
                                onClipDragStart={handleClipDragStart}
                                onClipDrag={handleClipDrag}
                                onClipDragEnd={handleClipDragEnd}
                                onTrimStart={handleTrimDragStart}
                                onTrim={handleTrimDrag}
                                onTrimEnd={handleTrimDragEnd}
                              />
                            ))}
                          </DroppableTrackLane>
                        ) : (
                          // Canvas Mode: placeholder empty slot aligned with offscreen canvas beneath
                          <div className="flex-1 h-full rounded-md border border-[var(--glass-border)]/30 bg-transparent pointer-events-none" />
                        )}
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
    </footer>
  );
}
