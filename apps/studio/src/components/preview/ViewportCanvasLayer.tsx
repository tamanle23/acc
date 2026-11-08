export interface ViewportCanvasLayerProps {
  canvasRef: any;
  overlayCanvasRef: any;
  isPanToolActive: boolean;
  isSpacePressed: boolean;
}

export function ViewportCanvasLayer(props: ViewportCanvasLayerProps) {
  return (
    <>
      {/* Layer 1: Base Video IR Canvas (100% Pure Video IR) */}
      <canvas
        id="studio-canvas"
        ref={(el) => {
          if (typeof props.canvasRef === 'function') props.canvasRef(el);
          else if (props.canvasRef) props.canvasRef.current = el;
        }}
        class={`w-full h-full object-contain block bg-black ${
          props.isPanToolActive || props.isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
        style={{
          backgroundColor: '#000000',
        }}
      />

      {/* Layer 2: Dedicated Transparent Overlay Canvas (2D Snapping Guides & Alignment Only) */}
      <canvas
        id="studio-overlay-canvas"
        ref={(el) => {
          if (typeof props.overlayCanvasRef === 'function') props.overlayCanvasRef(el);
          else if (props.overlayCanvasRef) props.overlayCanvasRef.current = el;
        }}
        class="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
      />
    </>
  );
}
