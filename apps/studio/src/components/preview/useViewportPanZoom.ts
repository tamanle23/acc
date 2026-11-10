import { createSignal } from 'solid-js';

export type ZoomLevel = 'fit' | 0.5 | 1.0 | 2.0;

export interface ViewportPanZoomState {
  zoomLevel: ZoomLevel;
  zoomLevelSignal: () => ZoomLevel;
  setZoomLevel: (zoom: ZoomLevel) => void;
  panOffset: { x: number; y: number };
  panOffsetSignal: () => { x: number; y: number };
  setPanOffset: (offset: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  isPanToolActive: boolean;
  isPanToolActiveSignal: () => boolean;
  setIsPanToolActive: (active: boolean | ((prev: boolean) => boolean)) => void;
  isSpacePressed: boolean;
  isSpacePressedSignal: () => boolean;
  setIsSpacePressed: (pressed: boolean) => void;
  isPanning: boolean;
  isPanningSignal: () => boolean;
  setIsPanning: (panning: boolean) => void;
  panStart: { x: number; y: number };
  panStartSignal: () => { x: number; y: number };
  setPanStart: (start: { x: number; y: number }) => void;
  handleMouseDownPan: (e: MouseEvent) => void;
  handleMouseMovePan: (e: MouseEvent) => boolean;
  handleMouseUpPan: () => void;
  resetPanZoom: () => void;
}

export function useViewportPanZoom(): ViewportPanZoomState {
  const [zoomLevel, setZoomLevel] = createSignal<ZoomLevel>('fit');
  const [panOffset, setPanOffset] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanToolActive, setIsPanToolActive] = createSignal(false);
  const [isSpacePressed, setIsSpacePressed] = createSignal(false);
  const [isPanning, setIsPanning] = createSignal(false);
  const [panStart, setPanStart] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDownPan = (e: MouseEvent) => {
    if (isSpacePressed() || isPanToolActive() || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset().x, y: e.clientY - panOffset().y });
    }
  };

  const handleMouseMovePan = (e: MouseEvent): boolean => {
    if (isPanning()) {
      setPanOffset({
        x: e.clientX - panStart().x,
        y: e.clientY - panStart().y,
      });
      return true;
    }
    return false;
  };

  const handleMouseUpPan = () => {
    setIsPanning(false);
  };

  const resetPanZoom = () => {
    setZoomLevel('fit');
    setPanOffset({ x: 0, y: 0 });
  };

  return {
    get zoomLevel() {
      return zoomLevel();
    },
    zoomLevelSignal: zoomLevel,
    setZoomLevel,
    get panOffset() {
      return panOffset();
    },
    panOffsetSignal: panOffset,
    setPanOffset,
    get isPanToolActive() {
      return isPanToolActive();
    },
    isPanToolActiveSignal: isPanToolActive,
    setIsPanToolActive,
    get isSpacePressed() {
      return isSpacePressed();
    },
    isSpacePressedSignal: isSpacePressed,
    setIsSpacePressed,
    get isPanning() {
      return isPanning();
    },
    isPanningSignal: isPanning,
    setIsPanning,
    get panStart() {
      return panStart();
    },
    panStartSignal: panStart,
    setPanStart,
    handleMouseDownPan,
    handleMouseMovePan,
    handleMouseUpPan,
    resetPanZoom,
  };
}
