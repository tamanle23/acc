import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { AlertCircle } from 'lucide-react';
import { Titlebar } from './components/Titlebar';
import { LeftSidebar, DragOverlayPreview, type LeftNavTab } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { Preview } from './components/Preview';
import { Timeline } from './components/Timeline';
import { ExportProgressModal } from './components/ExportProgressModal';
import { SettingsModal } from './components/SettingsModal';
import { TooltipProvider } from './components/ui';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
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
import { StudioPlayheadController } from './lib/playhead/StudioPlayheadController';
import { useWorkspaceDnd } from './lib/dnd/useWorkspaceDnd';
import {
  ClientExportOrchestrator,
  downloadExportedMp4,
} from './lib/export/ClientExportOrchestrator';

function StudioWorkspace() {
  const irState = useIRState();
  const [currentFrame, setCurrentFrame] = useState(0);
  const currentFrameRef = useRef(currentFrame);
  currentFrameRef.current = currentFrame;

  // Enterprise Dual-Sidebar Workspace Layout
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [activeNav, setActiveNav] = useState<LeftNavTab>('vault');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const exportAbortControllerRef = useRef<AbortController | null>(null);

  const fps = irState.doc.meta.globalFps || 30;
  const totalFrames = irState.timeline?.totalFrames || 300;
  const width = irState.doc.meta.canvasSize.w || 1920;
  const height = irState.doc.meta.canvasSize.h || 1080;

  // Global Workspace Hotkeys: [ (left drawer), ] (right inspector), \ (zen mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === '[') setIsLeftOpen((prev) => !prev);
      else if (e.key === ']') setIsRightOpen((prev) => !prev);
      else if (e.key === '\\') {
        setIsLeftOpen((prevLeft) => {
          const anyOpen = prevLeft || isRightOpen;
          setIsRightOpen(!anyOpen);
          return !anyOpen;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRightOpen]);

  const handleSequenceInserted = useCallback(() => {
    setIsRightOpen(true);
  }, []);

  const { sensors, activeDragItem, handleDragStart, handleDragEnd } = useWorkspaceDnd({
    currentFrame,
    fps,
    onSequenceInserted: handleSequenceInserted,
  });

  // Sync StudioPlayheadController configuration
  useEffect(() => {
    StudioPlayheadController.getInstance().setConfig(fps, totalFrames);
  }, [fps, totalFrames]);

  // Subscribe low-frequency updates to sync React state (e.g. for clip inspector) without per-frame re-renders
  useEffect(() => {
    return StudioPlayheadController.getInstance().subscribeLowFrequency((frame) => {
      setCurrentFrame(frame);
      currentFrameRef.current = frame;
    });
  }, []);

  const handleScrub = (frame: number) => {
    const discrete = snapToDiscreteFrame(frame);
    const clamped = Math.max(0, Math.min(discrete, totalFrames));
    currentFrameRef.current = clamped;
    StudioPlayheadController.getInstance().seek(clamped, !shuttle.isPlaying);
    if (!shuttle.isPlaying) {
      WebAudioEngine.getInstance().playScrubFeedback(clamped, fps, irState);
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

  const isPlaying = shuttle.isPlaying;

  useEffect(() => {
    StudioPlayheadController.getInstance().setIsPlaying(isPlaying);
  }, [isPlaying]);

  const handleTogglePlay = () => {
    shuttle.togglePlay();
  };

  const handleStartExport = async () => {
    const abortController = new AbortController();
    exportAbortControllerRef.current = abortController;

    try {
      setIsExporting(true);
      setExportProgress(0);

      const result = await ClientExportOrchestrator.exportToMp4({
        irState,
        width,
        height,
        fps,
        totalFrames,
        signal: abortController.signal,
        onProgress: setExportProgress,
      });

      if (!result.cancelled) {
        if (result.buffer) {
          downloadExportedMp4(result.buffer);
        }
        toast.success('MP4 Export Completed!', {
          description: `Rendered ${result.framesConsumed} frames (${(result.fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`,
          action: result.buffer
            ? {
              label: 'Download Again',
              onClick: () => downloadExportedMp4(result.buffer!),
            }
            : undefined,
        });
      }
    } catch (err: unknown) {
      console.error('Client export error:', err);
      toast.error('Client Export Failed', {
        description: getErrorMessage(err),
      });
    } finally {
      exportAbortControllerRef.current = null;
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleCancelExport = useCallback(() => {
    exportAbortControllerRef.current?.abort();
    setIsExporting(false);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-screen select-none liquid-ambient-mesh bg-background text-foreground transition-colors duration-200">
        <SettingsModal />
        {/* 1. Top Titlebar */}
        <Titlebar
          projectTitle={irState.doc.meta.contentId}
          fps={fps}
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          isExporting={isExporting}
          onStartExport={handleStartExport}
          onCancelExport={handleCancelExport}
          isLeftOpen={isLeftOpen}
          onToggleLeft={() => setIsLeftOpen(!isLeftOpen)}
          isRightOpen={isRightOpen}
          onToggleRight={() => setIsRightOpen(!isRightOpen)}
        />

        {/* IR Error Banner if any */}
        {irState.error && (
          <div className="bg-destructive/15 border-b border-destructive/30 px-6 py-2 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <span className="font-mono font-medium truncate">{irState.error}</span>
          </div>
        )}

        {/* 2. Main Middle Workspace & Timeline in Resizable Vertical Layout */}
        <ResizablePanelGroup direction="vertical" className="flex-1">
          <ResizablePanel defaultSize={62} minSize={30}>
            <div className="flex h-full w-full overflow-hidden">
              <LeftSidebar
                isOpen={isLeftOpen}
                onToggle={() => setIsLeftOpen(!isLeftOpen)}
                activeNav={activeNav}
                setActiveNav={setActiveNav}
                onInsertPreset={(preset) => {
                  const seq = preset.createSequence({
                    startFrame: currentFrame,
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

              <div className="flex-1 flex flex-col items-center justify-center p-3 relative overflow-hidden bg-background/50">
                <Preview
                  playhead={{
                    currentFrame,
                    totalFrames,
                    currentTime: currentFrame / fps,
                    fps,
                  }}
                  isPlaying={isPlaying}
                  onTogglePlay={handleTogglePlay}
                  onScrub={handleScrub}
                />

                <ExportProgressModal
                  isExporting={isExporting}
                  exportProgress={exportProgress}
                  onCancelExport={handleCancelExport}
                />
              </div>

              {isRightOpen && <RightSidebar />}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border/60 hover:bg-accent-theme/60 transition-colors" />

          {/* 3. Bottom Timeline Scrubber */}
          <ResizablePanel defaultSize={38} minSize={20}>
            <div className="h-full overflow-hidden">
              <Timeline
                playhead={{
                  currentFrame,
                  totalFrames,
                  fps,
                }}
                onScrub={handleScrub}
                isPlaying={isPlaying}
                onTogglePlay={handleTogglePlay}
                shuttle={shuttle}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* 4. Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          <DragOverlayPreview item={activeDragItem} />
        </DragOverlay>
      </div>
    </DndContext>
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
