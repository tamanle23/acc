import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
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
} from 'lucide-react';
import { IRStateManager } from '../lib/ir/irState';
import { DepthMathEngine } from '../lib/math/DepthMathEngine';
import { AssetTextureCache } from '../lib/textures/AssetTextureCache';
import { useTheme } from '../lib/theme/ThemeProvider';
import {
  UniversalCanvasEngine,
  CanvasTransformOverlay,
  MagneticSnapEngine,
  type BoundingBox2D,
  type SnappingGuide,
  type TransformHandleType,
  type PartialVFXRegion,
} from '@acc/effect-engines/client';
import { STAGING_PRESETS } from '../lib/library/stagingPresets';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<UniversalCanvasEngine | null>(null);
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

  // Drag-and-Drop Staging & Inline Text Editing State
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCoords, setDragCoords] = useState<{ normX: number; normY: number } | null>(null);
  const [editingCue, setEditingCue] = useState<{ sequenceId: string; cueIndex: number; text: string } | null>(null);

  const [irState, setIrState] = useState(IRStateManager.getInstance().getState());

  useEffect(() => {
    return IRStateManager.getInstance().subscribe(setIrState);
  }, []);

  const width = irState.doc?.meta?.canvasSize?.w || 1920;
  const height = irState.doc?.meta?.canvasSize?.h || 1080;
  const currentFrame = playhead?.currentFrame || 0;
  const fps = playhead?.fps || 30;
  const totalFrames = playhead?.totalFrames || irState.timeline?.totalDurationFrames || 300;
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

  // Initialize UniversalCanvasEngine on HTML5 2D Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const engine = new UniversalCanvasEngine({
      width,
      height,
    });
    engine.initHologramHUD(0.35, 40);
    engine.initParticleSystem(250);
    engineRef.current = engine;

    setGlReady(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [width, height]);

  // Event-Driven Render Execution on 2D Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear & Background pass
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // 2. Query active sequences
    const activeSeqs = irState.intervalTree?.queryActive(currentFrame) || [];
    let popOutIntensity = 1.0;
    const vfxRegions: PartialVFXRegion[] = [];

    for (const seq of activeSeqs) {
      if (seq.modifiers) {
        for (const mod of seq.modifiers) {
          if (mod.type === 'vfx/depth3d') {
            const p = mod.params as any;
            if (typeof p.popOutIntensity === 'number') popOutIntensity = p.popOutIntensity;
          }
          if (mod.type === 'vfx/partial') {
            const p = (mod.params || {}) as any;
            const trans = seq.modifiers?.find((m) => m.type === 'transform');
            const tp = (trans?.params || {}) as any;
            vfxRegions.push({
              id: seq.id,
              type: p.vfxType || 'spotlight',
              x: tp.normX ?? 0.5,
              y: tp.normY ?? 0.5,
              width: p.widthNorm ?? 0.35,
              height: p.heightNorm ?? 0.25,
              radius: p.radius ?? 160,
              color: p.color ?? '#00d4ff',
              intensity: p.intensity ?? 1.5,
            });
          }
        }
      }
    }

    engine.setPartialVFXRegions(vfxRegions);
    engine.syncTimeline(activeSeqs as any, fps);

    // 3. Synchronize in-canvas transform overlay
    if (selectedSeqId) {
      const baseW = 0.5;
      const baseH = 0.5;
      const normBox: BoundingBox2D = {
        x: 0.5 + transform.x / width,
        y: 0.5 + transform.y / height,
        width: baseW * transform.scale,
        height: baseH * transform.scale,
        rotation: transform.rotation,
      };
      engine.setOverlayVisible(true);
      engine.updateOverlay(normBox, activeGuides);
    } else {
      engine.setOverlayVisible(false);
      engine.updateOverlay(null, []);
    }

    // 4. Render 2D Scenegraph, Particles, HUD & Vector Overlay
    const timeSec = currentFrame / fps;
    engine.render(ctx, timeSec, popOutIntensity);
  }, [currentFrame, fps, irState, glReady, selectedSeqId, transform, activeGuides, width, height]);

  // Direct in-canvas handle interaction handlers
  const handleHandleMouseDown = (handleType: TransformHandleType, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setActiveHandle(handleType);
    setStartPointer({ x: e.clientX, y: e.clientY });
    setStartTransform({ ...transform });

    const mode = handleType === 'body' ? 'move' : handleType === 'rotate' ? 'rotate' : 'resize';
    engineRef.current?.setActiveInteraction(handleType, mode);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setMousePos({ x: normX, y: normY });

      if (isDragging && activeHandle && selectedSeqId) {
        const dx = e.clientX - startPointer.x;
        const dy = e.clientY - startPointer.y;

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
          x: (startPointer.x - rect.left + dx) / rect.width,
          y: (startPointer.y - rect.top + dy) / rect.height,
        };
        const startPointerNorm = {
          x: (startPointer.x - rect.left) / rect.width,
          y: (startPointer.y - rect.top) / rect.height,
        };

        const dragRes = CanvasTransformOverlay.computeDragTransform(
          startNormBox,
          activeHandle,
          currentPointerNorm,
          startPointerNorm,
          e.shiftKey,
          e.shiftKey
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
        IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', newTransform as any);
      }
    },
    [isDragging, activeHandle, startPointer, startTransform, selectedSeqId, width, height]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
    setActiveHandle(null);
    setActiveGuides([]);
    engineRef.current?.setActiveInteraction(null, null);
  };

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

  const activePartialVFX = activeSequences.filter((s) =>
    s.modifiers?.some((m) => m.type === 'vfx/partial')
  );
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
      className={`relative max-h-full max-w-full flex flex-col items-center justify-center p-0 overflow-hidden rounded-2xl glass-panel shadow-2xl select-none transition-all duration-300 ${isOver
        ? 'ring-2 ring-[var(--accent-primary)] shadow-[0_0_35px_var(--accent-glow)] scale-[1.005]'
        : 'hover:border-[var(--glass-border-highlight)]'
        }`}
    >
      {/* Ambient Fluid Background Refraction Mesh */}
      <div className="absolute inset-0 pointer-events-none opacity-40 liquid-ambient-mesh" />

      {/* Top Monitor Status Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="glass-card px-2.5 py-1 rounded-full text-foreground/80 font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-[var(--glass-border)]">
            <Monitor className="w-3 h-3 text-[var(--accent-primary)]" />
            {width}×{height}
          </div>

          <div className="glass-card px-2.5 py-1 rounded-full text-foreground/80 font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-[var(--glass-border)]">
            <Sparkles className="w-2.5 h-2.5 text-[var(--accent-primary)] animate-pulse" />
            GSAP Timeline Engine
          </div>

          <div
            className={`glass-card px-2.5 py-1 rounded-full font-mono text-[10px] flex items-center gap-1.5 border shadow-xs transition-colors ${isPlaying
              ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'border-[var(--glass-border)] text-muted-foreground'
              }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-muted-foreground/60'
                }`}
            />
            {isPlaying ? 'PLAYING' : 'IDLE'} [{currentFrame}/{totalFrames}]
          </div>

          {onTogglePlay && (
            <Tooltip content={isPlaying ? 'Pause Viewport (Space)' : 'Play Viewport (Space)'}>
              <button
                type="button"
                onClick={onTogglePlay}
                className={`glass-button px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5 cursor-pointer pointer-events-auto transition-all active:scale-95 border ${isPlaying
                  ? 'border-emerald-500/50 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'border-[var(--glass-border)] text-foreground/80 hover:text-foreground'
                  }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-2.5 h-2.5 fill-current" />
                    <span className="font-bold tracking-wider">PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span className="font-bold tracking-wider">PLAY</span>
                  </>
                )}
              </button>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedSeqId && (
            <div className="glass-card px-3 py-1 rounded-full text-foreground/90 border border-[var(--accent-primary)]/40 font-mono text-[10px] flex items-center gap-1.5 shadow-xs backdrop-blur-md">
              <Move className="w-3 h-3 text-[var(--accent-primary)]" />
              X: {transform.x}px | Y: {transform.y}px | S: {transform.scale.toFixed(2)}x | R: {transform.rotation}°
              {activeGuides.length > 0 && (
                <span className="text-[var(--accent-primary)] font-semibold ml-1">
                  [Snap: {activeGuides.map((g) => g.label).join(', ')}]
                </span>
              )}
            </div>
          )}

          <div className="glass-card px-2.5 py-1 rounded-full text-muted-foreground font-mono text-[10px] flex items-center gap-1 border border-[var(--glass-border)]">
            <Layers className="w-3 h-3 text-[var(--accent-primary)]" />
            16:9 Canvas
          </div>
        </div>
      </div>

      {/* Main Video Viewport Canvas with Mouse Interactive Parallax & Staging Drop Target */}
      <div
        className="relative flex items-center justify-center isolate rounded-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.7)] border border-[var(--glass-border)] bg-black select-none"
        style={{
          aspectRatio: '16/9',
          maxHeight: '70vh',
          maxWidth: '80vw',
        }}
      >
        <canvas
          id="studio-canvas"
          ref={canvasRef}
          className="w-full h-full object-contain cursor-crosshair block bg-black"
          style={{
            aspectRatio: '16/9',
            backgroundColor: '#000000',
          }}
        />

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

        {/* Active Partial VFX Overlays */}
        {activePartialVFX.map((seq) => {
          const mod = seq.modifiers?.find((m) => m.type === 'vfx/partial');
          const trans = seq.modifiers?.find((m) => m.type === 'transform');
          const p = (mod?.params || {}) as any;
          const tp = (trans?.params || {}) as any;
          const normX = tp.normX ?? 0.5;
          const normY = tp.normY ?? 0.5;

          if (p.vfxType === 'blur') {
            return (
              <div
                key={seq.id}
                onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
                style={{
                  left: `${normX * 100}%`,
                  top: `${normY * 100}%`,
                  width: `${(p.widthNorm ?? 0.35) * 100}%`,
                  height: `${(p.heightNorm ?? 0.25) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute border border-dashed border-cyan-400/80 bg-slate-900/60 backdrop-blur-md rounded-xs flex items-center justify-center pointer-events-auto cursor-pointer z-10 shadow-lg"
              >
                <span className="text-[9px] font-mono font-bold text-cyan-300 tracking-wider uppercase px-1.5 py-0.5 bg-black/60 rounded">
                  {p.label || 'REGIONAL BLUR'}
                </span>
              </div>
            );
          }

          if (p.vfxType === 'spotlight') {
            return (
              <div
                key={seq.id}
                onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
                style={{
                  left: `${normX * 100}%`,
                  top: `${normY * 100}%`,
                  width: `${((p.radius ?? 160) * 2 / 1080) * 100}%`,
                  aspectRatio: '1',
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute rounded-full pointer-events-auto cursor-pointer z-10 flex items-center justify-center"
              >
                <div
                  className="w-full h-full rounded-full animate-pulse border border-cyan-400/40"
                  style={{
                    background: `radial-gradient(circle, ${p.color || '#00d4ff'}55 0%, transparent 70%)`,
                  }}
                />
              </div>
            );
          }

          if (p.vfxType === 'glitch') {
            return (
              <div
                key={seq.id}
                onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
                style={{
                  left: `${normX * 100}%`,
                  top: `${normY * 100}%`,
                  width: '30%',
                  height: '20%',
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute border border-rose-500/80 bg-rose-950/30 flex items-center justify-center pointer-events-auto cursor-pointer z-10 overflow-hidden shadow-lg"
              >
                <span className="text-[9px] font-mono font-bold text-rose-300 tracking-wider uppercase px-1.5 py-0.5 bg-black/60 rounded">
                  {p.label || 'REGIONAL GLITCH'}
                </span>
              </div>
            );
          }

          if (p.vfxType === 'point_emitter') {
            return (
              <div
                key={seq.id}
                onClick={() => IRStateManager.getInstance().setSelectedSequenceId(seq.id)}
                style={{
                  left: `${normX * 100}%`,
                  top: `${normY * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute w-8 h-8 rounded-full border-2 border-pink-500 bg-pink-500/20 flex items-center justify-center pointer-events-auto cursor-pointer z-10 animate-ping"
              >
                <div className="w-2 h-2 rounded-full bg-pink-400" />
              </div>
            );
          }

          return null;
        })}

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

        {/* Magnetic Snapping Guidelines Overlay */}
        {activeGuides.map((guide) => (
          <div
            key={guide.id}
            style={
              guide.orientation === 'vertical'
                ? { left: `${guide.position * 100}%`, top: 0, bottom: 0 }
                : { top: `${guide.position * 100}%`, left: 0, right: 0 }
            }
            className={`absolute z-20 pointer-events-none ${guide.orientation === 'vertical'
              ? 'w-px border-l border-dashed border-cyan-400 shadow-[0_0_8px_#06b6d4]'
              : 'h-px border-t border-dashed border-cyan-400 shadow-[0_0_8px_#06b6d4]'
              }`}
          >
            <span
              className={`absolute text-[9px] font-mono bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 px-1.5 py-0.2 rounded shadow-xs ${guide.orientation === 'vertical' ? 'top-2 -translate-x-1/2' : 'left-2 -translate-y-1/2'
                }`}
            >
              {guide.label}
            </span>
          </div>
        ))}

        {/* Interactive In-Canvas 2D Transform Bounding Box with 8 Handles */}
        {selectedSeqId && (
          <div
            onMouseDown={(e) => handleHandleMouseDown('body', e)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              const selectedSeq = activeSequences.find((s) => s.id === selectedSeqId);
              if (selectedSeq?.cues && selectedSeq.cues.length > 0) {
                setEditingCue({
                  sequenceId: selectedSeq.id,
                  cueIndex: 0,
                  text: selectedSeq.cues[0].text,
                });
              }
            }}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
              width: '50%',
              height: '50%',
            }}
            className="absolute border-2 border-[var(--accent-primary)] bg-[var(--accent-glow)]/10 cursor-move rounded-md flex items-center justify-center group shadow-[0_0_20px_var(--accent-glow)] pointer-events-auto z-10 backdrop-blur-[2px]"
          >
            {/* 4 Corner Scale Handles */}
            <div
              onMouseDown={(e) => handleHandleMouseDown('tl', e)}
              className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white dark:bg-slate-100 border-2 border-[var(--accent-primary)] rounded-xs shadow-md cursor-nwse-resize hover:scale-130 active:scale-110 transition-transform"
              title="Scale Top-Left"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('tr', e)}
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white dark:bg-slate-100 border-2 border-[var(--accent-primary)] rounded-xs shadow-md cursor-nesw-resize hover:scale-130 active:scale-110 transition-transform"
              title="Scale Top-Right"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('bl', e)}
              className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white dark:bg-slate-100 border-2 border-[var(--accent-primary)] rounded-xs shadow-md cursor-nesw-resize hover:scale-130 active:scale-110 transition-transform"
              title="Scale Bottom-Left"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('br', e)}
              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white dark:bg-slate-100 border-2 border-[var(--accent-primary)] rounded-xs shadow-md cursor-nwse-resize hover:scale-130 active:scale-110 transition-transform"
              title="Scale Bottom-Right"
            />

            {/* 4 Edge Stretch Handles */}
            <div
              onMouseDown={(e) => handleHandleMouseDown('tc', e)}
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-white dark:bg-slate-100 border-2 border-[var(--accent-primary)] rounded-xs shadow-md cursor-ns-resize hover:scale-130 active:scale-110 transition-transform"
              title="Stretch Top"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('bc', e)}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-white dark:bg-slate-100 border-2 border-[var(--accent-primary)] rounded-xs shadow-md cursor-ns-resize hover:scale-130 active:scale-110 transition-transform"
              title="Stretch Bottom"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('ml', e)}
              className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-4 bg-white dark:bg-slate-100 border-2 border-[var(--accent-primary)] rounded-xs shadow-md cursor-ew-resize hover:scale-130 active:scale-110 transition-transform"
              title="Stretch Left"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('mr', e)}
              className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-4 bg-white dark:bg-slate-100 border-2 border-[var(--accent-primary)] rounded-xs shadow-md cursor-ew-resize hover:scale-130 active:scale-110 transition-transform"
              title="Stretch Right"
            />

            {/* Rotation Stem & Knob Handle */}
            <div className="absolute -top-8 flex flex-col items-center">
              <div
                onMouseDown={(e) => handleHandleMouseDown('rotate', e)}
                className="w-5 h-5 bg-[var(--accent-primary)] text-slate-950 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing hover:brightness-110 shadow-[0_0_12px_var(--accent-glow)] transition-transform hover:scale-115"
                title="Drag to Rotate"
              >
                <RotateCw className="w-2.5 h-2.5 stroke-[2.5]" />
              </div>
              <div className="w-0.5 h-3 bg-[var(--accent-primary)] shadow-[0_0_6px_var(--accent-glow)]" />
            </div>

            {/* Sequence identifier pill */}
            <span className="bg-black/80 text-[10px] font-mono text-white/90 px-2.5 py-0.5 rounded-full shadow-md select-none border border-white/20">
              {selectedSeqId}
            </span>
          </div>
        )}

        {/* Dynamic Subtitles & Captions Overlay (In-Canvas, Strictly Isolated from Studio Theme) */}
        {activeCues.length > 0 && (
          <div className="absolute bottom-6 left-6 right-6 flex flex-col items-center gap-1.5 pointer-events-auto z-20 select-none">
            {activeCues.map((cue, idx) => {
              const isTarget = cue.text.startsWith('TARGET') || cue.text.includes('[');
              return (
                <span
                  key={idx}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const parentSeq = activeSequences.find((s) => s.cues && s.cues.some((c) => c.text === cue.text));
                    if (parentSeq) {
                      const cueIdx = parentSeq.cues?.findIndex((c) => c.text === cue.text) ?? 0;
                      setEditingCue({ sequenceId: parentSeq.id, cueIndex: cueIdx, text: cue.text });
                    }
                  }}
                  className={`px-4 py-1.5 rounded-lg text-center cursor-pointer transition-transform hover:scale-105 select-none font-bold tracking-wide ${isTarget
                    ? 'border border-rose-500/80 bg-rose-950/85 text-rose-200 font-mono text-xs tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                    : 'border border-white/15 bg-black/80 text-white text-base shadow-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]'
                    }`}
                  style={{
                    textShadow: isTarget
                      ? '0 0 8px rgba(244,63,94,0.8)'
                      : '0 2px 4px rgba(0,0,0,0.95), 0 0 2px #000, 0 0 1px #000',
                  }}
                  title="Double click to edit text"
                >
                  {cue.text}
                </span>
              );
            })}
          </div>
        )}
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
