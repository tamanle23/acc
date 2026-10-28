import React from 'react';
import {
  DndContext,
  useDraggable,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SunMedium } from 'lucide-react';
import { IRStateManager } from '../../lib/ir/irState';
import type { ModifierNode } from '@acc/ir';
import type { StudioSequence } from '../../lib/ir/studioTypes';

export interface LightGizmoOverlayProps {
  selectedSeqId: string | null;
  activeSequences: StudioSequence[];
  width: number;
  height: number;
  zoomLevel: number | 'fit';
}

function DraggableLightBulb({
  lightX,
  lightY,
  width,
  height,
}: {
  lightX: number;
  lightY: number;
  width: number;
  height: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'light-source-gizmo',
    data: {
      type: 'light-gizmo',
      lightX,
      lightY,
    },
  });

  // Map normalized light coordinates [-1, 1] to pixel positions inside canvas
  const centerX = width / 2;
  const centerY = height / 2;
  const pixelX = centerX + (lightX * (width / 2)) + (transform ? transform.x : 0);
  const pixelY = centerY + (lightY * (height / 2)) + (transform ? transform.y : 0);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        position: 'absolute',
        left: `${pixelX}px`,
        top: `${pixelY}px`,
        transform: 'translate(-50%, -50%)',
        touchAction: 'none',
      }}
      className={`group cursor-grab active:cursor-grabbing pointer-events-auto z-20 transition-shadow ${
        isDragging ? 'scale-110' : ''
      }`}
      title="3D Point Light Source (Drag to position azimuth / elevation)"
    >
      {/* Light Vector Line to Center */}
      <svg
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${-pixelX}px, ${-pixelY}px)`,
          pointerEvents: 'none',
        }}
      >
        <line
          x1={pixelX}
          y1={pixelY}
          x2={centerX}
          y2={centerY}
          stroke="rgba(6, 182, 212, 0.45)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      </svg>

      {/* Point Light Glowing Sphere */}
      <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.8)] backdrop-blur-xs">
        <SunMedium className="w-4 h-4 text-cyan-300 animate-pulse" />
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-cyan-300 bg-black/60 px-1 py-0.5 rounded border border-cyan-500/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          X: {lightX.toFixed(2)} | Y: {lightY.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function LightGizmoOverlay({
  selectedSeqId,
  activeSequences,
  width,
  height,
}: LightGizmoOverlayProps) {
  if (!selectedSeqId) return null;

  const timelineSeqs = IRStateManager.getInstance().getState().timeline?.sequences;
  const selectedSeq =
    activeSequences.find((s) => s.id === selectedSeqId) ||
    (timelineSeqs ? timelineSeqs.get(selectedSeqId) : undefined);

  if (!selectedSeq) return null;

  // Look for relighting modifier on the active sequence
  const relightMod = selectedSeq.modifiers?.find(
    (m: ModifierNode) => m.type === 'vfx/depth_relighting' || m.type === 'vfx/depth3d_relighting'
  );

  if (!relightMod || relightMod.params?.enabled === false) {
    return null;
  }

  const lightX = typeof relightMod.params?.lightX === 'number' ? relightMod.params.lightX : 0.0;
  const lightY = typeof relightMod.params?.lightY === 'number' ? relightMod.params.lightY : 0.0;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { delta } = event;
    if (!delta.x && !delta.y) return;

    // Convert delta pixels back to [-1, 1] normalized bounds
    const deltaNormX = (delta.x / (width / 2));
    const deltaNormY = (delta.y / (height / 2));

    const nextX = Math.max(-1.5, Math.min(1.5, Number((lightX + deltaNormX).toFixed(2))));
    const nextY = Math.max(-1.5, Math.min(1.5, Number((lightY + deltaNormY).toFixed(2))));

    IRStateManager.getInstance().updateModifier(selectedSeqId, relightMod.type, {
      ...relightMod.params,
      lightX: nextX,
      lightY: nextY,
    });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <DraggableLightBulb lightX={lightX} lightY={lightY} width={width} height={height} />
    </DndContext>
  );
}
