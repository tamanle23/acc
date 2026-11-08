import { createSignal, createEffect, onMount, onCleanup, Suspense, lazy, Show } from 'solid-js';
import { DragDropProvider, DragOverlay } from '@dnd-kit/solid';
import { AlertCircle } from 'lucide-solid';
import { Titlebar } from './components/Titlebar';
import { LeftSidebar, DragOverlayPreview, type LeftNavTab } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { Preview } from './components/Preview';
import { Timeline } from './components/Timeline';
import { StudioBootController } from './lib/boot/StudioBootController';

const ExportProgressModal = lazy(() =>
  import('./components/ExportProgressModal').then((m) => ({ default: m.ExportProgressModal }))
);
const ExportConfigModal = lazy(() =>
  import('./components/ExportConfigModal').then((m) => ({ default: m.ExportConfigModal }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);

import { TooltipProvider } from './components/ui';
import { Toaster } from './components/ui/sonner';
import { toast } from 'solid-sonner';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from './components/ui/resizable';
import { IRStateManager } from './lib/ir/irState';
import { useIRState } from './lib/ir/useStudioStore';
import { getErrorMessage } from './lib/ir/studioTypes';
import { ThemeProvider } from './lib/theme/ThemeProvider';
import { WebAudioEngine } from './lib/audio/WebAudioEngine';
import { useShuttleEngine } from './lib/shuttle/useShuttleEngine';
import { snapToDiscreteFrame } from './lib/shuttle/shuttleTypes';
import { PlayheadController } from './lib/playhead/PlayheadController';
import { useWorkspaceDnd } from './lib/dnd/useWorkspaceDnd';
import {
  ClientExportOrchestrator,
  downloadExportedMp4,
} from './lib/export/ClientExportOrchestrator';

function StudioWorkspace() {
  const irState = useIRState();
  const [currentFrame, setCurrentFrame] = createSignal(0);

  // Enterprise Dual-Sidebar Workspace Layout with Responsive Auto-Collapse & Zen Mode
  const [isLeftOpen, setIsLeftOpen] = createSignal(
    typeof window !== 'undefined' ? window.innerWidth >= 1200 : true
  );
  const [isRightOpen, setIsRightOpen] = createSignal(true);
  const [activeNav, setActiveNav] = createSignal<LeftNavTab>('vault');
  let prevSidebarState = { left: true, right: true };

  const isZenMode = () => !isLeftOpen() && !isRightOpen();

  const handleToggleZen = () => {
    if (isZenMode()) {
      setIsLeftOpen(prevSidebarState.left);
      setIsRightOpen(prevSidebarState.right);
    } else {
      prevSidebarState = { left: isLeftOpen(), right: isRightOpen() };
      setIsLeftOpen(false);
      setIsRightOpen(false);
    }
  };

  const [isExportConfigOpen, setIsExportConfigOpen] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [exportProgress, setExportProgress] = createSignal<number>(0);
  let exportAbortController: AbortController | null = null;

  const fps = () => irState.doc?.meta?.globalFps || 30;
  const totalFrames = () => irState.timeline?.totalFrames || 300;
  const width = () => irState.doc?.meta?.canvasSize?.w || 1920;
  const height = () => irState.doc?.meta?.canvasSize?.h || 1080;

  // Global Workspace Hotkeys: [ (left drawer), ] (right inspector), \ (zen mode)
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      )
        return;
      if (e.key === '[') setIsLeftOpen((prev) => !prev);
      else if (e.key === ']') setIsRightOpen((prev) => !prev);
      else if (e.key === '\\') {
        e.preventDefault();
        handleToggleZen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  const [timelineScrollLeft, setTimelineScrollLeft] = createSignal(0);
  const [timelineZoomScale, setTimelineZoomScale] = createSignal(1.65);

  const handleSequenceInserted = () => {
    setIsRightOpen(true);
  };

  const dnd = useWorkspaceDnd({
    currentFrame,
    fps,
    timelineScrollLeft,
    timelineZoomScale,
    onSequenceInserted: handleSequenceInserted,
  });

  // Dismiss pre-hydration boot splash after preview worker warms up & first-paint synchronization
  onMount(() => {
    StudioBootController.waitForEngineWarmup();
  });

  // Sync PlayheadController configuration
  createEffect(() => {
    PlayheadController.getInstance().setConfig(fps(), totalFrames());
  });

  // Subscribe low-frequency updates to sync Solid state without per-frame re-renders
  onMount(() => {
    const unsub = PlayheadController.getInstance().subscribeLowFrequency((frame) => {
      setCurrentFrame(frame);
    });
    onCleanup(unsub);
  });

  const handleScrub = (frame: number) => {
    const discrete = snapToDiscreteFrame(frame);
    const clamped = Math.max(0, Math.min(discrete, totalFrames()));
    setCurrentFrame(clamped);
    PlayheadController.getInstance().seek(clamped, !shuttle.isPlaying);
    if (!shuttle.isPlaying) {
      WebAudioEngine.getInstance().playScrubFeedback(clamped, fps(), irState);
    }
  };

  // Frame-Accurate J-K-L Shuttle Engine with Discrete Frame Snapping & Audio Clock Sync
  const shuttle = useShuttleEngine({
    currentFrame,
    totalFrames,
    fps,
    onScrub: handleScrub,
    irState,
    enableKeybindings: true,
  });

  createEffect(() => {
    PlayheadController.getInstance().setIsPlaying(shuttle.isPlaying);
  });

  const handleTogglePlay = () => {
    shuttle.togglePlay();
  };

  const handleOpenExportConfig = () => {
    setIsExportConfigOpen(true);
  };

  const handleStartExport = async (config?: {
    width?: number;
    height?: number;
    videoBitrate?: number;
  }) => {
    const exportWidth = config?.width ?? width();
    const exportHeight = config?.height ?? height();
    const exportBitrate = config?.videoBitrate ?? 4_000_000;

    const abortController = new AbortController();
    exportAbortController = abortController;
    try {
      setIsExporting(true);
      setExportProgress(0);
      const result = await ClientExportOrchestrator.exportToMp4({
        irState,
        width: exportWidth,
        height: exportHeight,
        videoBitrate: exportBitrate,
        fps: fps(),
        totalFrames: totalFrames(),
        signal: abortController.signal,
        onProgress: setExportProgress,
      });

      if (!result.cancelled) {
        if (result.buffer) downloadExportedMp4(result.buffer);
        toast.success('MP4 Export Completed!', {
          description: `Rendered ${result.framesConsumed} frames at ${exportWidth}x${exportHeight} (${(result.fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`,
          action: result.buffer
            ? { label: 'Download Again', onClick: () => downloadExportedMp4(result.buffer!) }
            : undefined,
        });
      }
    } catch (err: unknown) {
      console.error('Client export error:', err);
      toast.error('Client Export Failed', { description: getErrorMessage(err) });
    } finally {
      exportAbortController = null;
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleCancelExport = () => {
    exportAbortController?.abort();
    setIsExporting(false);
  };

  return (
    <DragDropProvider
      onDragStart={dnd.handleDragStart}
      onDragEnd={dnd.handleDragEnd}
    >
      <div class="flex flex-col h-screen select-none liquid-ambient-mesh bg-background text-foreground transition-colors duration-200">
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>

        {/* 1. Top Titlebar */}
        <Titlebar
          projectTitle={irState.doc?.meta?.contentId || 'Untitled Project'}
          fps={fps()}
          currentFrame={currentFrame()}
          totalFrames={totalFrames()}
          isExporting={isExporting()}
          onStartExport={handleOpenExportConfig}
          onCancelExport={handleCancelExport}
          isLeftOpen={isLeftOpen()}
          onToggleLeft={() => setIsLeftOpen(!isLeftOpen())}
          isRightOpen={isRightOpen()}
          onToggleRight={() => setIsRightOpen(!isRightOpen())}
          isZenMode={isZenMode()} /* isZenMode={isZenMode} */
          onToggleZen={handleToggleZen}
        />

        {/* IR Error Banner if any */}
        <Show when={irState.error}>
          <div class="bg-destructive/15 border-b border-destructive/30 px-6 py-2 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle class="w-4 h-4 text-destructive shrink-0" />
            <span class="font-mono font-medium truncate">{irState.error}</span>
          </div>
        </Show>

        {/* 2. Main Middle Workspace & Timeline in Resizable Vertical Layout */}
        <ResizablePanelGroup direction="vertical" class="flex-1">
          <ResizablePanel defaultSize="62%" minSize="30%" class="h-full">
            <div class="flex h-full w-full overflow-hidden">
              <LeftSidebar
                isOpen={isLeftOpen()}
                onToggle={() => setIsLeftOpen(!isLeftOpen())}
                activeNav={activeNav()}
                setActiveNav={setActiveNav}
                onInsertPreset={(preset) => {
                  const seq = preset.createSequence({
                    startFrame: currentFrame(),
                    normX: 0.5,
                    normY: 0.5,
                  });
                  IRStateManager.getInstance().addSequence(preset.targetTrackId, seq, {
                    trackTypeFallback: preset.targetTrackType,
                    trackNameFallback: preset.targetTrackName,
                  });
                  setIsRightOpen(true);
                }}
              />

              {/* Horizontal Bento Splitting for Preview Canvas and Right Inspector */}
              <ResizablePanelGroup direction="horizontal" class="flex-1 h-full">
                <ResizablePanel
                  id="preview-viewport-panel"
                  defaultSize={isRightOpen() ? '72%' : '100%'}
                  minSize="40%"
                  class="h-full"
                >
                  <div class="h-full w-full flex flex-col items-center justify-center p-3 relative overflow-hidden bg-background/50">
                    <Preview
                      playhead={{
                        currentFrame: currentFrame(),
                        totalFrames: totalFrames(),
                        currentTime: currentFrame() / fps(),
                        fps: fps(),
                      }}
                      isPlaying={shuttle.isPlaying}
                      onTogglePlay={handleTogglePlay}
                      onScrub={handleScrub}
                    />

                    <Suspense fallback={null}>
                      <ExportConfigModal
                        open={isExportConfigOpen()}
                        onOpenChange={setIsExportConfigOpen}
                        width={width()}
                        height={height()}
                        aspectRatio={irState.doc?.meta?.aspectRatio}
                        fps={fps()}
                        totalFrames={totalFrames()}
                        onConfirmExport={({ width: w, height: h, videoBitrate }) => {
                          handleStartExport({ width: w, height: h, videoBitrate });
                        }}
                      />

                      <ExportProgressModal
                        isExporting={isExporting()}
                        exportProgress={exportProgress()}
                        onCancelExport={handleCancelExport}
                      />
                    </Suspense>
                  </div>
                </ResizablePanel>

                <Show when={isRightOpen()}>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    id="inspector-panel"
                    defaultSize="28%"
                    minSize="280px"
                    maxSize="55%"
                    class="h-full"
                  >
                    <RightSidebar />
                  </ResizablePanel>
                </Show>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 3. Bottom Timeline Scrubber */}
          <ResizablePanel defaultSize="38%" minSize="20%" class="h-full">
            <div class="h-full overflow-hidden">
              <Timeline
                playhead={{
                  currentFrame: currentFrame(),
                  totalFrames: totalFrames(),
                  fps: fps(),
                }}
                onScrub={handleScrub}
                isPlaying={shuttle.isPlaying}
                onTogglePlay={handleTogglePlay}
                shuttle={shuttle}
                zoomScale={timelineZoomScale()}
                onZoomChange={setTimelineZoomScale}
                scrollLeft={timelineScrollLeft()}
                onScrollChange={setTimelineScrollLeft}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* 4. Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          <DragOverlayPreview item={dnd.activeDragItemSignal()} />
        </DragOverlay>
      </div>
    </DragDropProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <StudioWorkspace />
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </ThemeProvider>
  );
}
