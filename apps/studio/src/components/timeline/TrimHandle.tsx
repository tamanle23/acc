import React from 'react';
import { useDraggable } from '@dnd-kit/core';

export interface TrimHandleProps {
  seq: any;
  handle: 'start' | 'end';
}

export function TrimHandle({ seq, handle }: TrimHandleProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `trim-${handle}-${seq.id}`,
    data: {
      type: 'trim',
      handle,
      seq,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => e.stopPropagation()}
      className={`w-2 h-full ${
        handle === 'start' ? '-ml-2 rounded-l-xs' : '-mr-2 rounded-r-xs'
      } cursor-col-resize hover:bg-white/50 active:bg-[var(--accent-primary)]/60 flex items-center justify-center transition-colors z-30`}
      title={`Drag to Trim ${handle === 'start' ? 'Start' : 'End'} (Snap enabled)`}
    >
      <div className="w-0.5 h-3 bg-white/60 rounded-full" />
    </div>
  );
}
