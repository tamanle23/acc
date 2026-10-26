import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  useDroppable,
  DndContext,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { IRStateManager } from '../lib/ir/irState';
import { AssetTextureCache } from '../lib/textures/AssetTextureCache';
import { useTheme } from '../lib/theme/ThemeProvider';
import {
  ViewportControlBar,
  ViewportSafeGuides,
  TelemetryCompanionCard,
  InlineTextEditorModal,
  UniversalCanvasHitOverlay,
  StagingDropTargetOverlay,
  TransformGizmoOverlay,
  ViewportCanvasLayer,
} from './preview/index';
import { PreviewWorkerBridge } from '../lib/worker/PreviewWorkerBridge';
import {
  IRPreviewEngine,
} from '@acc/ir';
import {
  Gizmo2DTransformation,
  type BoundingBox2D,
  type SnappingGuide,
  type TransformHandleType,
} from '../lib/gizmo';
import { STAGING_PRESETS } from '../lib/library/stagingPresets';
import { StudioPlayheadController } from '../lib/playhead/StudioPlayheadController';

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

interface TransformState {
  x: number; // offset px
  y: number; // offset px
  scale: number; // 0.2 to 3.0
  rotation: number; // degrees
}

export function Preview({
  playhead,
  isPlaying = false,
  onTogglePlay,
  onScrub,
}: PreviewProps) {
  const { preferences } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previewEngineRef = useRef<IRPreviewEngine | null>(null);
  const overlayRef = useRef<Gizmo2DTransformation>(new Gizmo2DTransformation());
  const [glReady, setGlReady] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  // dnd-kit drop target
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: 'canvas-viewport-drop-zone',
  });

  // In-Canvas 2D Vector Transform & Magnetic Snapping State
  const [transform, setTransform] = useState<TransformState>({ x: 0, y: 0, scale: 1.0, rotation: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<TransformHandleType | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnappingGuide[]>([]);
  const [startPointer, setStartPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startTransform, setStartTransform] = useState<TransformState>({ x: 0, y: 0, scale: 1.0, rotation: 0 });

  // Viewport Header HUD, Navigation & Action Pill State (Phase 4)
  const [zoomLevel, setZoomLevel] = useState<'fit' | 0.5 | 1.0 | 2.0>('fit');
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanToolActive, setIsPanToolActive] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const [safeGuidesMode, setSafeGuidesMode] = useState<'none' | '16:9' | '9:16'>('none');
  const [showCheckerboard, setShowCheckerboard] = useState(false);
  const [showVfxAmbiance, setShowVfxAmbiance] = useState(true);

  // Drag-and-Drop Staging & Inline Text Editing State
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCoords, setDragCoords] = useState<{ normX: number; normY: number } | null>(null);
  const [editingCue, setEditingCue] = useState<{ sequenceId: string; cueIndex: number; text: string } | null>(null);
  const [isTelemetryCompanionOpen, setIsTelemetryCompanionOpen] = useState(false);

  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());
  const [assetTick, setAssetTick] = useState(0);

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  // Reactive subscription to AssetTextureCache (instant re-render when image/video decodes)
  useEffect(() => {
    return AssetTextureCache.getInstance().subscribe(() => {
      setAssetTick((t) => t + 1);
    });
  }, []);

  const width = irState.doc?.meta?.canvasSize?.w || 1920;
  const height = irState.doc?.meta?.canvasSize?.h || 1080;
  const currentFrame = playhead?.currentFrame || 0;
  const fps = playhead?.fps || 30;
  const totalFrames = playhead?.totalFrames || irState.timeline?.totalFrames || 300;
  const selectedSeqId = irState.selectedSequenceId;

  // Sync transform state from selected sequence modifier if available
  useEffect(() => {
    if (!selectedSeqId) return;
    const activeSeqs = irState.timeline?.sequences ? Array.from(irState.timeline.sequences.values()) : [];
    const seq = activeSeqs.find((s) => s.id === selectedSeqId);
    if (seq?.modifiers) {
      const transMod = seq.modifiers.find((m) => m.type === 'transform');
      if (transMod?.params) {
        const p = transMod.params as any;
        setTransform({
          x: p.x ?? 0,
          y: p.y ?? 0,
          scale: p.scale ?? 1.0,
          rotation: p.rotation ?? 0,
        });
      }
    }
  }, [selectedSeqId, irState]);

  const workerBridgeRef = useRef<PreviewWorkerBridge | null>(null);
  const [, setWorkerReady] = useState(false);

  // Initialize IRPreviewEngine or PreviewWorkerBridge on active timeline
  useEffect(() => {
    if (!irState.timeline) return;

    const baseCanvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (!workerBridgeRef.current) {
      workerBridgeRef.current = new PreviewWorkerBridge();
    }
    const bridge = workerBridgeRef.current;

    if (baseCanvas && !bridge.hasTransferred()) {
      baseCanvas.width = width;
      baseCanvas.height = height;
    }
    if (overlayCanvas) {
      overlayCanvas.width = width;
      overlayCanvas.height = height;
    }

    const assetsMap = irState.doc?.assets || {};

    if (baseCanvas && bridge.supportsOffscreen() && !bridge.hasTransferred()) {
      const transferred = bridge.init(baseCanvas, irState.timeline, width, height, fps, totalFrames, assetsMap);
      if (transferred) {
        setWorkerReady(true);
        bridge.onReady(() => {
          setAssetTick((t) => t + 1);
        });
      }
    }

    if (bridge.hasTransferred()) {
      bridge.updateTimeline(irState.timeline, totalFrames, fps, undefined, assetsMap);
    } else {
      const engine = new IRPreviewEngine(irState.timeline);
      previewEngineRef.current = engine;
    }
    setGlReady(true);
  }, [irState.timeline, irState.doc?.assets, width, height, fps, totalFrames]);

  useEffect(() => {
    return () => {
      workerBridgeRef.current?.destroy();
      workerBridgeRef.current = null;
    };
  }, []);

  // Event-Driven Render Execution on 2-Layer Decoupled Viewport Canvas
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;

    // Determine popOutIntensity from depth modifiers if present
    const activeSeqs = irState.intervalTree?.queryActive(currentFrame) || [];
    let popOutIntensity = 1.0;
    for (const seq of activeSeqs) {
      if (seq.modifiers) {
        for (const mod of seq.modifiers) {
          if (mod.type === 'vfx/depth3d') {
            const p = mod.params as any;
            if (typeof p.popOutIntensity === 'number') popOutIntensity = p.popOutIntensity;
          }
        }
      }
    }

    const bridge = workerBridgeRef.current;
    const studioTextureCache = AssetTextureCache.getInstance();
    const assetsMap = irState.doc?.assets || {};

    if (bridge && bridge.hasTransferred()) {
      // Synchronize image/placeholder textures to Web Worker; video assets are decoded directly inside preview.worker.ts via Mediabunny
      const activeTexturesToSync: Record<string, ImageBitmap> = {};
      const syncPromises: Promise<void>[] = [];

      for (const seq of activeSeqs) {
        if (seq.assetId) {
          const assetDef = assetsMap[seq.assetId];
          const assetSrc = assetDef?.src;
          const assetType = assetDef?.type;
          const isVideo =
            assetType === 'video' ||
            (assetSrc && assetSrc.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i));

          // For video assets, the worker decodes directly via MediabunnyWorkerReader
          if (isVideo) continue;

          const seqStart = seq.startFrame ?? 0;
          const seqLocalTimeSec = Math.max(0, (currentFrame - seqStart) / fps);

          const visualAsset = studioTextureCache.getVisualAsset(
            seq.assetId,
            assetSrc,
            (assetType as any),
            seqLocalTimeSec
          );

          if (visualAsset.source && typeof createImageBitmap === 'function') {
            const source = visualAsset.source;
            const assetId = seq.assetId;
            syncPromises.push(
              createImageBitmap(source as ImageBitmapSource)
                .then((bmp) => {
                  activeTexturesToSync[assetId] = bmp;
                })
                .catch(() => { })
            );
          }
        }
      }

      const clearColor = showCheckerboard ? 'transparent' : '#000000';

      if (syncPromises.length > 0) {
        Promise.all(syncPromises).then(() => {
          if (Object.keys(activeTexturesToSync).length > 0) {
            bridge.updateTextures(activeTexturesToSync);
          }
          // OffscreenCanvas Web Worker Pipeline (Smooth 60 fps, Zero Main-Thread Blocking)
          bridge.renderFrame(currentFrame, isPlaying ? 0.5 : 1.0, popOutIntensity, false, clearColor);
        });
      } else {
        bridge.renderFrame(currentFrame, isPlaying ? 0.5 : 1.0, popOutIntensity, false, clearColor);
      }
    } else {
      // Main-thread fallback
      const baseCanvas = canvasRef.current;
      const engine = previewEngineRef.current;
      if (baseCanvas && engine) {
        const baseCtx = baseCanvas.getContext('2d');
        if (baseCtx) {
          const clearColor = showCheckerboard ? 'transparent' : '#000000';
          if (!showCheckerboard) {
            baseCtx.fillStyle = '#000000';
            baseCtx.fillRect(0, 0, width, height);
          } else {
            baseCtx.clearRect(0, 0, width, height);
          }

          const engineTextures = engine.getTextureCache();

          for (const seq of activeSeqs) {
            if (seq.assetId) {
              const assetDef = assetsMap[seq.assetId];
              const assetSrc = assetDef?.src;
              const assetType = assetDef?.type;
              const seqStart = seq.startFrame ?? 0;
              const seqLocalTimeSec = Math.max(0, (currentFrame - seqStart) / fps);

              const visualAsset = studioTextureCache.getVisualAsset(
                seq.assetId,
                assetSrc,
                (assetType as any),
                seqLocalTimeSec
              );

              if (visualAsset.source) {
                engineTextures.set(seq.assetId, visualAsset.source);
              }
            }
          }

          engine.renderFrame(currentFrame, baseCtx, {
            textureCache: engineTextures,
            popOutIntensity,
            clearColor,
          });
        }
      }
    }

    // 2. Overlay Canvas Render Pass (Dedicated 2D Vector Snapping Guides - Zero UI artifacts in video)
    if (overlayCanvas) {
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        overlayCtx.clearRect(0, 0, width, height);
        if (selectedSeqId && activeGuides.length > 0) {
          overlayRef.current.renderGuides(overlayCtx, width, height, activeGuides);
        }
      }
    }
  }, [currentFrame, fps, irState, glReady, selectedSeqId, transform, activeGuides, width, height, showCheckerboard, showVfxAmbiance, isDragging, assetTick]);

  // High-Frequency Direct Playhead Subscription (Smooth 60fps OffscreenCanvas rendering without React re-renders)
  useEffect(() => {
    return StudioPlayheadController.getInstance().subscribeHighFrequency((frame, playing) => {
      const bridge = workerBridgeRef.current;
      if (bridge && bridge.hasTransferred()) {
        bridge.renderFrame(frame, playing ? 0.5 : 1.0, 1.0, !playing);
      }
    });
  }, []);

  // Dedicated @dnd-kit sensors and drag handlers for Transform Overlay
  const transformSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleTransformDragStart = (e: DragStartEvent) => {
    if (isLocked) return;
    const data = e.active.data.current;
    if (!data) return;

    const handleType = data.handleType as TransformHandleType;
    setIsDragging(true);
    setActiveHandle(handleType);
    setStartTransform({ ...transform });

    const mode = handleType === 'body' ? 'move' : handleType === 'rotate' ? 'rotate' : 'resize';
    overlayRef.current.setActiveInteraction(handleType, mode);
  };

  const handleTransformDragMove = (e: DragMoveEvent) => {
    if (!isDragging || !activeHandle || !selectedSeqId || isLocked) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const dx = e.delta.x;
    const dy = e.delta.y;

    const baseW = 0.5;
    const baseH = 0.5;
    const startNormBox: BoundingBox2D = {
      x: 0.5 + startTransform.x / width,
      y: 0.5 + startTransform.y / height,
      width: baseW * startTransform.scale,
      height: baseH * startTransform.scale,
      rotation: startTransform.rotation,
    };

    const currentPointerNorm = {
      x: 0.5 + (startTransform.x + dx) / width,
      y: 0.5 + (startTransform.y + dy) / height,
    };
    const startPointerNorm = {
      x: 0.5 + startTransform.x / width,
      y: 0.5 + startTransform.y / height,
    };

    const dragRes = Gizmo2DTransformation.computeDragTransform(
      startNormBox,
      activeHandle,
      currentPointerNorm,
      startPointerNorm,
      false,
      false
    );

    if (dragRes.snapResult) {
      setActiveGuides(dragRes.snapResult.activeGuides);
    } else {
      setActiveGuides([]);
    }

    const newNormBox = dragRes.box;
    const newTransform: TransformState = {
      x: Math.round((newNormBox.x - 0.5) * width),
      y: Math.round((newNormBox.y - 0.5) * height),
      scale: Number((newNormBox.width / baseW).toFixed(2)),
      rotation: newNormBox.rotation,
    };

    setTransform(newTransform);
    overlayRef.current.update(newNormBox, dragRes.snapResult?.activeGuides || []);
  };

  const handleTransformDragEnd = (e: DragEndEvent) => {
    if (selectedSeqId && !isLocked) {
      IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', transform as any);
    }
    setIsDragging(false);
    setActiveHandle(null);
    setActiveGuides([]);
    overlayRef.current.setActiveInteraction(null, null);
  };


  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
        return;
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setMousePos({ x: normX, y: normY });
    },
    [isPanning, panStart]
  );

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Global Keyboard Shortcuts (Space for Pan/Play, Del, Ctrl+D, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        if (!isSpacePressed) {
          setIsSpacePressed(true);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedSeqId) {
          e.preventDefault();
          IRStateManager.getInstance().duplicateSequence(selectedSeqId);
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSeqId && !editingCue) {
          e.preventDefault();
          IRStateManager.getInstance().deleteSequence(selectedSeqId);
        }
      }

      if (e.key === 'Escape') {
        if (editingCue) {
          setEditingCue(null);
        } else if (selectedSeqId) {
          IRStateManager.getInstance().setSelectedSequenceId(null);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedSeqId, editingCue, isSpacePressed]);

  // Drag-and-Drop Staging Handlers
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

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
    setDragCoords(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragCoords(null);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const data = JSON.parse(raw);
      const preset = STAGING_PRESETS.find((p) => p.id === data.presetId);
      if (!preset) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      let normX = 0.5;
      let normY = 0.5;
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

  // Active cues and staged sequences
  const activeSequences = irState.intervalTree?.queryActive(currentFrame) || [];
  const activeCues = activeSequences
    .filter((s) => s.cues && s.cues.length > 0)
    .flatMap((s) => s.cues || []);

  const activeShapes = activeSequences.filter((s) =>
    s.modifiers?.some((m) => m.type === 'shape/vector')
  );

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        setDroppableRef(node);
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative max-h-full max-w-full flex flex-col items-center justify-center p-0 overflow-hidden rounded-2xl select-none transition-all duration-300 ${isOver
        ? 'ring-2 ring-[var(--accent-primary)] shadow-[0_0_35px_var(--accent-glow)] scale-[1.005]'
        : 'hover:border-[var(--glass-border-highlight)]'
        }`}
    >
      {/* Ambient Fluid Background Refraction Mesh */}
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
        transform={transform}
        activeGuides={activeGuides}
        zoomLevel={zoomLevel}
        onSetZoomLevel={setZoomLevel}
        onResetPan={() => setPanOffset({ x: 0, y: 0 })}
        isPanToolActive={isPanToolActive}
        isSpacePressed={isSpacePressed}
        onTogglePanTool={() => setIsPanToolActive(!isPanToolActive)}
        safeGuidesMode={safeGuidesMode}
        onCycleSafeGuides={() => {
          setSafeGuidesMode((prev) => {
            if (prev === 'none') return '16:9';
            if (prev === '16:9') return '9:16';
            return 'none';
          });
        }}
        showCheckerboard={showCheckerboard}
        onToggleCheckerboard={() => setShowCheckerboard(!showCheckerboard)}
        showVfxAmbiance={showVfxAmbiance}
        onToggleVfxAmbiance={() => setShowVfxAmbiance(!showVfxAmbiance)}
        isTelemetryCompanionOpen={isTelemetryCompanionOpen}
        onToggleTelemetryCompanion={() => setIsTelemetryCompanionOpen(!isTelemetryCompanionOpen)}
      />

      {/* Bento Grid Dynamic Viewport: Canvas Cell + Dockable Telemetry Cell */}
      <div className={`w-full flex-1 flex flex-col xl:flex-row items-center justify-center gap-4 px-2 py-1 max-w-full overflow-hidden ${isTelemetryCompanionOpen ? 'xl:justify-between' : 'justify-center'
        }`}>
        {/* Cell 1: Main Video Viewport Canvas */}
        <div
          className={`relative flex items-center justify-center isolate rounded-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.7)] border border-[var(--glass-border)] bg-black select-none transition-all duration-300 ${isPanToolActive || isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
            } ${isTelemetryCompanionOpen ? 'xl:max-w-[calc(100%-270px)]' : 'max-w-full'}`}
          style={{
            aspectRatio: '16/9',
            maxHeight: '68vh',
            maxWidth: isTelemetryCompanionOpen ? '72vw' : '82vw',
            backgroundImage: showCheckerboard
              ? 'repeating-conic-gradient(rgba(255,255,255,0.07) 0% 25%, transparent 0% 50%)'
              : undefined,
            backgroundSize: showCheckerboard ? '20px 20px' : undefined,
            transform: zoomLevel === 'fit' ? 'none' : `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
          onMouseDown={(e) => {
            if (isPanToolActive || isSpacePressed || e.button === 1) {
              e.preventDefault();
              setIsPanning(true);
              setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
            } else if (e.target === canvasRef.current) {
              // Clicking directly on canvas background deselects selection and switches to project inspection
              IRStateManager.getInstance().setSelectedSequenceId(null);
              IRStateManager.getInstance().setInspectorMode('project');
            }
          }}
        >
          {/* Decoupled Dual-Layer Viewport Canvas */}
          <ViewportCanvasLayer
            canvasRef={canvasRef}
            overlayCanvasRef={overlayCanvasRef}
            isPanToolActive={isPanToolActive}
            isSpacePressed={isSpacePressed}
          />

          {/* Broadcast 16:9 & Social 9:16 Safe Guides */}
          <ViewportSafeGuides mode={safeGuidesMode} />

          {/* Drag-and-Drop Staging Target Indicator */}
          <StagingDropTargetOverlay
            isOver={isOver}
            isDragOver={isDragOver}
            dragCoords={dragCoords}
          />

          {/* Interactive In-Canvas 2D Transform Bounding Box with 8 Handles & Contextual Action Pill */}
          <TransformGizmoOverlay
            selectedSeqId={selectedSeqId}
            activeSequences={activeSequences}
            currentFrame={currentFrame}
            isLocked={isLocked}
            transform={transform}
            isDragging={isDragging}
            previewEngine={previewEngineRef.current}
            transformSensors={transformSensors}
            onTransformDragStart={handleTransformDragStart}
            onTransformDragMove={handleTransformDragMove}
            onTransformDragEnd={handleTransformDragEnd}
            onSetTransform={setTransform}
            onToggleLock={() => setIsLocked(!isLocked)}
            onStartEditingCue={setEditingCue}
          />

          {/* Universal Polymorphic Canvas Hit-Test Overlay (Subtitles, Shapes, Images, Videos, Overlays) */}
          <UniversalCanvasHitOverlay
            activeSequences={activeSequences}
            selectedSeqId={selectedSeqId}
            tracks={irState.doc?.tracks || []}
            onStartEditingCue={setEditingCue}
          />
        </div>

        {/* Cell 2: Dockable Telemetry Companion Card */}
        {isTelemetryCompanionOpen && (
          <div className="w-full xl:w-64 shrink-0 flex flex-col justify-center animate-in fade-in slide-in-from-right-2 duration-200">
            <TelemetryCompanionCard
              width={width}
              height={height}
              fps={fps}
              currentFrame={currentFrame}
              totalFrames={totalFrames}
              trackCount={irState.timeline?.tracks?.length || (irState.timeline?.tracks instanceof Map ? irState.timeline.tracks.size : 0) || 0}
              activeSequenceCount={activeSequences.length}
              selectedSeqId={selectedSeqId}
              safeGuidesMode={safeGuidesMode}
              onCycleSafeGuides={() => {
                setSafeGuidesMode((prev) => {
                  if (prev === 'none') return '16:9';
                  if (prev === '16:9') return '9:16';
                  return 'none';
                });
              }}
              showCheckerboard={showCheckerboard}
              onToggleCheckerboard={() => setShowCheckerboard(!showCheckerboard)}
              showVfxAmbiance={showVfxAmbiance}
              onToggleVfxAmbiance={() => setShowVfxAmbiance(!showVfxAmbiance)}
              zoomLevel={zoomLevel}
              onSetZoomLevel={setZoomLevel}
            />
          </div>
        )}
      </div>

      {/* Floating Inline Canvas Text Editor Modal */}
      <InlineTextEditorModal
        editingCue={editingCue}
        onUpdateText={(text) => setEditingCue((prev) => prev ? { ...prev, text } : null)}
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
