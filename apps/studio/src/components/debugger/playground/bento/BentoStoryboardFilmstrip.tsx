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

  const renderAllThumbnails = () => {
    const kfs = keyframes();
    kfs.forEach((kf, idx) => {
      const c = canvasRefs[idx];
      if (c) {
        props.engine.renderKeyframeToCanvas(c, kf.frame);
      }
    });
  };

  const scheduleRender = () => {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderAllThumbnails();
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
    // Initial render
    setTimeout(renderAllThumbnails, 50);
  });

  onCleanup(() => {
    if (renderTimer) clearTimeout(renderTimer);
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
      class={`flex flex-col rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden p-3.5 transition-all duration-200 ${
        props.class || ''
      }`}
    >
      {/* Header */}
      <div class="flex items-center justify-between gap-2 mb-2.5 px-1">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Film class="h-3.5 w-3.5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-white tracking-wide">Storyboard Filmstrip</span>
              <Badge variant="outline" class="text-[10px] py-0 px-1.5 h-4 text-indigo-400 border-indigo-500/30">
                5 Keyframes
              </Badge>
            </div>
            <p class="text-[10px] text-slate-400">Direct zero-alloc keyframe sampling (0% to 100%)</p>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            class="h-7 text-xs px-2.5 text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-1.5 border border-white/5"
            onClick={exportCurrentFrameSnapshot}
            title="Download PNG Snapshot at Current Frame"
          >
            <Show when={copiedNotification()} fallback={<Camera class="h-3 w-3 text-indigo-400" />}>
              <Check class="h-3 w-3 text-emerald-400" />
            </Show>
            <span class="text-[11px]">{copiedNotification() ? 'Downloaded' : 'Snapshot PNG'}</span>
          </Button>
        </div>
      </div>

      {/* Reel strip of 5 mini-canvases */}
      <div class="grid grid-cols-5 gap-2.5 w-full flex-1">
        <For each={keyframes()}>
          {(kf) => {
            const isNearCurrent = () => Math.abs(state.currentFrame - kf.frame) <= 15;
            return (
              <div
                class={`group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer bg-slate-950/70 hover:scale-[1.02] ${
                  isNearCurrent()
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
                    : 'border-white/10 hover:border-white/25 hover:shadow-lg'
                }`}
                onClick={() => props.engine.seek(kf.frame)}
                title={`Seek to frame ${kf.frame} (${kf.pct}%)`}
              >
                {/* Mini Canvas */}
                <div class="relative w-full aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                  <canvas
                    ref={(el) => (canvasRefs[kf.index] = el)}
                    width={160}
                    height={90}
                    class="w-full h-full object-contain pointer-events-none"
                  />
                  {/* Hover Overlay with Play Icon */}
                  <div class="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                    <div class="h-7 w-7 rounded-full bg-indigo-500/80 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play class="h-3.5 w-3.5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Footer metadata */}
                <div class="flex items-center justify-between px-2 py-1.5 bg-slate-900/80 border-t border-white/5 text-[10px]">
                  <span
                    class={`font-mono font-medium ${isNearCurrent() ? 'text-indigo-400 font-bold' : 'text-slate-300'}`}
                  >
                    {kf.pct}%
                  </span>
                  <span class="font-mono text-slate-400 text-[9px]">{formatTimecode(kf.frame, state.fps)}</span>
                  <span class="text-[9px] text-slate-500">f{kf.frame}</span>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
