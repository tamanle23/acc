import { createSignal, createMemo, type Component } from 'solid-js';
import { ViewportStatusHeader } from './viewport-status-header';
import { MotionPosterStage } from './motion-poster-stage';
import { FloatingStageHud } from './floating-stage-hud';
import { TimelineTransport } from '@/components/timeline/timeline-transport';
import { useStudio } from '@/context/studio-context';
import { getBaseExportDimensions } from '@/lib/export-video';

export interface StageViewportProps {
  ambientCanvasRef?: (el: HTMLCanvasElement | null) => void;
  heroCanvasRef?: (el: HTMLCanvasElement | null) => void;
  masterCanvasRef?: (el: HTMLCanvasElement | null) => void;
  onOpenShortcuts?: () => void;
  onOpenPresenter?: () => void;
}

export const StageViewport: Component<StageViewportProps> = (props) => {
  const studio = useStudio();
  const [zoom, setZoom] = createSignal<number>(1);

  const handleZoomIn = () => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))));
  const handleZoomReset = () => setZoom(1);

  const dims = createMemo(() => getBaseExportDimensions(studio.state.aspectRatio));
  const dimensionsText = createMemo(() => `${dims().width} × ${dims().height} [${studio.state.aspectRatio}]`);

  return (
    <main class="flex-1 flex flex-col bg-background/50 relative overflow-hidden">
      {/* Viewport Status Header */}
      <ViewportStatusHeader />

      {/* Interactive Poster Stage Container */}
      <div class="flex-1 relative flex items-center justify-center overflow-hidden">
        <MotionPosterStage
          ambientCanvasRef={props.ambientCanvasRef}
          heroCanvasRef={props.heroCanvasRef}
          masterCanvasRef={props.masterCanvasRef}
          zoom={zoom()}
        />

        {/* Floating Glass Stage HUD with Zoom & Shortcuts */}
        <FloatingStageHud
          zoom={zoom()}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onOpenShortcuts={props.onOpenShortcuts}
          onOpenPresenter={props.onOpenPresenter}
          dimensionsText={dimensionsText()}
        />
      </div>

      {/* Bottom Transport & Phase Choreography Timeline */}
      <TimelineTransport />
    </main>
  );
};
