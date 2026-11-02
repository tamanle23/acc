import React from 'react';
import { Lock, RotateCw } from 'lucide-react';
import { ContextualActionPill } from './ContextualActionPill';
import { TransformHandle, TransformBodyDraggable } from './TransformHandles';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioSequence } from '../../lib/ir/studioTypes';
import type { TransformHandleType } from '../../lib/gizmo';
import { CanvasHitTester, type SequenceBounds } from '../../lib/hit-test/CanvasHitTester';
import type { GizmoTelemetry } from './useGizmoTransform';

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
      style={(() => {
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

        return {
          left: `${percentX}%`,
          top: `${percentY}%`,
          width: `${widthPercent}%`,
          height: `${heightPercent}%`,
          transform: `translate(-50%, -50%) scale(${curScale}) rotate(${curRot}deg)`,
          opacity: curOpacity,
        };
      })()}
      className={`absolute border-2 ${
        isLocked
          ? 'border-amber-400/80 bg-amber-500/5 cursor-not-allowed shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          : 'border-accent-theme/90 bg-accent-theme/10 cursor-move shadow-[0_0_15px_var(--accent-glow)]'
      } rounded-md flex items-center justify-center group pointer-events-auto z-100 select-none`}
    >
      {/* Studio Center Pivot Reticle Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center opacity-65 group-hover:opacity-90 transition-opacity">
        <div className="w-3 h-px bg-accent-theme" />
        <div className="h-3 w-px bg-accent-theme -ml-1.5" />
        <div className="w-1.5 h-1.5 rounded-full border border-accent-theme bg-background/90 absolute shadow-sm" />
      </div>

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

      {/* Studio Floating Live Telemetry HUD Badge */}
      {telemetry && (
        <div className="absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 pointer-events-none z-110 animate-in fade-in duration-100">
          <div className="glass-pill px-3 py-1 rounded-full text-[11px] font-mono flex items-center gap-2.5 shadow-xl border border-accent-theme/40 text-foreground whitespace-nowrap bg-background/90 backdrop-blur-md">
            {telemetry.mode === 'move' && (
              <>
                <span className="text-muted-foreground font-sans text-[10px] font-semibold uppercase tracking-wider">POS</span>
                <span className="font-semibold text-accent-theme">
                  X: {telemetry.deltaX > 0 ? `+${telemetry.deltaX}` : telemetry.deltaX}px
                </span>
                <span className="font-semibold text-accent-theme">
                  Y: {telemetry.deltaY > 0 ? `+${telemetry.deltaY}` : telemetry.deltaY}px
                </span>
              </>
            )}
            {telemetry.mode === 'scale' && (
              <>
                <span className="text-muted-foreground font-sans text-[10px] font-semibold uppercase tracking-wider">SIZE</span>
                <span className="font-semibold text-accent-theme">
                  {telemetry.widthPx} × {telemetry.heightPx} px
                </span>
                <span className="text-accent-secondary font-medium">({telemetry.scale.toFixed(2)}×)</span>
              </>
            )}
            {telemetry.mode === 'rotate' && (
              <>
                <span className="text-muted-foreground font-sans text-[10px] font-semibold uppercase tracking-wider">ANGLE</span>
                <span className="font-semibold text-accent-theme">{telemetry.rotation.toFixed(1)}°</span>
              </>
            )}
            {telemetry.activeGuides && telemetry.activeGuides.length > 0 && (
              <span className="text-emerald-400 font-semibold text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                Snap: {telemetry.activeGuides[0].label}
              </span>
            )}
          </div>
        </div>
      )}

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
            : 'border-accent-theme cursor-nwse-resize hover:scale-130 active:scale-110'
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
            : 'border-accent-theme cursor-nesw-resize hover:scale-130 active:scale-110'
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
            : 'border-accent-theme cursor-nesw-resize hover:scale-130 active:scale-110'
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
            : 'border-accent-theme cursor-nwse-resize hover:scale-130 active:scale-110'
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
            : 'border-accent-theme cursor-ns-resize hover:scale-125 active:scale-110'
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
            : 'border-accent-theme cursor-ns-resize hover:scale-125 active:scale-110'
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
            : 'border-accent-theme cursor-ew-resize hover:scale-125 active:scale-110'
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
            : 'border-accent-theme cursor-ew-resize hover:scale-125 active:scale-110'
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
