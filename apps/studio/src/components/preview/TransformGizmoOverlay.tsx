import React from 'react';
import {
  DndContext,
  type SensorDescriptor,
  type SensorOptions,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Lock, RotateCw } from 'lucide-react';
import { ContextualActionPill } from './ContextualActionPill';
import { TransformHandle, TransformBodyDraggable } from './TransformHandles';
import { IRStateManager } from '../../lib/ir/irState';
import type { StudioSequence } from '../../lib/ir/studioTypes';

export interface TransformGizmoOverlayProps {
  selectedSeqId: string | null;
  activeSequences: StudioSequence[];
  currentFrame: number;
  isLocked: boolean;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  isDragging: boolean;
  previewEngine?: {
    getActiveInterpolatedTransform: (
      seq: StudioSequence,
      frame: number
    ) => { x: number; y: number; scale: number; rotation: number; opacity: number } | null;
  } | null;
  transformSensors: SensorDescriptor<SensorOptions>[];
  onTransformDragStart: (e: DragStartEvent) => void;
  onTransformDragMove: (e: DragMoveEvent) => void;
  onTransformDragEnd: (e: DragEndEvent) => void;
  onSetTransform: (t: { x: number; y: number; scale: number; rotation: number }) => void;
  onToggleLock: () => void;
  onStartEditingCue?: (cue: { sequenceId: string; cueIndex: number; text: string }) => void;
}

export function TransformGizmoOverlay({
  selectedSeqId,
  activeSequences,
  currentFrame,
  isLocked,
  transform,
  isDragging,
  previewEngine,
  transformSensors,
  onTransformDragStart,
  onTransformDragMove,
  onTransformDragEnd,
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

  return (
    <DndContext
      sensors={transformSensors}
      onDragStart={onTransformDragStart}
      onDragMove={onTransformDragMove}
      onDragEnd={onTransformDragEnd}
    >
      <TransformBodyDraggable
        isLocked={isLocked}
        onDoubleClick={() => {
          if (selectedSeq?.cues && selectedSeq.cues.length > 0 && onStartEditingCue) {
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
        className={`absolute border-2 ${isLocked
          ? 'border-amber-400/80 bg-amber-500/5 cursor-not-allowed shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          : 'border-accent-theme bg-accent-theme/10 cursor-move shadow-accent-glow'
          } rounded-md flex items-center justify-center group pointer-events-auto z-100`}
      >
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

        {/* 4 Corner Scale Handles */}
        <TransformHandle
          handleType="tl"
          isLocked={isLocked}
          className={`absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-background border-2 ${isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : 'border-accent-theme cursor-nwse-resize hover:scale-130 active:scale-110'
            } rounded-xs shadow-md transition-transform`}
          title={isLocked ? 'Locked' : 'Scale Top-Left'}
        />
        <TransformHandle
          handleType="tr"
          isLocked={isLocked}
          className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-background border-2 ${isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : 'border-accent-theme cursor-nesw-resize hover:scale-130 active:scale-110'
            } rounded-xs shadow-md transition-transform`}
          title={isLocked ? 'Locked' : 'Scale Top-Right'}
        />
        <TransformHandle
          handleType="bl"
          isLocked={isLocked}
          className={`absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-background border-2 ${isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : 'border-accent-theme cursor-nesw-resize hover:scale-130 active:scale-110'
            } rounded-xs shadow-md transition-transform`}
          title={isLocked ? 'Locked' : 'Scale Bottom-Left'}
        />
        <TransformHandle
          handleType="br"
          isLocked={isLocked}
          className={`absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-background border-2 ${isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : 'border-accent-theme cursor-nwse-resize hover:scale-130 active:scale-110'
            } rounded-xs shadow-md transition-transform`}
          title={isLocked ? 'Locked' : 'Scale Bottom-Right'}
        />

        {/* 4 Edge Stretch Handles */}
        <TransformHandle
          handleType="tc"
          isLocked={isLocked}
          className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-background border-2 ${isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : 'border-accent-theme cursor-ns-resize hover:scale-130 active:scale-110'
            } rounded-xs shadow-md transition-transform`}
          title={isLocked ? 'Locked' : 'Stretch Top'}
        />
        <TransformHandle
          handleType="bc"
          isLocked={isLocked}
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-background border-2 ${isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : 'border-accent-theme cursor-ns-resize hover:scale-130 active:scale-110'
            } rounded-xs shadow-md transition-transform`}
          title={isLocked ? 'Locked' : 'Stretch Bottom'}
        />
        <TransformHandle
          handleType="ml"
          isLocked={isLocked}
          className={`absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-4 bg-background border-2 ${isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : 'border-accent-theme cursor-ew-resize hover:scale-130 active:scale-110'
            } rounded-xs shadow-md transition-transform`}
          title={isLocked ? 'Locked' : 'Stretch Left'}
        />
        <TransformHandle
          handleType="mr"
          isLocked={isLocked}
          className={`absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-4 bg-background border-2 ${isLocked
            ? 'border-amber-400 cursor-not-allowed opacity-40'
            : 'border-accent-theme cursor-ew-resize hover:scale-130 active:scale-110'
            } rounded-xs shadow-md transition-transform`}
          title={isLocked ? 'Locked' : 'Stretch Right'}
        />

        {/* Rotation Stem & Knob Handle */}
        <div className="absolute -top-8 flex flex-col items-center">
          <TransformHandle
            handleType="rotate"
            isLocked={isLocked}
            className={`w-5 h-5 ${isLocked
              ? 'bg-amber-500 text-slate-950 cursor-not-allowed opacity-50'
              : 'bg-accent-theme text-primary-foreground cursor-grab active:cursor-grabbing hover:brightness-110 shadow-accent-glow hover:scale-115'
              } rounded-full flex items-center justify-center transition-transform`}
            title={isLocked ? 'Locked' : 'Drag to Rotate'}
          >
            <RotateCw className="w-2.5 h-2.5 stroke-[2.5]" />
          </TransformHandle>
          <div
            className={`w-0.5 h-3 ${isLocked ? 'bg-amber-400/50' : 'bg-accent-theme shadow-accent-glow'
              }`}
          />
        </div>

        {/* Sequence identifier pill with lock indicator */}
        <span
          className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full shadow-md select-none border flex items-center gap-1 ${isLocked
            ? 'bg-amber-950/80 text-amber-200 border-amber-500/40'
            : 'glass-pill text-foreground border-glass-border'
            }`}
        >
          {isLocked && <Lock className="w-2.5 h-2.5 text-amber-400" />}
          {selectedSeqId}
        </span>
      </TransformBodyDraggable>
    </DndContext>
  );
}
