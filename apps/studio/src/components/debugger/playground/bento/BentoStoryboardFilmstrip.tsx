import { createSignal, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import { Film, Camera, Play, Check, Download } from 'lucide-solid';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import type { PlaygroundEngine } from '../usePlaygroundEngine';

export interface BentoStoryboardFilmstripProps {
  engine: PlaygroundEngine;
  class?: string;
}

interface KeyframeItem {
  index: number;
  pct: number;
  frame: number;
}

export function BentoStoryboardFilmstrip(props: BentoStoryboardFilmstripProps) {
  const { state } = props.engine;
  const canvasRefs: (HTMLCanvasElement | null)[] = [null, null, null, null, null];
  const [copiedNotification, setCopiedNotification] = createSignal(false);
  let renderTimer: ReturnType<typeof setTimeout> | null = null;
  let rafHandle: number | null = null;

  const cancelPendingRenders = () => {
    if (renderTimer) {
      clearTimeout(renderTimer);
      renderTimer = null;
    }
    if (rafHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  };

  const keyframes = (): KeyframeItem[] => {
    const total = Math.max(0, state.totalFrames - 1);
    return [0, 1, 2, 3, 4].map((i) => ({
      index: i,
      pct: i * 25,
      frame: Math.round((i * total) / 4),
    }));
  };

  const formatTimecode = (frame: number, fps: number) => {
    const totalSecs = Math.floor(frame / fps);
    const f = frame % fps;
    const s = totalSecs % 60;
    return `${s}.${String(f).padStart(2, '0')}s`;
  };

  // Staggered keyframe render pass: renders 1 thumbnail per requestAnimationFrame tick
  // to eliminate synchronous burst allocations on modal open and parameter changes
  const renderAllThumbnailsStaggered = () => {
    cancelPendingRenders();
    const kfs = keyframes();
    let currentIdx = 0;

    const renderNext = () => {
      if (currentIdx >= kfs.length) {
        rafHandle = null;
        return;
      }
      const c = canvasRefs[currentIdx];
      if (c) {
        props.engine.renderKeyframeToCanvas(c, kfs[currentIdx].frame);
      }
      currentIdx++;
      if (typeof requestAnimationFrame !== 'undefined') {
        rafHandle = requestAnimationFrame(renderNext);
      } else {
        renderNext();
      }
    };

    renderNext();
  };

  const scheduleRender = () => {
    cancelPendingRenders();
    renderTimer = setTimeout(() => {
      renderAllThumbnailsStaggered();
    }, 150);
  };

  // Re-render thumbnails when plugin, params, stack, or backdrop changes
  createEffect(() => {
    // Read reactive dependencies
    const _p = state.selectedPluginType;
    const _params = JSON.stringify(state.currentParams);
    const _stack = JSON.stringify(state.modifierStack);
    const _bd = state.backdropMode;
    const _aspect = state.aspectRatio;

    scheduleRender();
  });

  onMount(() => {
    // Initial staggered render with a brief settle beat
    renderTimer = setTimeout(renderAllThumbnailsStaggered, 60);
  });

  onCleanup(() => {
    cancelPendingRenders();
  });

  const exportCurrentFrameSnapshot = () => {
    // Create an offscreen export or grab current keyframe
    const total = Math.max(1, state.totalFrames - 1);
    const curF = state.currentFrame;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1280;
    tempCanvas.height = 720;
    props.engine.renderKeyframeToCanvas(tempCanvas, curF);

    try {
      const dataUrl = tempCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `ir-snapshot-${state.selectedPluginType.replace('/', '_')}-f${curF}.png`;
      link.href = dataUrl;
      link.click();
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    } catch (e) {
      console.error('Failed to export snapshot:', e);
    }
  };

  return (
    <div
      class={`flex flex-col h-full w-full min-h-0 min-w-0 glass-panel rounded-2xl border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] bg-glass-surface/50 backdrop-blur-xl shadow-lg p-2.5 transition-all duration-200 overflow-hidden select-none ${
        props.class || ''
      }`}
    >
      {/* Header */}
      <div class="flex items-center justify-between gap-2 mb-2 px-1 shrink-0">
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-md bg-accent-theme/15 text-accent-theme border border-accent-theme/30">
            <Film class="h-3.5 w-3.5" />
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-foreground">Storyboard Filmstrip</span>
              <Badge variant="outline" class="text-[9px] py-0 px-1.5 h-4 text-accent-theme border-accent-theme/30 bg-accent-theme/10">
                5 Keyframes
              </Badge>
            </div>
            <p class="text-[9px] text-muted-foreground">Direct zero-alloc keyframe sampling (0% to 100%)</p>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            class="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground hover:bg-glass-surface flex items-center gap-1.5 border border-glass-border"
            onClick={exportCurrentFrameSnapshot}
            title="Download PNG Snapshot at Current Frame"
          >
            <Show when={copiedNotification()} fallback={<Camera class="h-3 w-3 text-accent-theme" />}>
              <Check class="h-3 w-3 text-emerald-400" />
            </Show>
            <span>{copiedNotification() ? 'Downloaded' : 'Snapshot PNG'}</span>
          </Button>
        </div>
      </div>

      {/* Reel strip of 5 mini-canvases */}
      <div class="grid grid-cols-5 gap-2 w-full flex-1 min-h-0">
        <For each={keyframes()}>
          {(kf) => {
            const isNearCurrent = () => Math.abs(state.currentFrame - kf.frame) <= 15;
            return (
              <div
                class={`group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer bg-background/50 hover:scale-[1.02] ${
                  isNearCurrent()
                    ? 'border-accent-theme ring-2 ring-accent-theme/30 shadow-accent-glow'
                    : 'border-glass-border hover:border-accent-theme/40 hover:shadow-md'
                }`}
                onClick={() => props.engine.seek(kf.frame)}
                title={`Seek to frame ${kf.frame} (${kf.pct}%)`}
              >
                {/* Mini Canvas */}
                <div class="relative w-full aspect-video bg-background/80 flex items-center justify-center overflow-hidden">
                  <canvas
                    ref={(el) => (canvasRefs[kf.index] = el)}
                    width={160}
                    height={90}
                    class="w-full h-full object-contain pointer-events-none"
                  />
                  {/* Hover Overlay with Play Icon */}
                  <div class="absolute inset-0 bg-accent-theme/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                    <div class="h-6 w-6 rounded-full bg-accent-theme text-primary-foreground flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play class="h-3 w-3 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Footer metadata */}
                <div class="flex items-center justify-between px-2 py-1 bg-glass-surface/80 border-t border-glass-border text-[9px]">
                  <span
                    class={`font-mono font-medium ${isNearCurrent() ? 'text-accent-theme font-bold' : 'text-foreground/90'}`}
                  >
                    {kf.pct}%
                  </span>
                  <span class="font-mono text-muted-foreground text-[8px]">{formatTimecode(kf.frame, state.fps)}</span>
                  <span class="text-[8px] text-muted-foreground/70">f{kf.frame}</span>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
