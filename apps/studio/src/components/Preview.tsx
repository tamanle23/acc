import { createSignal, createMemo, createEffect, Show } from 'solid-js';
import { useDroppable } from '@dnd-kit/solid';
import { IRStateManager } from '../lib/ir/irState';
import { useIRState } from '../lib/ir/useStudioStore';
import { STAGING_PRESETS } from '../lib/library/stagingPresets';
import {
  ViewportControlBar,
  type PreviewResolutionMode,
  ViewportSafeGuides,
  ViewportQuickTransport,
  TelemetryCompanionCard,
  InPlaceTextEditor,
  UniversalCanvasHitOverlay,
  StagingDropTargetOverlay,
  TransformGizmoOverlay,
  LightGizmoOverlay,
  ViewportCanvasLayer,
  useViewportPanZoom,
  useGizmoTransform,
  usePreviewHotkeys,
  useViewportRenderStrategy,
  useContainerLOD,
} from './preview/index';

const EMPTY_ASSETS: Record<string, any> = {};

export interface PreviewProps {
  playhead: {
    currentFrame: number;
    totalFrames: number;
    currentTime: number;
    fps: number;
  };
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onScrub?: (frame: number) => void;
}

export function Preview(props: PreviewProps) {
  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement | null>(null);
  const [overlayCanvasRef, setOverlayCanvasRef] = createSignal<HTMLCanvasElement | null>(null);
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | null>(null);

  // Adaptive Container LOD (Level of Detail) Tracking for Floating HUDs
  const containerLOD = useContainerLOD(containerRef);

  // Droppable container for dragging library presets into the viewport
  const droppable = useDroppable({
    id: 'canvas-viewport-drop-zone',
    data: {
      type: 'canvas-viewport',
      getNormalizedCoords: (clientX: number, clientY: number) => {
        const rect = canvasRef()?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          return {
            normX: Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width)),
            normY: Math.max(0.05, Math.min(0.95, (clientY - rect.top) / rect.height)),
          };
        }
        return { normX: 0.5, normY: 0.5 };
      },
    },
  });

  // Global IR Reactive Subscription
  const irState = useIRState();

  const width = () => irState.doc?.meta?.canvasSize?.w || 1920;
  const height = () => irState.doc?.meta?.canvasSize?.h || 1080;
  const currentFrame = () => props.playhead?.currentFrame || 0;
  const fps = () => props.playhead?.fps || 30;
  const totalFrames = () => props.playhead?.totalFrames || irState.timeline?.totalFrames || 300;
  const selectedSeqId = () => irState.selectedSequenceId;

  // Viewport Control & Overlay States
  const [isLocked, setIsLocked] = createSignal(false);
  const [safeGuidesMode, setSafeGuidesMode] = createSignal<'none' | '16:9' | '9:16'>('none');
  const [showCheckerboard, setShowCheckerboard] = createSignal(false);
  const [showVfxAmbiance, setShowVfxAmbiance] = createSignal(true);
  const [showDepthHeatmap, setShowDepthHeatmap] = createSignal(false);
  const [visionPassMode, setVisionPassMode] = createSignal<'composite' | 'depth' | 'normals' | 'alpha'>('composite');
  const [isTelemetryCompanionOpen, setIsTelemetryCompanionOpen] = createSignal(false);
  const [editingCue, setEditingCue] = createSignal<{ sequenceId: string; cueIndex: number; text: string } | null>(null);

  // Configurable Virtual Preview Buffer Resolution
  const [previewResolution, setPreviewResolution] = createSignal<PreviewResolutionMode>(0.5);

  // Calculate active virtual resolution scale
  const activeScale = () => {
    const res = previewResolution();
    if (res === 'auto') {
      return props.isPlaying ? 0.5 : 1.0;
    }
    return res;
  };

  const virtualWidth = () => Math.max(320, Math.round(width() * activeScale()));
  const virtualHeight = () => Math.max(180, Math.round(height() * activeScale()));

  // Staging Drag-and-Drop States
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [dragCoords, setDragCoords] = createSignal<{ normX: number; normY: number } | null>(null);

  // Domain Hook 1: Pan & Zoom Navigation
  const panZoom = useViewportPanZoom();

  // Query active sequences for hit detection, textures & rendering
  const activeSequences = createMemo(
    () => irState.intervalTree?.queryActive(currentFrame()) || []
  );
  const clearColor = () => (showCheckerboard() ? 'transparent' : '#000000');
  const debugMode = () => {
    const pass = visionPassMode();
    if (pass === 'depth' || showDepthHeatmap()) return 'depth_heatmap';
    if (pass === 'normals') return 'normals';
    if (pass === 'alpha') return 'alpha';
    return 'none';
  };

  // Domain Hook 4: Viewport Render Strategy (Decoupled Worker / Main-Thread Pipeline)
  const renderStrategy = useViewportRenderStrategy({
    canvasRef,
    overlayCanvasRef,
    get timeline() {
      return irState.timeline;
    },
    get assetsMap() {
      return irState.doc?.assets || EMPTY_ASSETS;
    },
    get width() {
      return virtualWidth();
    },
    get height() {
      return virtualHeight();
    },
    get timelineWidth() {
      return width();
    },
    get timelineHeight() {
      return height();
    },
    get fps() {
      return fps();
    },
    get totalFrames() {
      return totalFrames();
    },
    get currentFrame() {
      return currentFrame();
    },
    get isPlaying() {
      return props.isPlaying ?? false;
    },
    get clearColor() {
      return clearColor();
    },
    get debugMode() {
      return debugMode();
    },
    get activeSeqs() {
      return activeSequences();
    },
  });

  // Domain Hook 2: Gizmo Direct Manipulation & Vector Snapping
  const gizmo = useGizmoTransform({
    get selectedSeqId() {
      return selectedSeqId();
    },
    get width() {
      return width();
    },
    get height() {
      return height();
    },
    get isLocked() {
      return isLocked();
    },
    get timeline() {
      return irState.timeline;
    },
    get doc() {
      return irState.doc;
    },
    get activeSequences() {
      return activeSequences();
    },
    get previewEngine() {
      return renderStrategy.previewEngine;
    },
    onRenderFrame: () => renderStrategy.renderFrame(currentFrame()),
  });

  // Domain Hook 3: Global Keyboard Hotkeys
  usePreviewHotkeys({
    selectedSeqId: () => selectedSeqId(),
    editingCue,
    setEditingCue,
    isSpacePressed: () => panZoom.isSpacePressed,
    setIsSpacePressed: panZoom.setIsSpacePressed,
    setVisionPassMode,
  });

  const handleCommitText = () => {
    const cue = editingCue();
    if (cue) {
      const rawTracks = irState.timeline?.tracks;
      const tracks = rawTracks instanceof Map
        ? Array.from(rawTracks.values())
        : Array.isArray(rawTracks)
          ? rawTracks
          : [];
      const allSeqs = tracks.flatMap((t: any) => t.sequences || []);
      const seq = allSeqs.find((s: any) => s.id === cue.sequenceId);
      const textMod = seq?.modifiers?.find((m: any) => m.type === 'text/draw' || m.type === 'text/overlay');
      if (textMod) {
        IRStateManager.getInstance().updateModifier(cue.sequenceId, textMod.type, { text: cue.text });
      } else {
        IRStateManager.getInstance().updateTextCue(cue.sequenceId, cue.cueIndex, cue.text);
      }
      setEditingCue(null);
    }
  };

  // Vector Snapping Guide Canvas Render Pass
  createEffect(() => {
    if (props.isPlaying) return; // Zero GPU compositor / canvas overhead during active playback
    const overlayCanvas = overlayCanvasRef();
    if (overlayCanvas) {
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        const vW = virtualWidth();
        const vH = virtualHeight();
        overlayCtx.clearRect(0, 0, vW, vH);
        if (selectedSeqId() && gizmo.activeGuides.length > 0) {
          gizmo.overlayRef.current.renderGuides(overlayCtx, vW, vH, gizmo.activeGuides);
        }
      }
    }
  });

  const handleMouseMove = (e: MouseEvent) => {
    panZoom.handleMouseMovePan(e);
  };

  // Drag-and-drop preset handlers from catalog
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    const rect = canvasRef()?.getBoundingClientRect();
    if (rect) {
      const normX = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));
      setDragCoords({ normX, normY });
    }
    setIsDragOver(true);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragCoords(null);

    const presetId = e.dataTransfer?.getData('application/x-studio-preset');
    const preset = STAGING_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    try {
      let normX = 0.5;
      let normY = 0.5;
      const rect = canvasRef()?.getBoundingClientRect();
      if (rect) {
        normX = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
        normY = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));
      }

      const seq = preset.createSequence({
        startFrame: currentFrame(),
        normX,
        normY,
      });
      IRStateManager.getInstance().addSequence(preset.targetTrackId, seq, {
        trackTypeFallback: preset.targetTrackType,
        trackNameFallback: preset.targetTrackName,
      });
    } catch (err) {
      console.error('[Preview] Drop error:', err);
    }
  };

  const selectedSeq = () => {
    const id = selectedSeqId();
    if (!id) return undefined;
    return (
      irState.timeline?.sequences?.get(id) ||
      irState.doc?.tracks.flatMap((t) => t.sequences).find((s) => s.id === id)
    );
  };

  const hasTransformModifier = () =>
    Boolean(selectedSeq()?.modifiers?.some((m) => m.type === 'transform'));

  return (
    <div
      id="preview-inner"
      ref={(el) => {
        setContainerRef(el);
        droppable.ref(el);
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={panZoom.handleMouseUpPan}
      onDragOver={handleDragOver}
      onDragLeave={() => {
        setIsDragOver(false);
        setDragCoords(null);
      }}
      onDrop={handleDrop}
      class={`relative h-full w-full flex flex-col items-center justify-center p-0 overflow-hidden rounded-2xl select-none transition-all duration-300 ${
        droppable.isDropTarget()
          ? 'ring-2 ring-[var(--accent-primary)] shadow-[0_0_35px_var(--accent-glow)] scale-[1.005]'
          : 'hover:border-[var(--glass-border-highlight)]'
      }`}
    >
      <Show when={showVfxAmbiance()}>
        <div class="absolute inset-0 pointer-events-none opacity-40 liquid-ambient-mesh transition-opacity duration-300" />
      </Show>

      {/* Top Monitor Status Bar */}
      <ViewportControlBar
        width={width()}
        height={height()}
        virtualWidth={virtualWidth()}
        virtualHeight={virtualHeight()}
        previewResolution={previewResolution()}
        onSetPreviewResolution={setPreviewResolution}
        fps={fps()}
        isPlaying={props.isPlaying ?? false}
        currentFrame={currentFrame()}
        totalFrames={totalFrames()}
        onTogglePlay={props.onTogglePlay}
        selectedSeqId={selectedSeqId()}
        transform={gizmo.transform}
        activeGuides={gizmo.activeGuides}
        zoomLevel={panZoom.zoomLevel}
        onSetZoomLevel={panZoom.setZoomLevel}
        onResetPan={panZoom.resetPanZoom}
        isPanToolActive={panZoom.isPanToolActive}
        isSpacePressed={panZoom.isSpacePressed}
        onTogglePanTool={() => panZoom.setIsPanToolActive(!panZoom.isPanToolActive)}
        safeGuidesMode={safeGuidesMode()}
        onCycleSafeGuides={() => {
          setSafeGuidesMode((prev) => (prev === 'none' ? '16:9' : prev === '16:9' ? '9:16' : 'none'));
        }}
        showCheckerboard={showCheckerboard()}
        onToggleCheckerboard={() => setShowCheckerboard(!showCheckerboard())}
        showVfxAmbiance={showVfxAmbiance()}
        onToggleVfxAmbiance={() => setShowVfxAmbiance(!showVfxAmbiance())}
        visionPassMode={visionPassMode()}
        onCycleVisionPass={() => {
          setVisionPassMode((prev) =>
            prev === 'composite' ? 'depth' : prev === 'depth' ? 'normals' : prev === 'normals' ? 'alpha' : 'composite'
          );
        }}
        showDepthHeatmap={showDepthHeatmap()}
        onToggleDepthHeatmap={() => setShowDepthHeatmap(!showDepthHeatmap())}
        isTelemetryCompanionOpen={isTelemetryCompanionOpen()}
        onToggleTelemetryCompanion={() => setIsTelemetryCompanionOpen(!isTelemetryCompanionOpen())}
        lod={containerLOD()} /* lod={containerLOD} */
      />

      {/* Dynamic Viewport: Canvas Cell + Dockable Telemetry Companion */}
      <div
        class={`w-full flex-1 flex flex-col xl:flex-row items-center justify-center gap-4 px-2 pt-14 pb-14 max-w-full overflow-hidden ${
          isTelemetryCompanionOpen() ? 'xl:justify-between' : 'justify-center'
        }`}
      >
        <div
          class={`relative w-full h-full flex items-center justify-center isolate rounded-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.7)] border border-[var(--glass-border)] bg-black select-none transition-all duration-300 ${
            panZoom.isPanToolActive || panZoom.isSpacePressed
              ? panZoom.isPanning
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : ''
          } ${isTelemetryCompanionOpen() ? 'xl:max-w-[calc(100%-270px)]' : 'max-w-full'}`}
          style={{
            "aspect-ratio": `${width()} / ${height()}`,
            "max-height": '68vh',
            "max-width": isTelemetryCompanionOpen() ? '72vw' : '82vw',
            "background-image": showCheckerboard()
              ? 'repeating-conic-gradient(rgba(255,255,255,0.07) 0% 25%, transparent 0% 50%)'
              : undefined,
            "background-size": showCheckerboard() ? '20px 20px' : undefined,
            transform:
              panZoom.zoomLevel === 'fit'
                ? 'none'
                : `translate(${panZoom.panOffset.x}px, ${panZoom.panOffset.y}px) scale(${panZoom.zoomLevel})`,
            "transform-origin": 'center center',
            transition: panZoom.isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
          onMouseDown={(e) => {
            if (panZoom.isPanToolActive || panZoom.isSpacePressed || e.button === 1) {
              panZoom.handleMouseDownPan(e);
            } else if (e.target === canvasRef()) {
              IRStateManager.getInstance().setSelectedSequenceId(null);
              IRStateManager.getInstance().setInspectorMode('timeline');
            }
          }}
        >
          {/* Dual-Layer Viewport Canvas */}
          <ViewportCanvasLayer
            canvasRef={setCanvasRef}
            overlayCanvasRef={setOverlayCanvasRef}
            isPanToolActive={panZoom.isPanToolActive}
            isSpacePressed={panZoom.isSpacePressed}
          />

          {/* Safe Guides */}
          <ViewportSafeGuides
            mode={safeGuidesMode() === 'none' ? 'none' : 'auto'}
            aspectRatio={irState.doc?.meta?.aspectRatio}
          />

          {/* Drag-and-Drop Staging Overlay */}
          <StagingDropTargetOverlay
            isOver={droppable.isDropTarget()}
            isDragOver={isDragOver()}
            dragCoords={dragCoords()}
          />

          {/* 2D Vector Transform Gizmo */}
          <Show when={hasTransformModifier() && !props.isPlaying && !editingCue()}>
            <TransformGizmoOverlay
              selectedSeqId={selectedSeqId()}
              activeSequences={activeSequences()}
              currentFrame={currentFrame()}
              width={width()}
              height={height()}
              isLocked={isLocked()}
              transform={gizmo.transform}
              isDragging={gizmo.isDragging}
              telemetry={gizmo.telemetry}
              targetBounds={gizmo.targetBounds}
              hudControls={gizmo.hudControls}
              previewEngine={renderStrategy.previewEngine}
              onHandlePointerDown={gizmo.handlePointerDown}
              onHandlePointerMove={gizmo.handlePointerMove}
              onHandlePointerUp={gizmo.handlePointerUp}
              onHandlePointerCancel={gizmo.handlePointerCancel}
              onSetTransform={gizmo.setTransform}
              onToggleLock={() => setIsLocked(!isLocked())}
              onStartEditingCue={setEditingCue}
            />
          </Show>

          {/* 3D Point Light Gizmo */}
          <LightGizmoOverlay
            selectedSeqId={selectedSeqId()}
            activeSequences={activeSequences()}
            width={width()}
            height={height()}
            zoomLevel={panZoom.zoomLevel}
          />

          {/* Hit Detection Overlay */}
          <UniversalCanvasHitOverlay
            activeSequences={activeSequences()}
            selectedSeqId={selectedSeqId()}
            tracks={irState.doc?.tracks || []}
            onStartEditingCue={setEditingCue}
          />

          {/* Studio-Grade In-Place On-Canvas Text Editor */}
          <Show when={editingCue()}>
            <InPlaceTextEditor
              editingCue={editingCue()}
              selectedSeq={activeSequences().find((s) => s.id === editingCue()!.sequenceId) || null}
              bounds={gizmo.targetBounds}
              transform={gizmo.transform}
              canvasWidth={width()}
              canvasHeight={height()}
              onUpdateText={(text) => setEditingCue((prev) => (prev ? { ...prev, text } : null))}
              onCommit={handleCommitText}
              onCancel={() => setEditingCue(null)}
            />
          </Show>
        </div>

        {/* Telemetry Companion Card */}
        <Show when={isTelemetryCompanionOpen()}>
          <div class="w-full xl:w-64 shrink-0 flex flex-col justify-center animate-in fade-in slide-in-from-right-2 duration-200">
            <TelemetryCompanionCard
              width={width()}
              height={height()}
              fps={fps()}
              currentFrame={currentFrame()}
              totalFrames={totalFrames()}
              trackCount={
                irState.timeline?.tracks instanceof Map
                  ? irState.timeline.tracks.size
                  : ((irState.timeline?.tracks as unknown as any[])?.length ?? 0)
              }
              activeSequenceCount={activeSequences().length}
              selectedSeqId={selectedSeqId()}
              safeGuidesMode={safeGuidesMode()}
              onCycleSafeGuides={() => {
                setSafeGuidesMode((prev) => (prev === 'none' ? '16:9' : prev === '16:9' ? '9:16' : 'none'));
              }}
              showCheckerboard={showCheckerboard()}
              onToggleCheckerboard={() => setShowCheckerboard(!showCheckerboard())}
              showVfxAmbiance={showVfxAmbiance()}
              onToggleVfxAmbiance={() => setShowVfxAmbiance(!showVfxAmbiance())}
              zoomLevel={panZoom.zoomLevel}
              onSetZoomLevel={panZoom.setZoomLevel}
            />
          </div>
        </Show>
      </div>

      {/* Floating Studio Quick Playback Transport HUD */}
      <ViewportQuickTransport
        isPlaying={props.isPlaying ?? false}
        onTogglePlay={props.onTogglePlay}
        currentFrame={currentFrame()}
        totalFrames={totalFrames()}
        fps={fps()}
        onScrub={props.onScrub}
        zoomLevel={panZoom.zoomLevel}
        onSetZoomLevel={panZoom.setZoomLevel}
        onResetPan={panZoom.resetPanZoom}
        lod={containerLOD()} /* lod={containerLOD} */
      />
    </div>
  );
}
