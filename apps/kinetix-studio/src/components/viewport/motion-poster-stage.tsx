import { createSignal, createMemo, createEffect, onCleanup, type Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import { getSpatialSkeletonSpec } from '@/engine/spatial-skeleton';
import { renderPosterComposition } from '@/engine/composition-engine';
import { StoryboardCompositor } from '@/engine/composition/storyboard-compositor';
import { cn } from '@/lib/utils';

export interface MotionPosterStageProps {
  ambientCanvasRef?: (el: HTMLCanvasElement | null) => void;
  heroCanvasRef?: (el: HTMLCanvasElement | null) => void;
  masterCanvasRef?: (el: HTMLCanvasElement | null) => void;
  zoom?: number;
}

export const MotionPosterStage: Component<MotionPosterStageProps> = (props) => {
  const studio = useStudio();
  let canvasRef: HTMLCanvasElement | undefined;
  const [isDragging, setIsDragging] = createSignal(false);
  let dragStart = { x: 0, y: 0, startOffsetX: 0, startOffsetY: 0 };

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      startOffsetX: studio.state.stageOffsetX ?? 0,
      startOffsetY: studio.state.stageOffsetY ?? 0,
    };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging()) return;
    const z = props.zoom || 1;
    const dx = (e.clientX - dragStart.x) / z;
    const dy = (e.clientY - dragStart.y) / z;
    studio.patchState({
      stageOffsetX: Math.round(dragStart.startOffsetX + dx),
      stageOffsetY: Math.round(dragStart.startOffsetY + dy),
    });
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (isDragging()) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleResetOffset = () => {
    studio.patchState({ stageOffsetX: 0, stageOffsetY: 0 });
    studio.triggerToast('Reset Hero Stage Position to Center');
  };

  // Poster Stage Display Dimensions by Aspect Ratio
  const stageDimensions = createMemo(() => {
    if (studio.state.aspectRatio === '9:16') return { width: 344, height: 612 };
    if (studio.state.aspectRatio === '4:5') return { width: 412, height: 515 };
    if (studio.state.aspectRatio === '16:9') return { width: 576, height: 324 };
    return { width: 452, height: 452 };
  });

  const spatialSpec = createMemo(() => getSpatialSkeletonSpec(studio.state));
  const storyboardCompositor = new StoryboardCompositor();

  onCleanup(() => {
    storyboardCompositor.dispose();
  });

  // Master Canvas Rendering (Guarantees 100% Deterministic Parity with Export)
  createEffect(() => {
    const canvas = canvasRef;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const { width: displayW, height: displayH } = stageDimensions();

    // Set physical pixel dimensions for high-DPI Retina sharpness
    const targetW = Math.round(displayW * dpr);
    const targetH = Math.round(displayH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    if (studio.state.isStoryboardMode) {
      const globalTimeSec = (studio.currentFrame / studio.totalFrames) * studio.storyboard.totalDurationSec;
      storyboardCompositor.renderSequenceFrame(ctx, {
        sequence: studio.storyboard,
        globalTimeSec,
        baseState: studio.state,
        width: displayW,
        height: displayH,
        totalFrames: studio.totalFrames,
        scale: dpr,
        audioTelemetry: studio.audioTelemetry,
      });
    } else {
      renderPosterComposition(ctx, {
        width: displayW,
        height: displayH,
        state: studio.state,
        frame: studio.currentFrame,
        totalFrames: studio.totalFrames,
        choreo: studio.choreo,
        scale: dpr,
        audioTelemetry: studio.audioTelemetry,
      });
    }
  });

  return (
    <div class="flex-1 flex items-center justify-center p-4 overflow-hidden relative select-none">
      <div
        style={{
          width: `${stageDimensions().width}px`,
          height: `${stageDimensions().height}px`,
          'background-color': studio.state.palette.bg,
          filter: studio.state.liquidWarp ? 'url(#kx-liquid-filter)' : 'none',
          transform: `scale(${props.zoom || 1})`,
          'transform-origin': 'center center',
          ...spatialSpec().outerStyle,
        }}
        class={cn(
          'relative rounded-lg overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.75)] transition-all duration-300 flex items-center justify-center',
          spatialSpec().outerClass
        )}
      >
        {/* UNIFIED MASTER STAGE CANVAS (Zero Visual Divergence) */}
        <canvas
          ref={(el) => {
            canvasRef = el;
            props.masterCanvasRef?.(el);
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDblClick={handleResetOffset}
          style={{
            width: `${stageDimensions().width}px`,
            height: `${stageDimensions().height}px`,
          }}
          class={cn(
            'w-full h-full object-contain block select-none',
            isDragging() ? 'cursor-grabbing' : 'cursor-grab'
          )}
          title="Drag to position hero stage | Double click to center"
        />

        {/* Stage Offset Telemetry Badge */}
        {((studio.state.stageOffsetX ?? 0) !== 0 || (studio.state.stageOffsetY ?? 0) !== 0) && (
          <div class="absolute bottom-2 left-2 px-2.5 py-1 bg-black/85 backdrop-blur-md border border-white/20 rounded text-xs font-mono text-zinc-200 flex items-center gap-1.5 z-20 shadow-md">
            <span>Stage Offset: X:{studio.state.stageOffsetX ?? 0} Y:{studio.state.stageOffsetY ?? 0}</span>
            <button
              onClick={handleResetOffset}
              class="text-indigo-400 hover:text-indigo-300 underline font-mono text-xs font-bold ml-1 cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}

        {/* Backward-compatible hidden canvas hooks if provided */}
        {props.ambientCanvasRef && (
          <canvas
            ref={props.ambientCanvasRef}
            width={10}
            height={10}
            class="hidden"
            aria-hidden="true"
          />
        )}
        {props.heroCanvasRef && (
          <canvas
            ref={props.heroCanvasRef}
            width={10}
            height={10}
            class="hidden"
            aria-hidden="true"
          />
        )}

        {/* Invisible Semantic Accessible Overlay (WCAG 2.2 AA / Screen Readers) */}
        <div class="sr-only" aria-live="polite">
          <h1>{studio.state.content.headline.join(' ')}</h1>
          <p>{studio.state.content.subhead}</p>
          <p>{studio.state.content.date} at {studio.state.content.location}</p>
          <p>Tag: {studio.state.content.tag}</p>
          <p>Sponsor: {studio.state.content.sponsor}</p>
          <p>Active Layout: {studio.state.layoutId}</p>
          <p>Active Shader: {studio.state.shaderId}</p>
        </div>
      </div>
    </div>
  );
};
