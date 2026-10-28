import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TimecodeRuler } from './timeline/TimecodeRuler';
import { Toolbar } from './timeline/Toolbar';
import { OverlayHUD } from './timeline/OverlayHUD';
import { EmptyState } from './timeline/EmptyState';
import { TimelineDom } from './timeline/TimelineDom';
import { IRStateManager } from '../lib/ir/irState';
import { useIRState } from '../lib/ir/useStudioStore';
import { normalizeTracksList } from '../lib/ir/studioTypes';
import { WebAudioEngine } from '../lib/audio/WebAudioEngine';
import { useShuttleEngine, type UseShuttleEngineReturn } from '../lib/shuttle/useShuttleEngine';
import { snapToDiscreteFrame } from '../lib/shuttle/shuttleTypes';
import { StudioPlayheadController } from '../lib/playhead/StudioPlayheadController';
import { TimelineCommandDispatcher, RazorCutCommand } from '../lib/timeline/commands/TimelineCommands';

export interface TimelineProps {
  playhead: {
    currentFrame: number;
    totalFrames: number;
    fps: number;
  };
  onScrub: (frame: number) => void;
  isPlaying: boolean;
  onTogglePlay?: () => void;
  shuttle: UseShuttleEngineReturn;
}

export function Timeline({
  playhead,
  onScrub,
  isPlaying,
  onTogglePlay,
  shuttle,
}: TimelineProps) {
  const currentFrame = playhead?.currentFrame || 0;
  const fps = playhead?.fps || 30;

  const [snapEnabled, setSnapEnabled] = useState(true);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.65); // 1.0 = ~1.5px per frame
  const [activeTool, setActiveTool] = useState<'select' | 'razor' | 'hand'>('select');
  const [timecodeHUD, setTimecodeHUD] = useState<{
    frame: number;
    deltaFrames: number;
    snapLabel?: string;
    durationFrames?: number;
  } | null>(null);
  const [razorHoverFrame, setRazorHoverFrame] = useState<number | null>(null);
  const [lockedTracks, setLockedTracks] = useState<Record<string, boolean>>({});
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({});
  const [activeSnapGuideline, setActiveSnapGuideline] = useState<{
    frame: number;
    label?: string;
    isAbut?: boolean;
  } | null>(null);

  const irState = useIRState();

  const totalFrames = irState.timeline?.totalFrames || playhead?.totalFrames || 300;
  const tracks = normalizeTracksList(irState.timeline?.tracks);
  const selectedSeqId = irState.selectedSequenceId;

  // Adaptive Zoom Scaling: 1.5px/frame at 1.0x allows standard 3s (90f) clips to render at 135px (LOD 2)
  const pixelsPerFrame = Math.max(0.2, 1.5 * zoomScale);
  const timelineWidth = Math.max(800, totalFrames * pixelsPerFrame);

  const handleScrub = (frame: number) => {
    const discreteFrame = snapToDiscreteFrame(frame);
    onScrub(discreteFrame);
  };




  const togglePlay = () => {
    if (onTogglePlay) {
      onTogglePlay();
    } else {
      shuttle.togglePlay();
    }
  };

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

  return (
    <footer className="h-full glass-panel border-t border-border/50 flex flex-col select-none shadow-sm z-10 shrink-0">
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
        className={`flex-1 overflow-x-auto overflow-y-auto relative select-none ${activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : ''
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

          {/* Magnetic Snapping, Razor Indicator, and Floating Timecode HUD Overlay */}
          <OverlayHUD
            pixelsPerFrame={pixelsPerFrame}
            activeSnapGuideline={activeSnapGuideline}
            razorHoverFrame={razorHoverFrame}
            timecodeHUD={timecodeHUD}
          />

          {/* Track Rows: Virtualized outer container */}
          {tracks.length === 0 ? (
            <EmptyState
              onLoadSample={() => IRStateManager.getInstance().switchTemplate('default')}
            />
          ) : (
            <TimelineDom
              tracks={tracks}
              lockedTracks={lockedTracks}
              mutedTracks={mutedTracks}
              onToggleLock={toggleLock}
              onToggleMute={toggleMute}
              selectedSeqId={selectedSeqId}
              activeTool={activeTool}
              fps={fps}
              totalFrames={totalFrames}
              pixelsPerFrame={pixelsPerFrame}
              timelineWidth={timelineWidth}
              scrollContainerRef={scrollContainerRef}
              scrollLeft={scrollLeft}
              clientWidth={clientWidth}
              snapEnabled={snapEnabled}
              rippleEnabled={rippleEnabled}
              currentFrame={currentFrame}
              onActiveSnapGuidelineChange={setActiveSnapGuideline}
              onHoveredClipChange={() => { }}
            />
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
