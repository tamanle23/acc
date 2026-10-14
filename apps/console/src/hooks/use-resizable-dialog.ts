import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseResizableOptions {
  storageKey?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidthRatio?: number; // e.g. 0.98 of window
  maxHeightRatio?: number; // e.g. 0.96 of window
}

export type ResizeDirection =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top';

export function useResizableDialog(options: UseResizableOptions = {}) {
  const {
    storageKey = 'console:dialog:blueprint-catalog:dimensions',
    defaultWidth = 1150,
    defaultHeight = 780,
    minWidth = 560,
    minHeight = 440,
    maxWidthRatio = 0.96,
    maxHeightRatio = 0.88,
  } = options;

  // Compute responsive defaults based on available window space
  const getResponsiveDefault = useCallback(() => {
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const calcW = Math.min(defaultWidth, Math.round(winW * 0.92));
    const calcH = Math.min(defaultHeight, Math.round(winH * 0.82));
    return {
      width: Math.max(minWidth, calcW),
      height: Math.max(minHeight, calcH),
    };
  }, [defaultWidth, defaultHeight, minWidth, minHeight]);

  // Track maximized state
  const [isMaximized, setIsMaximized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`${storageKey}:maximized`) === 'true';
    } catch {
      return false;
    }
  });

  // Track custom size
  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    const responsive = getResponsiveDefault();
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
          const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
          const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
          const maxAllowedW = Math.round(winW * maxWidthRatio);
          const maxAllowedH = Math.round(winH * maxHeightRatio);
          return {
            width: Math.min(maxAllowedW, Math.max(minWidth, parsed.width)),
            height: Math.min(maxAllowedH, Math.max(minHeight, parsed.height)),
          };
        }
      }
    } catch {
      // LocalStorage unavailable or corrupt
    }
    return responsive;
  });

  const [isResizing, setIsResizing] = useState(false);
  const activeResizeRef = useRef<{
    direction: ResizeDirection;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Sync size changes to localStorage (debounced via effect)
  useEffect(() => {
    if (!isMaximized && size.width && size.height) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(size));
      } catch {
        // Storage fail-safe
      }
    }
  }, [size, isMaximized, storageKey]);

  // Sync maximized state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}:maximized`, String(isMaximized));
    } catch {
      // Storage fail-safe
    }
  }, [isMaximized, storageKey]);

  const toggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  const resetToDefault = useCallback(() => {
    setIsMaximized(false);
    setSize(getResponsiveDefault());
  }, [getResponsiveDefault]);

  const startResize = useCallback(
    (direction: ResizeDirection, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isMaximized) return;

      setIsResizing(true);
      activeResizeRef.current = {
        direction,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: size.width,
        startHeight: size.height,
      };
    },
    [isMaximized, size]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!activeResizeRef.current) return;
      const { direction, startX, startY, startWidth, startHeight } = activeResizeRef.current;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const maxWidth = window.innerWidth * maxWidthRatio;
      const maxHeight = window.innerHeight * maxHeightRatio;

      let newWidth = startWidth;
      let newHeight = startHeight;

      // Because dialog is centered via translate(-50%, -50%), dragging right adds 2 * deltaX for symmetrical,
      // or if we resize from corner, each 1px mouse movement increases width/height by 2x if center-anchored,
      // OR 1x if we drag right edge. With standard transform translate(-50%, -50%), expanding by delta expands around center.
      // 2 * deltaX produces natural 1:1 cursor-following resize behavior on centered modals!
      const factorX = 2;
      const factorY = 2;

      switch (direction) {
        case 'right':
        case 'bottom-right':
        case 'top-right':
          newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + deltaX * factorX));
          break;
        case 'left':
        case 'bottom-left':
        case 'top-left':
          newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth - deltaX * factorX));
          break;
        default:
          break;
      }

      switch (direction) {
        case 'bottom':
        case 'bottom-right':
        case 'bottom-left':
          newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight + deltaY * factorY));
          break;
        case 'top':
        case 'top-right':
        case 'top-left':
          newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight - deltaY * factorY));
          break;
        default:
          break;
      }

      setSize({
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      activeResizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, maxWidthRatio, maxHeightRatio, minWidth, minHeight]);

  // Compute inline styles for the DialogContent element
  const dialogStyle: React.CSSProperties = isMaximized
    ? {
        width: '98vw',
        height: '96vh',
        maxWidth: '98vw',
        maxHeight: '96vh',
        margin: 0,
      }
    : {
        width: `min(${size.width}px, ${Math.round(maxWidthRatio * 100)}vw)`,
        height: `min(${size.height}px, ${Math.round(maxHeightRatio * 100)}vh)`,
        maxWidth: `${Math.round(maxWidthRatio * 100)}vw`,
        maxHeight: `${Math.round(maxHeightRatio * 100)}vh`,
        margin: 0,
      };

  return {
    size,
    isMaximized,
    isResizing,
    toggleMaximize,
    resetToDefault,
    startResize,
    dialogStyle,
  };
}
