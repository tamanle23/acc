import { createSignal, createEffect, onCleanup, createMemo, Show } from 'solid-js';
import { Plus } from 'lucide-solid';
import { toast } from 'solid-sonner';
import { TimecodeRuler } from './timeline/TimecodeRuler';
import { Toolbar } from './timeline/Toolbar';
import { OverlayHUD } from './timeline/OverlayHUD';
import { EmptyState, TimelineEmptyState } from './timeline/TimelineEmptyState';
import { TimelineDom } from './timeline/TimelineDom';
import { TrackQuotaModal } from './timeline/TrackQuotaModal';
import { IRStateManager } from '../lib/ir/irState';
import { useIRState } from '../lib/ir/useStudioStore';
import { normalizeTracksList } from '../lib/ir/studioTypes';
import { type UseShuttleEngineReturn } from '../lib/shuttle/useShuttleEngine';
import { snapToDiscreteFrame } from '../lib/shuttle/shuttleTypes';
import { PlayheadController } from '../lib/playhead/PlayheadController';
import {
  TimelineCommandDispatcher,
  RazorCutCommand,
  RippleDeleteCommand,
} from '../lib/timeline/commands/TimelineCommands';
import type { SemanticTrackRole, TrackType } from '@acc/ir';

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
  zoomScale?: number;
  onZoomChange?: (zoom: number) => void;
  scrollLeft?: number;
  onScrollChange?: (scrollLeft: number) => void;
}

export function Timeline(props: TimelineProps) {
  const irState = useIRState();

  const currentFrame = () => props.playhead?.currentFrame || 0;
  const fps = () => props.playhead?.fps || 30;

  const [snapEnabled, setSnapEnabled] = createSignal(true);
  const [rippleEnabled, setRippleEnabled] = createSignal(false);
  const [internalZoomScale, setInternalZoomScale] = createSignal(1.65); // 1.0 = ~1.5px per frame
  const zoomScale = () => props.zoomScale ?? internalZoomScale();
  const setZoomScale = (zoom: number | ((prev: number) => number)) => {
    const nextZoom = typeof zoom === 'function' ? zoom(zoomScale()) : zoom;
    if (props.onZoomChange) props.onZoomChange(nextZoom);
    else setInternalZoomScale(nextZoom);
  };

  const [activeTool, setActiveTool] = createSignal<'select' | 'razor' | 'hand'>('select');
  const [timecodeHUD, setTimecodeHUD] = createSignal<{
    frame: number;
    deltaFrames: number;
    snapLabel?: string;
    durationFrames?: number;
  } | null>(null);
  const [razorHoverFrame, setRazorHoverFrame] = createSignal<number | null>(null);
  const [activeSnapGuideline, setActiveSnapGuideline] = createSignal<{
    frame: number;
    label?: string;
    isAbut?: boolean;
  } | null>(null);

  const [quotaModalState, setQuotaModalState] = createSignal<{
    isOpen: boolean;
    role: SemanticTrackRole;
    currentCount: number;
    hardCap: number;
    softCap: number;
    pendingType: TrackType;
    pendingRole?: SemanticTrackRole;
  } | null>(null);

  const handleRequestAddTrack = (type: TrackType = 'video', role?: SemanticTrackRole) => {
    const check = IRStateManager.getInstance().checkCanAddTrack(type, role);
    if (!check.allowed) {
      setQuotaModalState({
        isOpen: true,
        role: check.role,
        currentCount: check.currentCount,
        hardCap: check.hardCap,
        softCap: check.softCap,
        pendingType: type,
        pendingRole: role,
      });
    } else {
      const res = IRStateManager.getInstance().addTrack(type, role);
      if (res.isWarning && res.reason) {
        toast.warning(res.reason);
      }
    }
  };

  const handleConfirmOverride = () => {
    const state = quotaModalState();
    if (state) {
      IRStateManager.getInstance().addTrack(
        state.pendingType,
        state.pendingRole,
        true
      );
      setQuotaModalState(null);
    }
  };

  const totalFrames = () => irState().timeline?.totalFrames || props.playhead?.totalFrames || 300;
  const tracks = () => normalizeTracksList(irState().timeline?.tracks);
  const selectedSeqId = () => irState().selectedSequenceId;

  // Authoritative track lock and mute states from VideoIR document
  const lockedTracks = createMemo(() => {
    const res: Record<string, boolean> = {};
    for (const t of tracks()) {
      if (t.locked) res[t.id] = true;
    }
    return res;
  });

  const mutedTracks = createMemo(() => {
    const res: Record<string, boolean> = {};
    for (const t of tracks()) {
      if (t.muted) res[t.id] = true;
    }
    return res;
  });

  // Adaptive Zoom Scaling: 1.5px/frame at 1.0x allows standard 3s (90f) clips to render at 135px (LOD 2)
  const pixelsPerFrame = () => Math.max(0.2, 1.5 * zoomScale());
  const timelineWidth = () => Math.max(800, totalFrames() * pixelsPerFrame());

  const handleScrub = (frame: number) => {
    const discreteFrame = snapToDiscreteFrame(frame);
    props.onScrub(discreteFrame);
  };

  const togglePlay = () => {
    if (props.onTogglePlay) {
      props.onTogglePlay();
    } else {
      props.shuttle.togglePlay();
    }
  };

  // Hand tool panning ref & state
  const [scrollContainerRef, setScrollContainerRef] = createSignal<HTMLDivElement | undefined>(undefined);
  const [playheadNeedleRef, setPlayheadNeedleRef] = createSignal<HTMLDivElement | undefined>(undefined);
  let isPanning = false;
  let panStart = { x: 0, scrollLeft: 0 };

  // High-Frequency Direct DOM transform for 60fps playhead needle (Zero Solid reconciliation)
  createEffect(() => {
    const ppf = pixelsPerFrame();
    const needle = playheadNeedleRef();
    if (!needle) return;

    const unsub = PlayheadController.getInstance().subscribeHighFrequency((frame, isPlaying, fractionalFrame) => {
      // Sub-frame gliding during playback; discrete integer frame when parked/scrubbing.
      const activeFrame = isPlaying && fractionalFrame !== undefined ? fractionalFrame : frame;
      const leftPx = 208 + activeFrame * ppf;
      needle.style.transform = `translate3d(${leftPx}px, 0, 0)`;
    });

    onCleanup(unsub);
  });

  // Virtualization Scroll & Viewport Observers
  const [internalScrollLeft, setInternalScrollLeft] = createSignal(0);
  const scrollLeft = () => props.scrollLeft ?? internalScrollLeft();
  const [clientWidth, setClientWidth] = createSignal(1200);

  const handleScroll = () => {
    const container = scrollContainerRef();
    if (container) {
      const sl = container.scrollLeft;
      if (props.onScrollChange) props.onScrollChange(sl);
      else setInternalScrollLeft(sl);
      setClientWidth(container.clientWidth);
    }
  };

  createEffect(() => {
    const el = scrollContainerRef();
    if (!el) return;
    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    onCleanup(() => el.removeEventListener('scroll', handleScroll));
  });

  const handleTimelineMouseDown = (e: MouseEvent) => {
    const container = scrollContainerRef();
    if (activeTool() !== 'hand' || !container) return;
    isPanning = true;
    panStart = {
      x: e.clientX,
      scrollLeft: container.scrollLeft,
    };
  };

  const handleTimelineMouseMove = (e: MouseEvent) => {
    const container = scrollContainerRef();
    if (isPanning && activeTool() === 'hand' && container) {
      const dx = e.clientX - panStart.x;
      container.scrollLeft = panStart.scrollLeft - dx;
      return;
    }

    if (activeTool() === 'razor') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left - 208 + scrollLeft();
      if (x >= 0) {
        setRazorHoverFrame(Math.round(x / pixelsPerFrame()));
      } else {
        setRazorHoverFrame(null);
      }
    } else if (razorHoverFrame() !== null) {
      setRazorHoverFrame(null);
    }
  };

  const handleTimelineMouseUp = () => {
    isPanning = false;
  };

  const toggleLock = (trackId: string) => {
    const isLocked = Boolean(lockedTracks()[trackId]);
    IRStateManager.getInstance().setTrackLocked(trackId, !isLocked);
  };

  const toggleMute = (trackId: string) => {
    const isMuted = Boolean(mutedTracks()[trackId]);
    IRStateManager.getInstance().setTrackMuted(trackId, !isMuted);
  };

  const toggleVisible = (trackId: string) => {
    const track = tracks().find((t) => t.id === trackId);
    const isVisible = track?.visible !== false;
    IRStateManager.getInstance().setTrackVisible(trackId, !isVisible);
  };

  const isSelectedSeqLocked = (): boolean => {
    const selId = selectedSeqId();
    if (!selId) return false;
    for (const track of tracks()) {
      if (track.sequences.some((s) => s.id === selId)) {
        return Boolean(track.locked);
      }
    }
    return false;
  };

  // Keyboard shortcuts (editing tools, split, ripple delete, and zoom; transport/scrubbing handled by useShuttleEngine)
  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const selId = selectedSeqId();

      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        // Cmd+K / Ctrl+K: Split selected clip at playhead
        e.preventDefault();
        if (selId && !isSelectedSeqLocked()) {
          TimelineCommandDispatcher.getInstance().dispatch(
            new RazorCutCommand(selId, currentFrame())
          );
        }
      } else if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        // Shift+Delete / Shift+Backspace: Professional NLE Ripple Delete
        e.preventDefault();
        if (selId && !isSelectedSeqLocked()) {
          TimelineCommandDispatcher.getInstance().dispatch(
            new RippleDeleteCommand(selId, rippleEnabled())
          );
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete / Backspace: Regular delete or ripple delete depending on rippleEnabled toggle
        e.preventDefault();
        if (selId && !isSelectedSeqLocked()) {
          if (rippleEnabled()) {
            TimelineCommandDispatcher.getInstance().dispatch(
              new RippleDeleteCommand(selId, true)
            );
          } else {
            IRStateManager.getInstance().deleteSequence(selId);
          }
        }
      } else if (e.key === 'c' || e.key === 'C') {
        setActiveTool((prev) => (prev === 'razor' ? 'select' : 'razor'));
      } else if (e.key === 's' || e.key === 'S') {
        // Split selected clip at playhead
        if (selId && !isSelectedSeqLocked()) {
          TimelineCommandDispatcher.getInstance().dispatch(
            new RazorCutCommand(selId, currentFrame())
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
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  return (
    <footer class="h-full glass-panel border-t border-border/50 flex flex-col select-none shadow-glass z-10 shrink-0">
      {/* 1. Pro Transport & Utility Bar */}
      <Toolbar
        activeTool={activeTool()}
        onSetActiveTool={setActiveTool}
        isPlaying={props.isPlaying}
        onTogglePlay={togglePlay}
        shuttle={props.shuttle}
        snapEnabled={snapEnabled()}
        onSetSnapEnabled={setSnapEnabled}
        rippleEnabled={rippleEnabled()}
        onSetRippleEnabled={setRippleEnabled}
        zoomScale={zoomScale()}
        onSetZoomScale={setZoomScale}
        currentFrame={currentFrame()}
        totalFrames={totalFrames()}
        fps={fps()}
      />

      {/* 2. Unified Scroll Container with Sticky Track Headers and Sticky Timecode Ruler */}
      <div
        ref={setScrollContainerRef}
        onMouseDown={handleTimelineMouseDown}
        onMouseMove={handleTimelineMouseMove}
        onMouseUp={handleTimelineMouseUp}
        class={`flex-1 overflow-x-auto overflow-y-auto relative select-none ${
          activeTool() === 'hand' ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <div style={{ width: `${timelineWidth() + 208}px` }} class="space-y-1 relative">
          {/* Sticky Timeline Head: Track Headers title & Timecode Ruler */}
          <div class="sticky top-0 z-40 bg-[var(--glass-bg)]/95 backdrop-blur-md pb-1 flex items-center gap-2">
            {/* Sticky "Track Headers" Title Block (Sticky both horizontally left-0 and vertically top-0) */}
            <div class="sticky left-0 z-50 w-52 shrink-0 h-6 px-2.5 flex items-center justify-between rounded bg-muted/90 border border-border/60 text-[10px] font-mono uppercase tracking-wider text-muted-foreground shadow-2xs backdrop-blur-md">
              <span>Track Headers</span>
              <span class="text-[9px] lowercase opacity-70">({tracks().length} tracks)</span>
            </div>

            {/* Timecode Ruler */}
            <div style={{ width: `${timelineWidth()}px` }} class="shrink-0 h-6">
              <TimecodeRuler
                totalFrames={totalFrames()}
                fps={fps()}
                pixelsPerFrame={pixelsPerFrame()}
                timelineWidth={timelineWidth()}
                onScrub={handleScrub}
              />
            </div>
          </div>

          {/* Global Playhead Vertical Needle (Direct DOM Transform for 60fps Zero-Jank Movement) */}
          <div
            ref={setPlayheadNeedleRef}
            class="absolute top-7 bottom-0 z-30 pointer-events-none will-change-transform flex flex-col items-center left-0"
            style={{
              transform: `translate3d(${208 + currentFrame() * pixelsPerFrame()}px, 0, 0)`,
            }}
          >
            <div class="w-2.5 h-2.5 bg-rose-500 rotate-45 -mt-1 shadow-xs" />
            <div class="w-0.5 flex-1 bg-rose-500/80" />
          </div>

          {/* Magnetic Snapping, Razor Indicator, and Floating Timecode HUD Overlay */}
          <OverlayHUD
            pixelsPerFrame={pixelsPerFrame()}
            activeSnapGuideline={activeSnapGuideline()}
            razorHoverFrame={razorHoverFrame()}
            timecodeHUD={timecodeHUD()}
          />

          {/* Track Rows: Virtualized outer container */}
          <Show
            when={tracks().length > 0}
            fallback={
              <EmptyState
                onLoadSample={() => IRStateManager.getInstance().switchTemplate('default')}
                onAddTrack={() => handleRequestAddTrack('video', 'overlay')}
              />
            }
          >
            <TimelineDom
              tracks={tracks()}
              lockedTracks={lockedTracks()}
              mutedTracks={mutedTracks()}
              onToggleLock={toggleLock}
              onToggleMute={toggleMute}
              onToggleVisible={toggleVisible}
              selectedSeqId={selectedSeqId()}
              activeTool={activeTool()}
              fps={fps()}
              totalFrames={totalFrames()}
              pixelsPerFrame={pixelsPerFrame()}
              timelineWidth={timelineWidth()}
              scrollContainerRef={scrollContainerRef()}
              scrollLeft={scrollLeft()}
              clientWidth={clientWidth()}
              snapEnabled={snapEnabled()}
              rippleEnabled={rippleEnabled()}
              currentFrame={currentFrame()}
              onActiveSnapGuidelineChange={setActiveSnapGuideline}
              onHoveredClipChange={() => {}}
            />
          </Show>

          {/* Track Controls Footer */}
          <div class="sticky left-0 w-52 flex items-center gap-1 mt-1.5 z-20">
            <button
              type="button"
              onClick={() => handleRequestAddTrack('video', 'overlay')}
              class="flex-1 h-7 rounded-md bg-[var(--glass-bg)] hover:bg-muted/60 border border-[var(--glass-border)] text-[10px] font-medium text-foreground/80 hover:text-foreground flex items-center justify-center gap-1 transition-colors shadow-2xs backdrop-blur-md cursor-pointer"
              title="Add a new video overlay track"
            >
              <Plus class="w-3 h-3 text-sky-400" />
              <span>Video</span>
            </button>
            <button
              type="button"
              onClick={() => handleRequestAddTrack('timed_text', 'text')}
              class="h-7 px-2 rounded-md bg-[var(--glass-bg)] hover:bg-muted/60 border border-[var(--glass-border)] text-[10px] font-medium text-foreground/80 hover:text-foreground flex items-center justify-center gap-1 transition-colors shadow-2xs backdrop-blur-md cursor-pointer"
              title="Add a new subtitle / caption text track"
            >
              <Plus class="w-3 h-3 text-violet-400" />
              <span>Text</span>
            </button>
            <button
              type="button"
              onClick={() => handleRequestAddTrack('audio', 'audio')}
              class="h-7 px-2 rounded-md bg-[var(--glass-bg)] hover:bg-muted/60 border border-[var(--glass-border)] text-[10px] font-medium text-foreground/80 hover:text-foreground flex items-center justify-center gap-1 transition-colors shadow-2xs backdrop-blur-md cursor-pointer"
              title="Add a new audio track"
            >
              <Plus class="w-3 h-3 text-emerald-400" />
              <span>Audio</span>
            </button>
            <div
              onClick={() => IRStateManager.getInstance().setInspectorMode('timeline')}
              class="w-12 h-7 rounded-md border border-dashed border-border/30 hover:border-border/60 hover:bg-muted/10 cursor-pointer transition-colors flex items-center justify-center text-[10px] text-muted-foreground italic text-center shadow-2xs shrink-0"
              title="Click empty area to inspect Project Settings"
            >
              Meta
            </div>
          </div>

          {/* Hard Cap Quota Confirmation Modal */}
          <Show when={quotaModalState()}>
            {(modal) => (
              <TrackQuotaModal
                isOpen={modal().isOpen}
                onClose={() => setQuotaModalState(null)}
                onConfirmOverride={handleConfirmOverride}
                role={modal().role}
                currentCount={modal().currentCount}
                hardCap={modal().hardCap}
                softCap={modal().softCap}
              />
            )}
          </Show>
        </div>
      </div>
    </footer>
  );
}
