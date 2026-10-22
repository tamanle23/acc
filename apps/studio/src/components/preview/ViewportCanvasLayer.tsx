import React from 'react';

export interface ViewportCanvasLayerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isPanToolActive: boolean;
  isSpacePressed: boolean;
}

export function ViewportCanvasLayer({
  canvasRef,
  overlayCanvasRef,
  isPanToolActive,
  isSpacePressed,
}: ViewportCanvasLayerProps) {
  return (
    <>
      {/* Layer 1: Base Video IR Canvas (100% Pure Video IR) */}
      <canvas
        id="studio-canvas"
        ref={canvasRef}
        className={`w-full h-full object-contain block bg-black ${
          isPanToolActive || isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
        style={{
          aspectRatio: '16/9',
          backgroundColor: '#000000',
        }}
      />

      {/* Layer 2: Dedicated Transparent Overlay Canvas (2D Snapping Guides & Alignment Only) */}
      <canvas
        id="studio-overlay-canvas"
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
        style={{
          aspectRatio: '16/9',
        }}
      />
    </>
  );
}
