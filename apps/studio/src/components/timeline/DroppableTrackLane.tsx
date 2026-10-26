import React from 'react';
import { useDroppable } from '@dnd-kit/core';

export interface DroppableTrackLaneProps {
  track: any;
  isLocked: boolean;
  isDropTarget?: boolean;
  children: React.ReactNode;
}

export function DroppableTrackLane({
  track,
  isLocked,
  isDropTarget = false,
  children,
}: DroppableTrackLaneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `track-${track.id}`,
    data: {
      type: 'track',
      trackId: track.id,
    },
    disabled: isLocked,
  });

  const activeHighlight = isOver || isDropTarget;

  return (
    <div
      ref={setNodeRef}
      data-track-lane-id={track.id}
      data-track-type={track.type}
      className={`flex-1 h-full rounded-md border relative overflow-hidden transition-colors ${
        isLocked
          ? 'opacity-60 pointer-events-none bg-muted/40 border-[var(--glass-border)]'
          : activeHighlight
            ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/60 ring-1 ring-[var(--accent-primary)]/40 shadow-sm'
            : 'bg-background/25 border-[var(--glass-border)] hover:border-[var(--glass-border-highlight)]/40'
      }`}
    >
      {children}
    </div>
  );
}
