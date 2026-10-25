import React from 'react';
import { useDroppable } from '@dnd-kit/core';

export interface DroppableTrackLaneProps {
  track: any;
  isLocked: boolean;
  children: React.ReactNode;
}

export function DroppableTrackLane({ track, isLocked, children }: DroppableTrackLaneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `track-${track.id}`,
    data: {
      type: 'track',
      trackId: track.id,
    },
    disabled: isLocked,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 h-full rounded-md border relative overflow-hidden transition-colors ${
        isLocked
          ? 'opacity-60 pointer-events-none bg-muted/40 border-[var(--glass-border)]'
          : isOver
            ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40 ring-1 ring-[var(--accent-primary)]/30'
            : 'bg-background/25 border-[var(--glass-border)] hover:border-[var(--glass-border-highlight)]/40'
      }`}
    >
      {children}
    </div>
  );
}
