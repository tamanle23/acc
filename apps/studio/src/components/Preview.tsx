import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';
import { Monitor, Sparkles, Box, Move, RotateCw, Type, ArrowUpRight } from 'lucide-react';
import { IRStateManager } from '../lib/ir/irState';
import { DepthMathEngine } from '../lib/math/DepthMathEngine';
import { AssetTextureCache } from '../lib/textures/AssetTextureCache';
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
}

interface TransformState {
  x: number; // offset px
  y: number; // offset px
  scale: number; // 0.2 to 3.0
  rotation: number; // degrees
}

export function Preview({ playhead }: PreviewProps) {
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
    ctx.fillStyle = '#020617';
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
    <Card
      ref={(node) => {
        containerRef.current = node;
        setDroppableRef(node);
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative max-h-full max-w-full flex flex-col items-center justify-center p-0 overflow-hidden bg-slate-950/90 shadow-2xl select-none transition-colors ${
        isOver ? 'border-2 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)]' : 'border-slate-800'
      }`}
    >
      {/* Top Monitor Status Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="bg-slate-900/85 backdrop-blur-xs text-slate-300 border-slate-700/60 font-mono gap-1 text-[10px]"
          >
            <Monitor className="w-3 h-3 text-indigo-400" />
            {width}x{height} (16:9)
          </Badge>
          <Badge
            variant="outline"
            className="bg-slate-900/85 backdrop-blur-xs text-emerald-400 border-slate-700/60 font-mono text-[10px] flex items-center gap-1"
          >
            <Sparkles className="w-2.5 h-2.5" />
            Universal Three.js Scenegraph
          </Badge>
          <Badge
            variant="outline"
            className="bg-slate-900/85 backdrop-blur-xs text-violet-400 border-slate-700/60 font-mono text-[10px] flex items-center gap-1"
          >
            <Box className="w-2.5 h-2.5" />
            pts.js Vector Math
          </Badge>
        </div>

        {selectedSeqId && (
          <Badge
            variant="secondary"
            className="bg-indigo-950/80 text-indigo-300 border-indigo-700/60 font-mono text-[10px] flex items-center gap-1.5"
          >
            <Move className="w-3 h-3 text-indigo-400" />
            X: {transform.x}px | Y: {transform.y}px | S: {transform.scale.toFixed(2)}x | R: {transform.rotation}°
            {activeGuides.length > 0 && (
              <span className="text-cyan-400 font-semibold ml-1">
                [Snap: {activeGuides.map((g) => g.label).join(', ')}]
              </span>
            )}
          </Badge>
        )}
      </div>

      {/* Main Video Viewport Canvas with Mouse Interactive Parallax & Staging Drop Target */}
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="max-h-[70vh] max-w-[80vw] object-contain rounded-lg shadow-inner cursor-crosshair"
          style={{ aspectRatio: '16/9' }}
        />

        {/* Drag-and-Drop Staging Target Indicator */}
        {(isOver || (isDragOver && dragCoords)) && (
          <div
            style={{
              left: dragCoords ? `${dragCoords.normX * 100}%` : '50%',
              top: dragCoords ? `${dragCoords.normY * 100}%` : '50%',
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-cyan-400 bg-cyan-500/20 rounded-md p-4 flex flex-col items-center justify-center pointer-events-none z-30 shadow-[0_0_15px_#06b6d4] backdrop-blur-xs animate-pulse"
          >
            <Sparkles className="w-5 h-5 text-cyan-300 animate-spin" />
            <span className="text-[10px] font-mono font-bold text-cyan-200 mt-1 whitespace-nowrap">
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
            className={`absolute z-20 pointer-events-none ${
              guide.orientation === 'vertical'
                ? 'w-px border-l border-dashed border-cyan-400 shadow-[0_0_8px_#06b6d4]'
                : 'h-px border-t border-dashed border-cyan-400 shadow-[0_0_8px_#06b6d4]'
            }`}
          >
            <span
              className={`absolute text-[9px] font-mono bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 px-1.5 py-0.2 rounded shadow-xs ${
                guide.orientation === 'vertical' ? 'top-2 -translate-x-1/2' : 'left-2 -translate-y-1/2'
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
            className="absolute border-2 border-indigo-400 bg-indigo-500/10 cursor-move rounded-xs flex items-center justify-center group shadow-lg pointer-events-auto z-10"
          >
            {/* 4 Corner Scale Handles */}
            <div
              onMouseDown={(e) => handleHandleMouseDown('tl', e)}
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-600 rounded-xs shadow-xs cursor-nwse-resize hover:scale-125 transition-transform"
              title="Scale Top-Left"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('tr', e)}
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-600 rounded-xs shadow-xs cursor-nesw-resize hover:scale-125 transition-transform"
              title="Scale Top-Right"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('bl', e)}
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-600 rounded-xs shadow-xs cursor-nesw-resize hover:scale-125 transition-transform"
              title="Scale Bottom-Left"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('br', e)}
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-600 rounded-xs shadow-xs cursor-nwse-resize hover:scale-125 transition-transform"
              title="Scale Bottom-Right"
            />

            {/* 4 Edge Stretch Handles */}
            <div
              onMouseDown={(e) => handleHandleMouseDown('tc', e)}
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-2 bg-indigo-200 border border-indigo-600 rounded-xs shadow-xs cursor-ns-resize hover:scale-125 transition-transform"
              title="Stretch Top"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('bc', e)}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-2 bg-indigo-200 border border-indigo-600 rounded-xs shadow-xs cursor-ns-resize hover:scale-125 transition-transform"
              title="Stretch Bottom"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('ml', e)}
              className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-3 bg-indigo-200 border border-indigo-600 rounded-xs shadow-xs cursor-ew-resize hover:scale-125 transition-transform"
              title="Stretch Left"
            />
            <div
              onMouseDown={(e) => handleHandleMouseDown('mr', e)}
              className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-3 bg-indigo-200 border border-indigo-600 rounded-xs shadow-xs cursor-ew-resize hover:scale-125 transition-transform"
              title="Stretch Right"
            />

            {/* Rotation Stem & Knob Handle */}
            <div className="absolute -top-7 flex flex-col items-center">
              <div
                onMouseDown={(e) => handleHandleMouseDown('rotate', e)}
                className="w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-indigo-500 shadow-md transition-transform hover:scale-110"
                title="Drag to Rotate"
              >
                <RotateCw className="w-2.5 h-2.5" />
              </div>
              <div className="w-0.5 h-3 bg-indigo-400" />
            </div>

            {/* Sequence identifier pill */}
            <span className="text-[10px] font-mono bg-indigo-900/90 text-indigo-200 px-2 py-0.5 rounded shadow-xs select-none">
              {selectedSeqId}
            </span>
          </div>
        )}
      </div>

      {/* Dynamic Subtitles & HUD Callout Overlay with Double-Click Inline Editing */}
      {activeCues.length > 0 && (
        <div className="absolute bottom-6 left-8 right-8 flex flex-col items-center gap-2 pointer-events-auto z-20">
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
                className={`backdrop-blur-xs px-4 py-1.5 rounded-md border shadow-lg text-center cursor-pointer hover:border-indigo-400 transition-colors ${
                  isTarget
                    ? 'bg-rose-950/80 border-rose-500/40 text-rose-300 font-mono text-xs tracking-wider'
                    : 'bg-black/80 border-white/10 text-white font-medium text-base'
                }`}
                title="Double click to edit text"
              >
                {cue.text}
              </span>
            );
          })}
        </div>
      )}

      {/* Floating Inline Canvas Text Editor Modal */}
      {editingCue && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-xs pointer-events-auto">
          <div className="bg-slate-900 border border-indigo-500 rounded-lg p-4 shadow-2xl flex flex-col gap-3 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-xs text-indigo-300 font-mono">
              <span className="flex items-center gap-1.5 font-bold">
                <Type className="w-3.5 h-3.5 text-indigo-400" />
                Inline Canvas Text Editor
              </span>
              <span className="text-[10px] text-slate-400">[Enter to commit, Esc to cancel]</span>
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
              className="bg-black/80 border border-indigo-400/80 rounded px-3 py-2 text-white font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-400 shadow-inner"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
