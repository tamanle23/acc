import React, { useRef } from 'react';
import { useDraggable } from '@neodrag/react';

export interface TrimHandleProps {
  seq: any;
  handle: 'start' | 'end';
  onTrimStart?: (seq: any, handle: 'start' | 'end') => void;
  onTrim?: (seq: any, handle: 'start' | 'end', delta: { x: number; y: number }) => void;
  onTrimEnd?: (seq: any, handle: 'start' | 'end') => void;
}

export function TrimHandle({
  seq,
  handle,
  onTrimStart,
  onTrim,
  onTrimEnd,
}: TrimHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);

  useDraggable(handleRef, {
    axis: 'x',
    threshold: { distance: 3 },
    transform: () => '',
    onDragStart: () => onTrimStart?.(seq, handle),
    onDrag: ({ offsetX, offsetY }) => onTrim?.(seq, handle, { x: offsetX, y: offsetY }),
    onDragEnd: () => onTrimEnd?.(seq, handle),
  });

  return (
    <div
      ref={handleRef}
      data-trim-handle={handle}
      onClick={(e) => e.stopPropagation()}
      className={`w-2 h-full ${
        handle === 'start' ? '-ml-2 rounded-l-xs' : '-mr-2 rounded-r-xs'
      } cursor-col-resize hover:bg-white/50 active:bg-accent-theme/60 flex items-center justify-center transition-colors z-30`}
      title={`Drag to Trim ${handle === 'start' ? 'Start' : 'End'} (Snap enabled)`}
    >
      <div className="w-0.5 h-3 bg-white/60 rounded-full pointer-events-none" />
    </div>
  );
}
