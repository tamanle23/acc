import { useState, useCallback } from 'react';

export type ZoomLevel = 'fit' | 0.5 | 1.0 | 2.0;

export interface ViewportPanZoomState {
  zoomLevel: ZoomLevel;
  setZoomLevel: (zoom: ZoomLevel) => void;
  panOffset: { x: number; y: number };
  setPanOffset: (offset: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  isPanToolActive: boolean;
  setIsPanToolActive: (active: boolean | ((prev: boolean) => boolean)) => void;
  isSpacePressed: boolean;
  setIsSpacePressed: (pressed: boolean) => void;
  isPanning: boolean;
  setIsPanning: (panning: boolean) => void;
  panStart: { x: number; y: number };
  setPanStart: (start: { x: number; y: number }) => void;
  handleMouseDownPan: (e: React.MouseEvent) => void;
  handleMouseMovePan: (e: React.MouseEvent) => boolean;
  handleMouseUpPan: () => void;
  resetPanZoom: () => void;
}

export function useViewportPanZoom(): ViewportPanZoomState {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('fit');
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanToolActive, setIsPanToolActive] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDownPan = useCallback(
    (e: React.MouseEvent) => {
      if (isSpacePressed || isPanToolActive || e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      }
    },
    [isSpacePressed, isPanToolActive, panOffset]
  );

  const handleMouseMovePan = useCallback(
    (e: React.MouseEvent): boolean => {
      if (isPanning) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
        return true;
      }
      return false;
    },
    [isPanning, panStart]
  );

  const handleMouseUpPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetPanZoom = useCallback(() => {
    setZoomLevel('fit');
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return {
    zoomLevel,
    setZoomLevel,
    panOffset,
    setPanOffset,
    isPanToolActive,
    setIsPanToolActive,
    isSpacePressed,
    setIsSpacePressed,
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
    handleMouseDownPan,
    handleMouseMovePan,
    handleMouseUpPan,
    resetPanZoom,
  };
}
