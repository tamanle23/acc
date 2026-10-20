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
import { Tooltip } from './ui/tooltip';
import {
  Monitor,
  Sparkles,
  Box,
  Move,
  RotateCw,
  Type,
  ArrowUpRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Layers,
  Copy,
  Trash2,
  Lock,
  Unlock,
  AlignCenter,
  RotateCcw,
  Hand,
  Shield,
  Grid,
} from 'lucide-react';
import { IRStateManager } from '../lib/ir/irState';
import { DepthMathEngine } from '../lib/math/DepthMathEngine';
import { AssetTextureCache } from '../lib/textures/AssetTextureCache';
import { useTheme } from '../lib/theme/ThemeProvider';
export { ViewportControlBar } from './preview/ViewportControlBar';
export { ViewportSafeGuides } from './preview/ViewportSafeGuides';
export { ContextualActionPill } from './preview/ContextualActionPill';
export { SubtitlesOverlay } from './preview/SubtitlesOverlay';

import { ViewportControlBar } from './preview/ViewportControlBar';
import { ViewportSafeGuides } from './preview/ViewportSafeGuides';
import { ContextualActionPill } from './preview/ContextualActionPill';
import { SubtitlesOverlay } from './preview/SubtitlesOverlay';
import { PreviewWorkerBridge } from '../lib/worker/PreviewWorkerBridge';
import {
  IRPreviewEngine,
} from '@acc/ir';
import {
  UniversalCanvasProvider,
} from '@acc/effect-engines/client';
import {
  Gizmo2DTransformation,
  MagneticSnapEngine,
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

interface TransformHandleProps {
  handleType: TransformHandleType;
  isLocked: boolean;
  className: string;
  title: string;
  children?: React.ReactNode;
}

function TransformHandle({ handleType, isLocked, className, title, children }: TransformHandleProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `transform-handle-${handleType}`,
    data: {
      type: 'handle',
      handleType,
    },
    disabled: isLocked,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={className}
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

interface TransformBodyDraggableProps {
  children: React.ReactNode;
  isLocked: boolean;
  style: React.CSSProperties;
  className: string;
  onDoubleClick: () => void;
}

function TransformBodyDraggable({
  children,
  isLocked,
  style,
  className,
  onDoubleClick,
}: TransformBodyDraggableProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'transform-handle-body',
    data: {
      type: 'handle',
      handleType: 'body' as TransformHandleType,
    },
    disabled: isLocked,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={onDoubleClick}
      style={style}
      className={className}
    >
      {children}
    </div>
  );
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

  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());
  const [, setAssetTick] = useState(0);

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
          const assetType = assetDef?.type || 'media';
          const isVideo =
            assetType === 'video' ||
            assetType === 'media' ||
            (assetSrc && assetSrc.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i));

          // For video assets, the worker decodes directly via MediabunnyWorkerReader
          if (isVideo) continue;

          const seqStart = seq.startFrame ?? 0;
          const seqLocalTimeSec = Math.max(0, (currentFrame - seqStart) / fps);

          const visualAsset = studioTextureCache.getVisualAsset(
            seq.assetId,
            assetSrc,
            assetType === 'audio' ? 'media' : (assetType as any),
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
                .catch(() => {})
            );
          }
        }
      }

      if (syncPromises.length > 0) {
        Promise.all(syncPromises).then(() => {
          if (Object.keys(activeTexturesToSync).length > 0) {
            bridge.updateTextures(activeTexturesToSync);
          }
          // OffscreenCanvas Web Worker Pipeline (Smooth 60 fps, Zero Main-Thread Blocking)
          bridge.renderFrame(currentFrame, isPlaying ? 0.5 : 1.0, popOutIntensity);
        });
      } else {
        bridge.renderFrame(currentFrame, isPlaying ? 0.5 : 1.0, popOutIntensity);
      }
    } else {
      // Main-thread fallback
      const baseCanvas = canvasRef.current;
      const engine = previewEngineRef.current;
      if (baseCanvas && engine) {
        const baseCtx = baseCanvas.getContext('2d');
        if (baseCtx) {
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
              const assetType = assetDef?.type || 'media';
              const seqStart = seq.startFrame ?? 0;
              const seqLocalTimeSec = Math.max(0, (currentFrame - seqStart) / fps);

              const visualAsset = studioTextureCache.getVisualAsset(
                seq.assetId,
                assetSrc,
                assetType === 'audio' ? 'media' : (assetType as any),
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
  }, [currentFrame, fps, irState, glReady, selectedSeqId, transform, activeGuides, width, height, showCheckerboard, showVfxAmbiance, isDragging]);

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
      />

      {/* Main Video Viewport Canvas with Mouse Interactive Parallax & Staging Drop Target */}
      <div
        className={`relative flex items-center justify-center isolate rounded-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.7)] border border-[var(--glass-border)] bg-black select-none ${
          isPanToolActive || isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        style={{
          aspectRatio: '16/9',
          maxHeight: '70vh',
          maxWidth: '80vw',
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
        {/* Layer 1: Base Video IR Canvas (100% Pure Video IR) */}
        <canvas
          id="studio-canvas"
          ref={canvasRef}
          className={`w-full h-full object-contain block bg-black ${
            isPanToolActive || isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
          }`}
          style={{
            aspectRatio: '16/9',
            backgroundColor: '#000000',
          }}
        />

        {/* Layer 2: Dedicated Transparent Overlay Canvas (2D Snapping Guides & Alignment Only) */}
        <canvas
          id="studio-overlay-canvas"
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
          style={{
            aspectRatio: '16/9',
          }}
        />

        {/* Broadcast 16:9 & Social 9:16 Safe Guides */}
        <ViewportSafeGuides mode={safeGuidesMode} />

        {/* Drag-and-Drop Staging Target Indicator */}
        {(isOver || (isDragOver && dragCoords)) && (
          <div
            style={{
              left: dragCoords ? `${dragCoords.normX * 100}%` : '50%',
              top: dragCoords ? `${dragCoords.normY * 100}%` : '50%',
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-[var(--accent-primary)] bg-[var(--accent-glow)]/20 rounded-2xl p-5 flex flex-col items-center justify-center pointer-events-none z-30 shadow-[0_0_25px_var(--accent-glow)] backdrop-blur-md animate-pulse"
          >
            <Sparkles className="w-6 h-6 text-[var(--accent-primary)] animate-spin" />
            <span className="text-[11px] font-mono font-bold text-foreground mt-2 whitespace-nowrap drop-shadow-sm">
              {dragCoords
                ? `Drop to stage (${Math.round(dragCoords.normX * 100)}%, ${Math.round(dragCoords.normY * 100)}%)`
                : 'Drop into Canvas Viewport'}
            </span>
          </div>
        )}

        {/* Active Vector Shapes Overlays */}
        {activeShapes.map((seq) => {
          const mod = seq.modifiers?.find((m) => m.type === 'shape/vector');
          const trans = seq.modifiers?.find((m) => m.type === 'transform');
          const p = (mod?.params || {}) as any;
          const tp = (trans?.params || {}) as any;
          const normX = tp.normX ?? 0.5;
          const normY = tp.normY ?? 0.5;

          if (p.shapeType === 'rect' || p.shapeType === 'rounded_box') {
            return (
              <div
                key={seq.id}
                onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
                style={{
                  left: `${normX * 100}%`,
                  top: `${normY * 100}%`,
                  width: `${(p.width ?? 320) / 19.2}%`,
                  height: `${(p.height ?? 180) / 10.8}%`,
                  borderRadius: p.radius ? `${p.radius}px` : undefined,
                  border: `${p.strokeWidth || 2}px solid ${p.strokeColor || '#818cf8'}`,
                  backgroundColor: p.fillColor || 'transparent',
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute pointer-events-auto cursor-pointer z-10 flex items-center justify-center shadow-md backdrop-blur-xs"
              />
            );
          }

          if (p.shapeType === 'circle') {
            return (
              <div
                key={seq.id}
                onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
                style={{
                  left: `${normX * 100}%`,
                  top: `${normY * 100}%`,
                  width: `${((p.radius ?? 90) * 2) / 19.2}%`,
                  aspectRatio: '1',
                  borderRadius: '50%',
                  border: `${p.strokeWidth || 2}px ${p.isDashed ? 'dashed' : 'solid'} ${p.strokeColor || '#06b6d4'}`,
                  backgroundColor: p.fillColor || 'transparent',
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute pointer-events-auto cursor-pointer z-10 flex items-center justify-center shadow-md"
              />
            );
          }

          if (p.shapeType === 'arrow') {
            return (
              <div
                key={seq.id}
                onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
                style={{
                  left: `${normX * 100}%`,
                  top: `${normY * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute pointer-events-auto cursor-pointer z-10 text-rose-500 drop-shadow-[0_0_8px_#f43f5e]"
              >
                <ArrowUpRight className="w-10 h-10" />
              </div>
            );
          }

          return null;
        })}

        {/* Interactive In-Canvas 2D Transform Bounding Box with 8 Handles & Contextual Action Pill */}
        {selectedSeqId && (
          <DndContext
            sensors={transformSensors}
            onDragStart={handleTransformDragStart}
            onDragMove={handleTransformDragMove}
            onDragEnd={handleTransformDragEnd}
          >
            <TransformBodyDraggable
              isLocked={isLocked}
              onDoubleClick={() => {
                const selectedSeq = activeSequences.find((s) => s.id === selectedSeqId);
                if (selectedSeq?.cues && selectedSeq.cues.length > 0) {
                  setEditingCue({
                    sequenceId: selectedSeq.id,
                    cueIndex: 0,
                    text: selectedSeq.cues[0].text,
                  });
                }
              }}
              style={(() => {
                const selectedSeq = activeSequences.find((s) => s.id === selectedSeqId);
                const activeInterp =
                  !isDragging && selectedSeq && previewEngineRef.current
                    ? previewEngineRef.current.getActiveInterpolatedTransform(selectedSeq, currentFrame)
                    : null;
                const curX = activeInterp ? activeInterp.x : transform.x;
                const curY = activeInterp ? activeInterp.y : transform.y;
                const curScale = activeInterp ? activeInterp.scale : transform.scale;
                const curRot = activeInterp ? activeInterp.rotation : transform.rotation;
                const curOpacity = activeInterp ? activeInterp.opacity : 1.0;

                return {
                  transform: `translate(${curX}px, ${curY}px) scale(${curScale}) rotate(${curRot}deg)`,
                  opacity: curOpacity,
                  width: '50%',
                  height: '50%',
                };
              })()}
              className={`absolute border-2 ${
                isLocked
                  ? 'border-amber-400/80 bg-amber-500/5 cursor-not-allowed shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'border-[var(--accent-primary)] bg-[var(--accent-glow)]/10 cursor-move shadow-[0_0_20px_var(--accent-glow)]'
              } rounded-md flex items-center justify-center group pointer-events-auto z-10 backdrop-blur-[2px]`}
            >
              {/* Floating Contextual Action Pill HUD */}
              <ContextualActionPill
                selectedSeqId={selectedSeqId}
                isLocked={isLocked}
                onDuplicate={(id) => IRStateManager.getInstance().duplicateSequence(id)}
                onCenter={() => {
                  const newT = { ...transform, x: 0, y: 0 };
                  setTransform(newT);
                  IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', newT as any);
                }}
                onToggleLock={() => setIsLocked(!isLocked)}
                onResetTransform={() => {
                  const newT = { x: 0, y: 0, scale: 1.0, rotation: 0 };
                  setTransform(newT);
                  IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', newT as any);
                }}
                onDelete={(id) => IRStateManager.getInstance().deleteSequence(id)}
              />

              {/* 4 Corner Scale Handles */}
              <TransformHandle
                handleType="tl"
                isLocked={isLocked}
                className={`absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white dark:bg-slate-100 border-2 ${
                  isLocked
                    ? 'border-amber-400 cursor-not-allowed opacity-40'
                    : 'border-[var(--accent-primary)] cursor-nwse-resize hover:scale-130 active:scale-110'
                } rounded-xs shadow-md transition-transform`}
                title={isLocked ? 'Locked' : 'Scale Top-Left'}
              />
              <TransformHandle
                handleType="tr"
                isLocked={isLocked}
                className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white dark:bg-slate-100 border-2 ${
                  isLocked
                    ? 'border-amber-400 cursor-not-allowed opacity-40'
                    : 'border-[var(--accent-primary)] cursor-nesw-resize hover:scale-130 active:scale-110'
                } rounded-xs shadow-md transition-transform`}
                title={isLocked ? 'Locked' : 'Scale Top-Right'}
              />
              <TransformHandle
                handleType="bl"
                isLocked={isLocked}
                className={`absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white dark:bg-slate-100 border-2 ${
                  isLocked
                    ? 'border-amber-400 cursor-not-allowed opacity-40'
                    : 'border-[var(--accent-primary)] cursor-nesw-resize hover:scale-130 active:scale-110'
                } rounded-xs shadow-md transition-transform`}
                title={isLocked ? 'Locked' : 'Scale Bottom-Left'}
              />
              <TransformHandle
                handleType="br"
                isLocked={isLocked}
                className={`absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white dark:bg-slate-100 border-2 ${
                  isLocked
                    ? 'border-amber-400 cursor-not-allowed opacity-40'
                    : 'border-[var(--accent-primary)] cursor-nwse-resize hover:scale-130 active:scale-110'
                } rounded-xs shadow-md transition-transform`}
                title={isLocked ? 'Locked' : 'Scale Bottom-Right'}
              />

              {/* 4 Edge Stretch Handles */}
              <TransformHandle
                handleType="tc"
                isLocked={isLocked}
                className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-white dark:bg-slate-100 border-2 ${
                  isLocked
                    ? 'border-amber-400 cursor-not-allowed opacity-40'
                    : 'border-[var(--accent-primary)] cursor-ns-resize hover:scale-130 active:scale-110'
                } rounded-xs shadow-md transition-transform`}
                title={isLocked ? 'Locked' : 'Stretch Top'}
              />
              <TransformHandle
                handleType="bc"
                isLocked={isLocked}
                className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-white dark:bg-slate-100 border-2 ${
                  isLocked
                    ? 'border-amber-400 cursor-not-allowed opacity-40'
                    : 'border-[var(--accent-primary)] cursor-ns-resize hover:scale-130 active:scale-110'
                } rounded-xs shadow-md transition-transform`}
                title={isLocked ? 'Locked' : 'Stretch Bottom'}
              />
              <TransformHandle
                handleType="ml"
                isLocked={isLocked}
                className={`absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-4 bg-white dark:bg-slate-100 border-2 ${
                  isLocked
                    ? 'border-amber-400 cursor-not-allowed opacity-40'
                    : 'border-[var(--accent-primary)] cursor-ew-resize hover:scale-130 active:scale-110'
                } rounded-xs shadow-md transition-transform`}
                title={isLocked ? 'Locked' : 'Stretch Left'}
              />
              <TransformHandle
                handleType="mr"
                isLocked={isLocked}
                className={`absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-4 bg-white dark:bg-slate-100 border-2 ${
                  isLocked
                    ? 'border-amber-400 cursor-not-allowed opacity-40'
                    : 'border-[var(--accent-primary)] cursor-ew-resize hover:scale-130 active:scale-110'
                } rounded-xs shadow-md transition-transform`}
                title={isLocked ? 'Locked' : 'Stretch Right'}
              />

              {/* Rotation Stem & Knob Handle */}
              <div className="absolute -top-8 flex flex-col items-center">
                <TransformHandle
                  handleType="rotate"
                  isLocked={isLocked}
                  className={`w-5 h-5 ${
                    isLocked
                      ? 'bg-amber-500 text-slate-950 cursor-not-allowed opacity-50'
                      : 'bg-[var(--accent-primary)] text-slate-950 cursor-grab active:cursor-grabbing hover:brightness-110 shadow-[0_0_12px_var(--accent-glow)] hover:scale-115'
                  } rounded-full flex items-center justify-center transition-transform`}
                  title={isLocked ? 'Locked' : 'Drag to Rotate'}
                >
                  <RotateCw className="w-2.5 h-2.5 stroke-[2.5]" />
                </TransformHandle>
                <div
                  className={`w-0.5 h-3 ${
                    isLocked ? 'bg-amber-400/50' : 'bg-[var(--accent-primary)] shadow-[0_0_6px_var(--accent-glow)]'
                  }`}
                />
              </div>

              {/* Sequence identifier pill with lock indicator */}
              <span
                className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full shadow-md select-none border flex items-center gap-1 ${
                  isLocked
                    ? 'bg-amber-950/80 text-amber-200 border-amber-500/40'
                    : 'bg-black/80 text-white/90 border-white/20'
                }`}
              >
                {isLocked && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                {selectedSeqId}
              </span>
            </TransformBodyDraggable>
          </DndContext>
        )}

        {/* Dynamic Subtitles & Captions Overlay (In-Canvas, Strictly Isolated from Studio Theme) */}
        <SubtitlesOverlay
          activeCues={activeCues}
          activeSequences={activeSequences}
          editingCue={editingCue}
          onStartEditing={setEditingCue}
          onUpdateEditingText={(text) => setEditingCue((prev) => prev ? { ...prev, text } : null)}
          onCommitEditing={(cue) => {
            IRStateManager.getInstance().updateTextCue(cue.sequenceId, cue.cueIndex, cue.text);
            setEditingCue(null);
          }}
          onCancelEditing={() => setEditingCue(null)}
        />
      </div>

      {/* Floating Viewport Quick Transport Bar */}
      <div className="mt-3 flex items-center gap-2 glass-panel px-4 py-2 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.5)] pointer-events-auto border border-[var(--glass-border-highlight)] transition-all duration-200 hover:scale-[1.02] z-30">
        <Tooltip content="Rewind to Start (Home)">
          <button
            type="button"
            onClick={() => onScrub?.(0)}
            className="p-1.5 text-foreground/70 hover:text-foreground rounded-full hover:bg-white/10 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip content={isPlaying ? 'Pause Viewport (Space)' : 'Play Viewport (Space)'}>
          <button
            type="button"
            onClick={onTogglePlay}
            className={`relative p-2.5 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer ${isPlaying
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
              : 'bg-[var(--accent-primary)] text-slate-950 shadow-[0_0_20px_var(--accent-glow)]'
              }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
        </Tooltip>

        <Tooltip content="Step Forward 1 Frame">
          <button
            type="button"
            onClick={() => onScrub?.(Math.min(totalFrames, currentFrame + 1))}
            className="p-1.5 text-foreground/70 hover:text-foreground rounded-full hover:bg-white/10 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <div className="h-4 w-px bg-[var(--glass-border-highlight)] mx-1" />

        {/* Timecode Readout Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full glass-card border border-[var(--glass-border)] text-foreground/90 font-mono text-[11px] select-none tracking-tight">
          <span className="font-semibold text-[var(--accent-primary)]">
            {(currentFrame / fps).toFixed(2)}s
          </span>
          <span className="text-muted-foreground text-[10px]">
            / {(totalFrames / fps).toFixed(2)}s
          </span>
        </div>
      </div>

      {/* Floating Inline Canvas Text Editor Modal */}
      {editingCue && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md pointer-events-auto">
          <div className="glass-panel border-t-[var(--glass-border-highlight)] rounded-2xl p-5 shadow-2xl flex flex-col gap-3.5 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 font-bold text-[var(--accent-primary)]">
                <Type className="w-4 h-4 text-[var(--accent-primary)]" />
                Inline Canvas Text Editor
              </span>
              <span className="text-[10px] text-muted-foreground">[Enter to commit, Esc to cancel]</span>
            </div>
            <input
              type="text"
              autoFocus
              value={editingCue.text}
              onChange={(e) => setEditingCue({ ...editingCue, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  IRStateManager.getInstance().updateTextCue(editingCue.sequenceId, editingCue.cueIndex, editingCue.text);
                  setEditingCue(null);
                } else if (e.key === 'Escape') {
                  setEditingCue(null);
                }
              }}
              onBlur={() => {
                IRStateManager.getInstance().updateTextCue(editingCue.sequenceId, editingCue.cueIndex, editingCue.text);
                setEditingCue(null);
              }}
              className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl px-3.5 py-2.5 text-foreground font-mono text-sm focus:outline-hidden focus:border-[var(--accent-primary)] focus:shadow-[0_0_15px_var(--accent-glow)] transition-all shadow-inner"
            />
          </div>
        </div>
      )}
    </div>
  );
}
