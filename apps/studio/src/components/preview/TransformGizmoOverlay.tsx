import React from 'react';
import { Lock, RotateCw } from 'lucide-react';
import { ContextualActionPill } from './ContextualActionPill';
import { TransformHandle, TransformBodyDraggable } from './TransformHandles';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioSequence } from '../../lib/ir/studioTypes';
import type { TransformHandleType } from '../../lib/gizmo';
import { CanvasHitTester, type SequenceBounds } from '../../lib/hit-test/CanvasHitTester';
import type { GizmoTelemetry, GizmoHUDControls } from './useGizmoTransform';

export interface TransformGizmoOverlayProps {
  selectedSeqId: string | null;
  activeSequences: StudioSequence[];
  currentFrame: number;
  width?: number;
  height?: number;
  isLocked: boolean;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  isDragging: boolean;
  telemetry?: GizmoTelemetry | null;
  targetBounds?: SequenceBounds;
  hudControls?: GizmoHUDControls;
  previewEngine?: {
    getActiveInterpolatedTransform: (
      seq: StudioSequence,
      frame: number
    ) => { x: number; y: number; scale: number; rotation: number; opacity: number } | null;
  } | null;
  onHandlePointerDown?: (handleType: TransformHandleType, e: React.PointerEvent) => void;
  onHandlePointerMove?: (e: React.PointerEvent) => void;
  onHandlePointerUp?: (e: React.PointerEvent) => void;
  onHandlePointerCancel?: (e: React.PointerEvent) => void;
  onSetTransform: (t: { x: number; y: number; scale: number; rotation: number }) => void;
  onToggleLock: () => void;
  onStartEditingCue?: (cue: { sequenceId: string; cueIndex: number; text: string }) => void;
}

function getRotatedCursor(baseAngle: number, currentRotation: number): string {
  const effective = (((baseAngle + currentRotation) % 360) + 360) % 360;
  if ((effective >= 22.5 && effective < 67.5) || (effective >= 202.5 && effective < 247.5)) {
    return 'cursor-nesw-resize';
  }
  if ((effective >= 67.5 && effective < 112.5) || (effective >= 247.5 && effective < 292.5)) {
    return 'cursor-ns-resize';
  }
  if ((effective >= 112.5 && effective < 157.5) || (effective >= 292.5 && effective < 337.5)) {
    return 'cursor-nwse-resize';
  }
  return 'cursor-ew-resize';
}

export function TransformGizmoOverlay({
  selectedSeqId,
  activeSequences,
  currentFrame,
  width = 1920,
  height = 1080,
  isLocked,
  transform,
  isDragging,
  telemetry,
  targetBounds,
  hudControls,
  previewEngine,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  onHandlePointerCancel,
  onSetTransform,
  onToggleLock,
  onStartEditingCue,
}: TransformGizmoOverlayProps) {
  if (!selectedSeqId) return null;

  // Resolve sequence from active sequences or fallback to timeline lookup
  const timelineSeqs = IRStateManager.getInstance().getState().timeline?.sequences;
  const selectedSeq =
    activeSequences.find((s) => s.id === selectedSeqId) ||
    (timelineSeqs ? timelineSeqs.get(selectedSeqId) : undefined);

  const bounds: SequenceBounds =
    targetBounds ||
    (selectedSeq
      ? CanvasHitTester.resolveSequenceBounds(selectedSeq as any, width, height, 8)
      : {
          normX: 0.5,
          normY: 0.5,
          normWidth: 0.5,
          normHeight: 0.5,
          label: '',
          sequenceType: 'video',
        });

  const activeInterp =
    !isDragging && selectedSeq && previewEngine
      ? previewEngine.getActiveInterpolatedTransform(selectedSeq, currentFrame)
      : null;
  const curX = activeInterp ? activeInterp.x : transform.x;
  const curY = activeInterp ? activeInterp.y : transform.y;
  const curScale = activeInterp
    ? ((activeInterp as any).scale ?? (activeInterp as any).scaleX ?? transform.scale)
    : transform.scale;
  const curRot = activeInterp ? activeInterp.rotation : transform.rotation;
  const curOpacity = activeInterp ? activeInterp.opacity : 1.0;

  const canvasW = width;
  const canvasH = height;

  const percentX = (bounds.normX + curX / canvasW) * 100;
  const percentY = (bounds.normY + curY / canvasH) * 100;
  const widthPercent = bounds.normWidth * 100;
  const heightPercent = bounds.normHeight * 100;

  return (
    <TransformBodyDraggable
      isLocked={isLocked}
      onPointerDown={(e) => onHandlePointerDown?.('body', e)}
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
      onPointerCancel={onHandlePointerCancel}
      onDoubleClick={() => {
        const textMod = selectedSeq?.modifiers?.find(
          (m) => m.type === 'text/draw' || m.type === 'text/overlay'
        );
        if (textMod && onStartEditingCue) {
          onStartEditingCue({
            sequenceId: selectedSeq.id,
            cueIndex: 0,
            text: (textMod.params as any)?.text ?? selectedSeq.name ?? '',
          });
        } else if (selectedSeq?.cues && selectedSeq.cues.length > 0 && onStartEditingCue) {
          onStartEditingCue({
            sequenceId: selectedSeq.id,
            cueIndex: 0,
            text: selectedSeq.cues[0].text,
          });
        }
      }}
      style={{
        left: `${percentX}%`,
        top: `${percentY}%`,
        width: `${widthPercent}%`,
        height: `${heightPercent}%`,
        transform: `translate(-50%, -50%) scale(${curScale}) rotate(${curRot}deg)`,
        opacity: curOpacity,
      }}
      className={`absolute border-2 ${
        isLocked
          ? 'border-amber-400/80 bg-amber-500/5 cursor-not-allowed shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          : 'border-accent-theme/90 bg-accent-theme/10 cursor-move shadow-[0_0_15px_var(--accent-glow)]'
      } rounded-md flex items-center justify-center group pointer-events-auto z-100 select-none`}
    >
      {/* Studio Interactive Center Pivot Reticle & Tether */}
      {(() => {
        const anchor = hudControls?.anchorPoint || [0.5, 0.5];
        const isCustomAnchor = Math.abs(anchor[0] - 0.5) > 0.005 || Math.abs(anchor[1] - 0.5) > 0.005;
        return (
          <>
            {isCustomAnchor && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
                <line
                  x1="50%"
                  y1="50%"
                  x2={`${anchor[0] * 100}%`}
                  y2={`${anchor[1] * 100}%`}
                  stroke="var(--accent-primary, #00ffff)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
              </svg>
            )}

            {/* Geometric Center Marker */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center opacity-40">
              <div className="w-2 h-2 rounded-full border border-dashed border-white/60" />
            </div>

            {/* Draggable Anchor Point Reticle */}
            <div
              style={{
                left: `${anchor[0] * 100}%`,
                top: `${anchor[1] * 100}%`,
              }}
              onPointerDown={(e) => onHandlePointerDown?.('anchor', e)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center cursor-crosshair transition-transform select-none ${
                hudControls?.tool === 'anchor'
                  ? 'scale-125 ring-2 ring-accent-theme shadow-lg rounded-full p-1 bg-accent-theme/20'
                  : 'opacity-75 hover:opacity-100 hover:scale-120'
              }`}
              title="Anchor Point Pivot (Drag to Reposition Pivot)"
            >
              <div className="w-3.5 h-0.5 bg-accent-theme shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
              <div className="h-3.5 w-0.5 bg-accent-theme shadow-[0_0_4px_rgba(0,0,0,0.8)] absolute" />
              <div className="w-2 h-2 rounded-full border border-accent-theme bg-background shadow-xs absolute" />
            </div>
          </>
        );
      })()}

      {/* Floating Contextual Action Pill HUD */}
      <ContextualActionPill
        selectedSeqId={selectedSeqId}
        isLocked={isLocked}
        onDuplicate={(id) => IRStateManager.getInstance().duplicateSequence(id)}
        onCenter={() => {
          const newT = { ...transform, x: 0, y: 0 };
          onSetTransform(newT);
          IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', { ...newT });
        }}
        onToggleLock={onToggleLock}
        onResetTransform={() => {
          const newT = { x: 0, y: 0, scale: 1.0, rotation: 0 };
          onSetTransform(newT);
          IRStateManager.getInstance().updateModifier(selectedSeqId, 'transform', { ...newT });
        }}
        onDelete={(id) => IRStateManager.getInstance().deleteSequence(id)}
      />

      {/* Studio Pro NLE Floating Status Bar & Telemetry HUD */}
      <div
        className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 pointer-events-auto select-none z-110 flex flex-col items-center gap-1.5"
        style={{
          transform: `translate(-50%, 0) rotate(${-curRot}deg)`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Row 1: Interactive Status Chips & Toggles */}
        {hudControls && (
          <div className="glass-panel px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-2 shadow-2xl border border-white/20 bg-slate-950/95 backdrop-blur-md whitespace-nowrap text-white/90">
            {/* Tool Mode Toggle */}
            <button
              type="button"
              onClick={() => hudControls.setTool(hudControls.tool === 'move' ? 'anchor' : 'move')}
              className={`px-2 py-0.5 rounded-full font-sans text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                hudControls.tool === 'anchor'
                  ? 'bg-accent-theme text-slate-950 shadow-[0_0_10px_var(--accent-glow)]'
                  : 'bg-white/10 hover:bg-white/20 text-white/80'
              }`}
              title="Toggle between Move and Anchor Point repositioning"
            >
              <span>Tool:</span>
              <span className="uppercase">{hudControls.tool}</span>
            </button>

            <span className="text-white/20">|</span>

            {/* Snap Toggle Chip */}
            <button
              type="button"
              onClick={() => hudControls.setSnapEnabled((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-semibold ${
                hudControls.snapEnabled
                  ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                  : 'text-white/40 bg-white/5 line-through'
              }`}
              title="Toggle Magnetic Snapping (Ctrl/Cmd to bypass during drag)"
            >
              Snap: {hudControls.snapEnabled ? 'ON' : 'OFF'}
            </button>

            {/* Axis Lock Chip */}
            <button
              type="button"
              onClick={() => hudControls.setAxisLock((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-semibold ${
                hudControls.axisLock
                  ? 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/30'
                  : 'text-white/40 bg-white/5'
              }`}
              title="Lock movement to single orthogonal axis (Shift while dragging)"
            >
              Axis: {hudControls.axisLock ? 'LOCK' : 'FREE'}
            </button>

            {/* Center Scale Chip */}
            <button
              type="button"
              onClick={() => hudControls.setCenterScale((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-semibold ${
                hudControls.centerScale
                  ? 'text-purple-300 bg-purple-500/15 border border-purple-500/30'
                  : 'text-white/40 bg-white/5'
              }`}
              title="Scale from center/anchor rather than opposite corner (Alt key)"
            >
              Scale: {hudControls.centerScale ? 'CENTER' : 'CORNER'}
            </button>
          </div>
        )}

        {/* Row 2: Live Telemetry Metrics Readout */}
        {telemetry && (
          <div className="glass-pill px-3 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-2 shadow-lg border border-accent-theme/40 text-foreground whitespace-nowrap bg-background/95 backdrop-blur-md animate-in fade-in duration-100">
            {telemetry.mode === 'anchor' ? (
              <>
                <span className="text-muted-foreground font-sans text-[9px] font-semibold uppercase tracking-wider">PIVOT</span>
                <span className="font-semibold text-accent-theme">
                  {Math.round((telemetry.anchorPoint?.[0] ?? 0.5) * 100)}%, {Math.round((telemetry.anchorPoint?.[1] ?? 0.5) * 100)}%
                </span>
              </>
            ) : telemetry.mode === 'move' ? (
              <>
                <span className="text-muted-foreground font-sans text-[9px] font-semibold uppercase tracking-wider">POS</span>
                <span className="font-semibold text-accent-theme">
                  X: {telemetry.deltaX > 0 ? `+${telemetry.deltaX}` : telemetry.deltaX}px
                </span>
                <span className="font-semibold text-accent-theme">
                  Y: {telemetry.deltaY > 0 ? `+${telemetry.deltaY}` : telemetry.deltaY}px
                </span>
              </>
            ) : telemetry.mode === 'scale' ? (
              <>
                <span className="text-muted-foreground font-sans text-[9px] font-semibold uppercase tracking-wider">SIZE</span>
                <span className="font-semibold text-accent-theme">
                  {telemetry.widthPx} × {telemetry.heightPx} px
                </span>
                <span className="text-accent-secondary font-medium">({telemetry.scale.toFixed(2)}×)</span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground font-sans text-[9px] font-semibold uppercase tracking-wider">ANGLE</span>
                <span className="font-semibold text-accent-theme">{telemetry.rotation.toFixed(1)}°</span>
              </>
            )}

            {telemetry.activeGuides && telemetry.activeGuides.length > 0 && (
              <span className="text-emerald-400 font-semibold text-[9px] bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                Snap: {telemetry.activeGuides[0].label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4 Corner Scale Handles */}
      <TransformHandle
        handleType="tl"
        isLocked={isLocked}
        onPointerDown={(e) => onHandlePointerDown?.('tl', e)}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
        className={`absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-background border-2 ${
          isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : `border-accent-theme ${getRotatedCursor(315, curRot)} hover:scale-130 active:scale-110`
        } rounded-[3px] shadow-md transition-transform`}
        title={isLocked ? 'Locked' : 'Scale Top-Left (Shift to free-scale)'}
      />
      <TransformHandle
        handleType="tr"
        isLocked={isLocked}
        onPointerDown={(e) => onHandlePointerDown?.('tr', e)}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
        className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-background border-2 ${
          isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : `border-accent-theme ${getRotatedCursor(45, curRot)} hover:scale-130 active:scale-110`
        } rounded-[3px] shadow-md transition-transform`}
        title={isLocked ? 'Locked' : 'Scale Top-Right (Shift to free-scale)'}
      />
      <TransformHandle
        handleType="bl"
        isLocked={isLocked}
        onPointerDown={(e) => onHandlePointerDown?.('bl', e)}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
        className={`absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-background border-2 ${
          isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : `border-accent-theme ${getRotatedCursor(225, curRot)} hover:scale-130 active:scale-110`
        } rounded-[3px] shadow-md transition-transform`}
        title={isLocked ? 'Locked' : 'Scale Bottom-Left (Shift to free-scale)'}
      />
      <TransformHandle
        handleType="br"
        isLocked={isLocked}
        onPointerDown={(e) => onHandlePointerDown?.('br', e)}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
        className={`absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-background border-2 ${
          isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : `border-accent-theme ${getRotatedCursor(135, curRot)} hover:scale-130 active:scale-110`
        } rounded-[3px] shadow-md transition-transform`}
        title={isLocked ? 'Locked' : 'Scale Bottom-Right (Shift to free-scale)'}
      />

      {/* 4 Directional Edge Stretch Pills */}
      <TransformHandle
        handleType="tc"
        isLocked={isLocked}
        onPointerDown={(e) => onHandlePointerDown?.('tc', e)}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
        className={`absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-background border ${
          isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : `border-accent-theme ${getRotatedCursor(90, curRot)} hover:scale-125 active:scale-110`
        } rounded-full shadow-sm transition-transform`}
        title={isLocked ? 'Locked' : 'Stretch Top'}
      />
      <TransformHandle
        handleType="bc"
        isLocked={isLocked}
        onPointerDown={(e) => onHandlePointerDown?.('bc', e)}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-background border ${
          isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : `border-accent-theme ${getRotatedCursor(90, curRot)} hover:scale-125 active:scale-110`
        } rounded-full shadow-sm transition-transform`}
        title={isLocked ? 'Locked' : 'Stretch Bottom'}
      />
      <TransformHandle
        handleType="ml"
        isLocked={isLocked}
        onPointerDown={(e) => onHandlePointerDown?.('ml', e)}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
        className={`absolute top-1/2 -translate-y-1/2 -left-1 w-1.5 h-4 bg-background border ${
          isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : `border-accent-theme ${getRotatedCursor(0, curRot)} hover:scale-125 active:scale-110`
        } rounded-full shadow-sm transition-transform`}
        title={isLocked ? 'Locked' : 'Stretch Left'}
      />
      <TransformHandle
        handleType="mr"
        isLocked={isLocked}
        onPointerDown={(e) => onHandlePointerDown?.('mr', e)}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
        className={`absolute top-1/2 -translate-y-1/2 -right-1 w-1.5 h-4 bg-background border ${
          isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : `border-accent-theme ${getRotatedCursor(0, curRot)} hover:scale-125 active:scale-110`
        } rounded-full shadow-sm transition-transform`}
        title={isLocked ? 'Locked' : 'Stretch Right'}
      />

      {/* Rotation Stem & Knob Handle */}
      <div className="absolute -top-8 flex flex-col items-center">
        <TransformHandle
          handleType="rotate"
          isLocked={isLocked}
          onPointerDown={(e) => onHandlePointerDown?.('rotate', e)}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerCancel}
          className={`w-5 h-5 ${
            isLocked
              ? 'bg-amber-500 text-slate-950 cursor-not-allowed opacity-50'
              : 'bg-accent-theme text-primary-foreground cursor-grab active:cursor-grabbing hover:brightness-110 shadow-accent-glow hover:scale-115'
          } rounded-full flex items-center justify-center transition-transform`}
          title={isLocked ? 'Locked' : 'Drag to Rotate (15° magnetic snap)'}
        >
          <RotateCw className="w-2.5 h-2.5 stroke-[2.5]" />
        </TransformHandle>
        <div
          className={`w-px h-3.5 ${
            isLocked ? 'bg-amber-400/50' : 'bg-accent-theme shadow-accent-glow'
          }`}
        />
      </div>

      {/* Sequence identifier pill with lock indicator */}
      <span
        className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full shadow-md select-none border flex items-center gap-1 ${
          isLocked
            ? 'bg-amber-950/80 text-amber-200 border-amber-500/40'
            : 'glass-pill text-foreground border-glass-border'
        }`}
      >
        {isLocked && <Lock className="w-2.5 h-2.5 text-amber-400" />}
        {selectedSeqId}
      </span>
    </TransformBodyDraggable>
  );
}
