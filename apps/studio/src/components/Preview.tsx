import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { IRStateManager } from '../lib/ir/irState';
import { useIRState } from '../lib/ir/useStudioStore';
import { STAGING_PRESETS } from '../lib/library/stagingPresets';
import {
  ViewportControlBar,
  ViewportSafeGuides,
  TelemetryCompanionCard,
  InlineTextEditorModal,
  UniversalCanvasHitOverlay,
  StagingDropTargetOverlay,
  TransformGizmoOverlay,
  LightGizmoOverlay,
  ViewportCanvasLayer,
  useViewportPanZoom,
  useGizmoTransform,
  usePreviewHotkeys,
  useViewportRenderStrategy,
} from './preview/index';

interface PreviewProps {
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

export function Preview({
  playhead,
  isPlaying = false,
  onTogglePlay,
}: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Droppable container for dragging library presets into the viewport
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: 'canvas-viewport-drop-zone',
    data: {
      type: 'canvas-viewport',
      getNormalizedCoords: (clientX: number, clientY: number) => {
        const rect = canvasRef.current?.getBoundingClientRect();
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

  const width = irState.doc?.meta?.canvasSize?.w || 1920;
  const height = irState.doc?.meta?.canvasSize?.h || 1080;
  const currentFrame = playhead?.currentFrame || 0;
  const fps = playhead?.fps || 30;
  const totalFrames = playhead?.totalFrames || irState.timeline?.totalFrames || 300;
  const selectedSeqId = irState.selectedSequenceId;

  // Viewport Control & Overlay States
  const [isLocked, setIsLocked] = useState(false);
  const [safeGuidesMode, setSafeGuidesMode] = useState<'none' | '16:9' | '9:16'>('none');
  const [showCheckerboard, setShowCheckerboard] = useState(false);
  const [showVfxAmbiance, setShowVfxAmbiance] = useState(true);
  const [showDepthHeatmap, setShowDepthHeatmap] = useState(false);
  const [visionPassMode, setVisionPassMode] = useState<'composite' | 'depth' | 'normals' | 'alpha'>('composite');
  const [isTelemetryCompanionOpen, setIsTelemetryCompanionOpen] = useState(false);
  const [editingCue, setEditingCue] = useState<{ sequenceId: string; cueIndex: number; text: string } | null>(null);

  // Staging Drag-and-Drop States
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCoords, setDragCoords] = useState<{ normX: number; normY: number } | null>(null);

  // Domain Hook 1: Pan & Zoom Navigation
  const panZoom = useViewportPanZoom();

  // Query active sequences for hit detection, textures & rendering
  const activeSequences = irState.intervalTree?.queryActive(currentFrame) || [];
  const clearColor = showCheckerboard ? 'transparent' : '#000000';
  const debugMode =
    visionPassMode === 'depth' || showDepthHeatmap
      ? 'depth_heatmap'
      : visionPassMode === 'normals'
        ? 'normals'
        : visionPassMode === 'alpha'
          ? 'alpha'
          : 'none';

  // Domain Hook 4: Viewport Render Strategy (Decoupled Worker / Main-Thread Pipeline)
  const renderStrategy = useViewportRenderStrategy({
    canvasRef,
    overlayCanvasRef,
    timeline: irState.timeline,
    assetsMap: irState.doc?.assets || {},
    width,
    height,
    fps,
    totalFrames,
    currentFrame,
    isPlaying,
    clearColor,
    debugMode,
    activeSeqs: activeSequences,
  });

  // Domain Hook 2: Gizmo Direct Manipulation & Vector Snapping
  const gizmo = useGizmoTransform({
    selectedSeqId,
    width,
    height,
    isLocked,
    timeline: irState.timeline,
    doc: irState.doc,
    previewEngine: renderStrategy.previewEngine,
  });

  // Domain Hook 3: Global Keyboard Hotkeys
  usePreviewHotkeys({
    selectedSeqId,
    editingCue,
    setEditingCue,
    isSpacePressed: panZoom.isSpacePressed,
    setIsSpacePressed: panZoom.setIsSpacePressed,
    setVisionPassMode,
  });

  // Vector Snapping Guide Canvas Render Pass
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        overlayCtx.clearRect(0, 0, width, height);
        if (selectedSeqId && gizmo.activeGuides.length > 0) {
          gizmo.overlayRef.current.renderGuides(overlayCtx, width, height, gizmo.activeGuides);
        }
      }
    }
  }, [selectedSeqId, gizmo.activeGuides, width, height]);

  // Mouse pan and coordinate tracking
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      panZoom.handleMouseMovePan(e);
    },
    [panZoom]
  );

  // Drag-and-drop preset handlers from catalog
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const normX = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));
      setDragCoords({ normX, normY });
    }
    setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragCoords(null);

    const presetId = e.dataTransfer.getData('application/x-studio-preset');
    const preset = STAGING_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    try {
      let normX = 0.5;
      let normY = 0.5;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        normX = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
        normY = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));
      }

      const seq = preset.createSequence({
        startFrame: currentFrame,
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

  const selectedSeq = selectedSeqId
    ? irState.timeline?.sequences?.get(selectedSeqId) ||
      irState.doc?.tracks.flatMap((t) => t.sequences).find((s) => s.id === selectedSeqId)
    : undefined;
  const hasTransformModifier = Boolean(selectedSeq?.modifiers?.some((m) => m.type === 'transform'));

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        setDroppableRef(node);
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={panZoom.handleMouseUpPan}
      onDragOver={handleDragOver}
      onDragLeave={() => {
        setIsDragOver(false);
        setDragCoords(null);
      }}
      onDrop={handleDrop}
      className={`relative max-h-full max-w-full flex flex-col items-center justify-center p-0 overflow-hidden rounded-2xl select-none transition-all duration-300 ${
        isOver
          ? 'ring-2 ring-[var(--accent-primary)] shadow-[0_0_35px_var(--accent-glow)] scale-[1.005]'
          : 'hover:border-[var(--glass-border-highlight)]'
      }`}
    >
      <div className="absolute inset-0 pointer-events-none opacity-40 liquid-ambient-mesh" />

      {/* Top Monitor Status Bar */}
      <ViewportControlBar
        width={width}
        height={height}
        isPlaying={isPlaying}
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        onTogglePlay={onTogglePlay}
        selectedSeqId={selectedSeqId}
        transform={gizmo.transform}
        activeGuides={gizmo.activeGuides}
        zoomLevel={panZoom.zoomLevel}
        onSetZoomLevel={panZoom.setZoomLevel}
        onResetPan={panZoom.resetPanZoom}
        isPanToolActive={panZoom.isPanToolActive}
        isSpacePressed={panZoom.isSpacePressed}
        onTogglePanTool={() => panZoom.setIsPanToolActive(!panZoom.isPanToolActive)}
        safeGuidesMode={safeGuidesMode}
        onCycleSafeGuides={() => {
          setSafeGuidesMode((prev) => (prev === 'none' ? '16:9' : prev === '16:9' ? '9:16' : 'none'));
        }}
        showCheckerboard={showCheckerboard}
        onToggleCheckerboard={() => setShowCheckerboard(!showCheckerboard)}
        showVfxAmbiance={showVfxAmbiance}
        onToggleVfxAmbiance={() => setShowVfxAmbiance(!showVfxAmbiance)}
        visionPassMode={visionPassMode}
        onCycleVisionPass={() => {
          setVisionPassMode((prev) =>
            prev === 'composite' ? 'depth' : prev === 'depth' ? 'normals' : prev === 'normals' ? 'alpha' : 'composite'
          );
        }}
        showDepthHeatmap={showDepthHeatmap}
        onToggleDepthHeatmap={() => setShowDepthHeatmap(!showDepthHeatmap)}
        isTelemetryCompanionOpen={isTelemetryCompanionOpen}
        onToggleTelemetryCompanion={() => setIsTelemetryCompanionOpen(!isTelemetryCompanionOpen)}
      />

      {/* Dynamic Viewport: Canvas Cell + Dockable Telemetry Companion */}
      <div
        className={`w-full flex-1 flex flex-col xl:flex-row items-center justify-center gap-4 px-2 py-1 max-w-full overflow-hidden ${
          isTelemetryCompanionOpen ? 'xl:justify-between' : 'justify-center'
        }`}
      >
        <div
          className={`relative flex items-center justify-center isolate rounded-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.7)] border border-[var(--glass-border)] bg-black select-none transition-all duration-300 ${
            panZoom.isPanToolActive || panZoom.isSpacePressed ? (panZoom.isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
          } ${isTelemetryCompanionOpen ? 'xl:max-w-[calc(100%-270px)]' : 'max-w-full'}`}
          style={{
            aspectRatio: '16/9',
            maxHeight: '68vh',
            maxWidth: isTelemetryCompanionOpen ? '72vw' : '82vw',
            backgroundImage: showCheckerboard
              ? 'repeating-conic-gradient(rgba(255,255,255,0.07) 0% 25%, transparent 0% 50%)'
              : undefined,
            backgroundSize: showCheckerboard ? '20px 20px' : undefined,
            transform:
              panZoom.zoomLevel === 'fit'
                ? 'none'
                : `translate(${panZoom.panOffset.x}px, ${panZoom.panOffset.y}px) scale(${panZoom.zoomLevel})`,
            transformOrigin: 'center center',
            transition: panZoom.isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
          onMouseDown={(e) => {
            if (panZoom.isPanToolActive || panZoom.isSpacePressed || e.button === 1) {
              panZoom.handleMouseDownPan(e);
            } else if (e.target === canvasRef.current) {
              IRStateManager.getInstance().setSelectedSequenceId(null);
              IRStateManager.getInstance().setInspectorMode('project');
            }
          }}
        >
          {/* Dual-Layer Viewport Canvas */}
          <ViewportCanvasLayer
            canvasRef={canvasRef}
            overlayCanvasRef={overlayCanvasRef}
            isPanToolActive={panZoom.isPanToolActive}
            isSpacePressed={panZoom.isSpacePressed}
          />

          {/* Safe Guides */}
          <ViewportSafeGuides mode={safeGuidesMode} />

          {/* Drag-and-Drop Staging Overlay */}
          <StagingDropTargetOverlay isOver={isOver} isDragOver={isDragOver} dragCoords={dragCoords} />

          {/* 2D Vector Transform Gizmo */}
          {hasTransformModifier && (
            <TransformGizmoOverlay
              key={selectedSeqId || 'no-seq-gizmo'}
              selectedSeqId={selectedSeqId}
              activeSequences={activeSequences}
              currentFrame={currentFrame}
              isLocked={isLocked}
              transform={gizmo.transform}
              isDragging={gizmo.isDragging}
              previewEngine={renderStrategy.previewEngine}
              transformSensors={gizmo.transformSensors}
              onTransformDragStart={gizmo.handleTransformDragStart}
              onTransformDragMove={gizmo.handleTransformDragMove}
              onTransformDragEnd={gizmo.handleTransformDragEnd}
              onSetTransform={gizmo.setTransform}
              onToggleLock={() => setIsLocked(!isLocked)}
              onStartEditingCue={setEditingCue}
            />
          )}

          {/* 3D Point Light Gizmo */}
          <LightGizmoOverlay
            selectedSeqId={selectedSeqId}
            activeSequences={activeSequences}
            width={width}
            height={height}
            zoomLevel={panZoom.zoomLevel}
          />

          {/* Hit Detection Overlay */}
          <UniversalCanvasHitOverlay
            activeSequences={activeSequences}
            selectedSeqId={selectedSeqId}
            tracks={irState.doc?.tracks || []}
            onStartEditingCue={setEditingCue}
          />
        </div>

        {/* Telemetry Companion Card */}
        {isTelemetryCompanionOpen && (
          <div className="w-full xl:w-64 shrink-0 flex flex-col justify-center animate-in fade-in slide-in-from-right-2 duration-200">
            <TelemetryCompanionCard
              width={width}
              height={height}
              fps={fps}
              currentFrame={currentFrame}
              totalFrames={totalFrames}
              trackCount={
                irState.timeline?.tracks?.length ||
                (irState.timeline?.tracks instanceof Map ? irState.timeline.tracks.size : 0) ||
                0
              }
              activeSequenceCount={activeSequences.length}
              selectedSeqId={selectedSeqId}
              safeGuidesMode={safeGuidesMode}
              onCycleSafeGuides={() => {
                setSafeGuidesMode((prev) => (prev === 'none' ? '16:9' : prev === '16:9' ? '9:16' : 'none'));
              }}
              showCheckerboard={showCheckerboard}
              onToggleCheckerboard={() => setShowCheckerboard(!showCheckerboard)}
              showVfxAmbiance={showVfxAmbiance}
              onToggleVfxAmbiance={() => setShowVfxAmbiance(!showVfxAmbiance)}
              zoomLevel={panZoom.zoomLevel}
              onSetZoomLevel={panZoom.setZoomLevel}
            />
          </div>
        )}
      </div>

      {/* Floating Inline Text Editor Modal */}
      <InlineTextEditorModal
        editingCue={editingCue}
        onUpdateText={(text) => setEditingCue((prev) => (prev ? { ...prev, text } : null))}
        onCommit={() => {
          if (editingCue) {
            IRStateManager.getInstance().updateTextCue(editingCue.sequenceId, editingCue.cueIndex, editingCue.text);
            setEditingCue(null);
          }
        }}
        onCancel={() => setEditingCue(null)}
      />
    </div>
  );
}
