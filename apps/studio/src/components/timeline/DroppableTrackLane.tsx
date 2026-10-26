import React from 'react';
import { useDroppable } from '@dnd-kit/core';

export interface DroppableTrackLaneProps {
  track: any;
  isLocked: boolean;
  isInvalidDrop?: boolean;
  children: React.ReactNode;
}

export function DroppableTrackLane({
  track,
  isLocked,
  isInvalidDrop,
  children,
}: DroppableTrackLaneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `track-${track.id}`,
    data: {
      type: 'track',
      trackId: track.id,
      trackType: track.type || 'video',
    },
    disabled: isLocked,
  });

  const isInvalidOver = isOver && isInvalidDrop;
  const isValidOver = isOver && !isInvalidDrop;

  return (
    <div
      ref={setNodeRef}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '1000px 40px',
      }}
      className={`flex-1 h-full rounded-md border relative overflow-hidden transition-colors ${
        isLocked
          ? 'opacity-60 pointer-events-none bg-muted/40 border-[var(--glass-border)]'
          : isInvalidOver
            ? 'bg-destructive/15 border-destructive/60 ring-2 ring-destructive/40 cursor-not-allowed shadow-[0_0_15px_rgba(239,68,68,0.2)]'
            : isValidOver
              ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40 ring-1 ring-[var(--accent-primary)]/30'
              : 'bg-background/25 border-[var(--glass-border)] hover:border-[var(--glass-border-highlight)]/40'
      }`}
    >
      {children}
    </div>
  );
}
