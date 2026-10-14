import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseResizableOptions {
  storageKey?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidthRatio?: number; // e.g. 0.98 of window
  maxHeightRatio?: number; // e.g. 0.96 of window
  anchor?: 'top' | 'center';
  topOffset?: string; // CSS top offset when anchored to top, e.g. '3.5rem' or '5vh'
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
    anchor = 'top',
    topOffset = '3.5rem',
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

      // Because dialog is horizontally centered via translate-x-[-50%], dragging left/right adds 2 * deltaX for symmetrical resize.
      const factorX = 2;
      // When anchored to top (natural desktop window layout), dragging the bottom edge increases height directly by 1 * deltaY.
      // When center-anchored, dragging from bottom/top expands around center with 2 * deltaY.
      const factorY = anchor === 'top' ? 1 : 2;

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
  }, [isResizing, maxWidthRatio, maxHeightRatio, minWidth, minHeight, anchor]);

  // Compute inline styles for the DialogContent element
  const dialogStyle: React.CSSProperties = isMaximized
    ? {
        position: 'fixed',
        top: '1.5vh',
        left: '1vw',
        width: '98vw',
        height: '97vh',
        maxWidth: '98vw',
        maxHeight: '97vh',
        transform: 'none',
        margin: 0,
      }
    : {
        position: 'fixed',
        top: anchor === 'top' ? topOffset : '50%',
        left: '50%',
        transform: anchor === 'top' ? 'translateX(-50%)' : 'translate(-50%, -50%)',
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
