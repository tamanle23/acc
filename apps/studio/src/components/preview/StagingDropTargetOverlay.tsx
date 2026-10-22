import React from 'react';
import { Sparkles } from 'lucide-react';

export interface StagingDropTargetOverlayProps {
  isOver: boolean;
  isDragOver: boolean;
  dragCoords: { normX: number; normY: number } | null;
}

export function StagingDropTargetOverlay({
  isOver,
  isDragOver,
  dragCoords,
}: StagingDropTargetOverlayProps) {
  if (!isOver && !(isDragOver && dragCoords)) return null;

  return (
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
  );
}
