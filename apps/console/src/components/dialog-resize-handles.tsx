import React from 'react';
import { cn } from '@/lib/utils';
import type { ResizeDirection } from '@/hooks/use-resizable-dialog';

interface DialogResizeHandlesProps {
  onStartResize: (direction: ResizeDirection, e: React.MouseEvent) => void;
  isMaximized?: boolean;
}

export const DialogResizeHandles: React.FC<DialogResizeHandlesProps> = ({
  onStartResize,
  isMaximized,
}) => {
  if (isMaximized) return null;

  return (
    <>
      {/* Corner Handles */}
      <div
        data-testid="resize-handle-bottom-right"
        className={cn(
          'absolute -bottom-1 -right-1 w-5 h-5 cursor-nwse-resize z-50',
          'flex items-end justify-end p-1 group select-none pointer-events-auto'
        )}
        onMouseDown={(e) => onStartResize('bottom-right', e)}
        title="Resize dialog"
      >
        <svg
          className="w-2.5 h-2.5 text-muted-foreground/40 group-hover:text-primary transition-colors pointer-events-none"
          viewBox="0 0 10 10"
          fill="currentColor"
        >
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="8" cy="4" r="1.2" />
          <circle cx="4" cy="8" r="1.2" />
          <circle cx="8" cy="0" r="1.2" />
          <circle cx="4" cy="4" r="1.2" />
          <circle cx="0" cy="8" r="1.2" />
        </svg>
      </div>

      <div
        data-testid="resize-handle-bottom-left"
        className="absolute -bottom-1 -left-1 w-4 h-4 cursor-nesw-resize z-50 select-none pointer-events-auto"
        onMouseDown={(e) => onStartResize('bottom-left', e)}
        title="Resize dialog"
      />

      <div
        data-testid="resize-handle-top-right"
        className="absolute -top-1 -right-1 w-4 h-4 cursor-nesw-resize z-50 select-none pointer-events-auto"
        onMouseDown={(e) => onStartResize('top-right', e)}
        title="Resize dialog"
      />

      <div
        data-testid="resize-handle-top-left"
        className="absolute -top-1 -left-1 w-4 h-4 cursor-nwse-resize z-50 select-none pointer-events-auto"
        onMouseDown={(e) => onStartResize('top-left', e)}
        title="Resize dialog"
      />

      {/* Edge Handles */}
      <div
        data-testid="resize-handle-right"
        className="absolute top-4 bottom-4 -right-1.5 w-3 cursor-ew-resize z-40 select-none pointer-events-auto hover:bg-primary/20 transition-colors rounded-full opacity-0 hover:opacity-100"
        onMouseDown={(e) => onStartResize('right', e)}
        title="Drag to resize width"
      />

      <div
        data-testid="resize-handle-left"
        className="absolute top-4 bottom-4 -left-1.5 w-3 cursor-ew-resize z-40 select-none pointer-events-auto hover:bg-primary/20 transition-colors rounded-full opacity-0 hover:opacity-100"
        onMouseDown={(e) => onStartResize('left', e)}
        title="Drag to resize width"
      />

      <div
        data-testid="resize-handle-bottom"
        className="absolute -bottom-1.5 left-4 right-4 h-3 cursor-ns-resize z-40 select-none pointer-events-auto hover:bg-primary/20 transition-colors rounded-full opacity-0 hover:opacity-100"
        onMouseDown={(e) => onStartResize('bottom', e)}
        title="Drag to resize height"
      />

      <div
        data-testid="resize-handle-top"
        className="absolute -top-1.5 left-4 right-4 h-3 cursor-ns-resize z-40 select-none pointer-events-auto hover:bg-primary/20 transition-colors rounded-full opacity-0 hover:opacity-100"
        onMouseDown={(e) => onStartResize('top', e)}
        title="Drag to resize height"
      />
    </>
  );
};
