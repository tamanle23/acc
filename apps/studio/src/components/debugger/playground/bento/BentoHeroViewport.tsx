import { createSignal, onMount, onCleanup, createEffect, Show } from 'solid-js';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Sparkles,
  Maximize2,
  AlertTriangle,
  Activity,
  Layers,
  Columns,
  Split,
  Eye,
} from 'lucide-solid';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Slider } from '../../../ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import type { PlaygroundEngine, BackdropMode } from '../usePlaygroundEngine';

export interface BentoHeroViewportProps {
  engine: PlaygroundEngine;
  class?: string;
  onToggleZen?: () => void;
}

export function BentoHeroViewport(props: BentoHeroViewportProps) {
  let containerRef: HTMLDivElement | undefined;
  let canvasRef: HTMLCanvasElement | undefined;
  let isDraggingSplit = false;

  const { state, activePlugin } = props.engine;

  const formatTimecode = (frame: number, fps: number) => {
    const totalSecs = Math.floor(frame / fps);
    const f = frame % fps;
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
  };

  const updateCanvasDimensions = () => {
    if (!canvasRef || !containerRef) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = containerRef.getBoundingClientRect();
    const availWidth = Math.max(120, rect.width - 24);
    const availHeight = Math.max(120, rect.height - 24);

    let targetWidth = availWidth;
    let targetHeight = availHeight;

    const ratio = state.aspectRatio;
    let desiredAspect = 16 / 9;
    if (ratio === '9:16') desiredAspect = 9 / 16;
    if (ratio === '1:1') desiredAspect = 1;

    const containerAspect = availWidth / availHeight;
    if (containerAspect > desiredAspect) {
      targetWidth = availHeight * desiredAspect;
    } else {
      targetHeight = availWidth / desiredAspect;
    }

    canvasRef.width = Math.round(targetWidth * dpr);
    canvasRef.height = Math.round(targetHeight * dpr);
    canvasRef.style.width = `${Math.round(targetWidth)}px`;
    canvasRef.style.height = `${Math.round(targetHeight)}px`;

    props.engine.attachCanvas(canvasRef);
  };

  // Pointer drag handler for A/B Split slider
  const handlePointerDown = (e: PointerEvent) => {
    if (!state.isSplitEnabled || !canvasRef) return;
    isDraggingSplit = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDraggingSplit || !canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    props.engine.updateSplitPosition(relX);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (isDraggingSplit) {
      isDraggingSplit = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  onMount(() => {
    updateCanvasDimensions();
    const ro = new ResizeObserver(() => updateCanvasDimensions());
    if (containerRef) ro.observe(containerRef);
    window.addEventListener('resize', updateCanvasDimensions);

    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener('resize', updateCanvasDimensions);
      props.engine.attachCanvas(null);
    });
  });

  createEffect(() => {
    state.aspectRatio;
    updateCanvasDimensions();
  });

  return (
    <div
      class={`flex flex-col h-full w-full min-h-0 min-w-0 glass-panel rounded-2xl border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] bg-glass-surface/50 backdrop-blur-xl shadow-lg overflow-hidden select-none relative group ${
        props.class || ''
      }`}
    >
      {/* Central Viewport Area */}
      <div
        ref={containerRef}
        class={`relative flex-1 min-h-0 min-w-0 flex items-center justify-center p-3 overflow-hidden bg-background/50 ${
          state.isSplitEnabled ? 'cursor-ew-resize' : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          data-testid="bento-hero-canvas"
          class="rounded-xl shadow-2xl border border-glass-border max-w-full max-h-full object-contain transition-all"
        />

        {/* Floating Top-Left Telemetry Badges */}
        <div class="absolute top-5 left-5 flex items-center gap-2 pointer-events-none z-10">
          <Badge
            variant="outline"
            class={`font-mono text-[10px] px-2 py-0.5 backdrop-blur-md shadow-sm border ${
              state.telemetry.fps >= 50
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
          >
            <Activity class="w-2.5 h-2.5 mr-1 inline" />
            {state.telemetry.fps} FPS
          </Badge>

          <Badge
            variant="outline"
            class={`font-mono text-[10px] px-2 py-0.5 backdrop-blur-md shadow-sm border ${
              state.telemetry.latencyMs <= 16
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}
          >
            {state.telemetry.latencyMs.toFixed(1)} ms
          </Badge>

          <Badge
            variant="outline"
            class={`font-mono text-[10px] px-2 py-0.5 backdrop-blur-md shadow-sm border ${
              state.telemetry.stackDelta === 0
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
            }`}
          >
            Context Δ: {state.telemetry.stackDelta}
          </Badge>

          <Show when={state.modifierStack.length > 0}>
            <Badge
              variant="outline"
              class="font-mono text-[10px] px-2 py-0.5 backdrop-blur-md bg-accent-theme/20 text-accent-theme border-accent-theme/40"
            >
              <Layers class="w-2.5 h-2.5 mr-1 inline" />
              Stack: {state.modifierStack.filter((m) => m.enabled).length}/{state.modifierStack.length}
            </Badge>
          </Show>
        </div>

        {/* Floating Top-Right Tool Buttons */}
        <div class="absolute top-5 right-5 flex items-center gap-1.5 z-10">
          {/* A/B Split Comparison Toggle */}
          <button
            type="button"
            class={`px-2.5 py-1 rounded-lg font-mono text-[11px] backdrop-blur-md transition-all flex items-center gap-1.5 border shadow-sm ${
              state.isSplitEnabled
                ? 'bg-accent-theme text-white border-accent-theme font-bold shadow-accent-glow'
                : 'bg-glass-surface/80 text-muted-foreground border-glass-border hover:text-foreground hover:bg-glass-surface'
            }`}
            onClick={props.engine.toggleSplit}
            title="Toggle A/B Wipe Split Comparison"
          >
            <Split class="w-3.5 h-3.5" />
            <span>A/B Split</span>
          </button>

          <Show when={props.onToggleZen}>
            <button
              type="button"
              class="p-1.5 rounded-lg bg-glass-surface/80 text-muted-foreground border border-glass-border hover:text-foreground backdrop-blur-md shadow-sm"
              onClick={props.onToggleZen}
              title="Toggle Zen Fullscreen Viewport"
            >
              <Maximize2 class="w-3.5 h-3.5" />
            </button>
          </Show>
        </div>

        {/* Error Alert Overlay */}
        <Show when={state.telemetry.lastError}>
          {(err) => (
            <div class="absolute bottom-5 left-5 right-5 p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs backdrop-blur-md flex items-center gap-3 shadow-xl z-20">
              <AlertTriangle class="w-4 h-4 text-rose-400 shrink-0" />
              <div class="flex-1 truncate">
                <span class="font-bold">Render Exception: </span>
                <span>{err()}</span>
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* Integrated Bottom Transport Bar */}
      <div class="px-4 py-2.5 border-t border-glass-border bg-glass-surface/70 backdrop-blur-md shrink-0 flex flex-col gap-2">
        {/* Scrubber Slider */}
        <div class="flex items-center gap-3">
          <Slider
            data-testid="bento-scrubber"
            min={0}
            max={state.totalFrames - 1}
            step={1}
            value={state.currentFrame}
            onChange={(val) => props.engine.seek(val[0])}
            class="flex-1"
          />
          <span class="font-mono text-[11px] text-muted-foreground shrink-0 w-28 text-right">
            {formatTimecode(state.currentFrame, state.fps)} ({state.currentFrame}/{state.totalFrames})
          </span>
        </div>

        {/* Transport Actions & Mode Selectors */}
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              class="h-7 px-2.5 gap-1.5 font-mono text-xs border-glass-border hover:bg-accent-theme/10 hover:text-accent-theme"
              onClick={props.engine.togglePlay}
            >
              {state.isPlaying ? <Pause class="w-3.5 h-3.5" /> : <Play class="w-3.5 h-3.5" />}
              <span>{state.isPlaying ? 'Pause' : 'Play'}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => props.engine.seek(state.currentFrame - 1)}
              title="Step -1 Frame (Left Arrow)"
            >
              <SkipBack class="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => props.engine.seek(state.currentFrame + 1)}
              title="Step +1 Frame (Right Arrow)"
            >
              <SkipForward class="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => props.engine.seek(0)}
              title="Return to Frame 0"
            >
              <RotateCcw class="w-3 h-3" />
            </Button>
          </div>

          <div class="flex items-center gap-2">
            {/* Speed Pills */}
            <div class="flex items-center rounded-lg bg-background/40 p-0.5 border border-glass-border text-[11px] font-mono">
              {[0.25, 0.5, 1.0, 2.0].map((s) => (
                <button
                  type="button"
                  class={`px-2 py-0.5 rounded-md transition-colors ${
                    state.speed === s
                      ? 'bg-accent-theme/20 text-accent-theme font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => props.engine.setSpeed(s)}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Aspect Ratio Pills */}
            <div class="flex items-center rounded-lg bg-background/40 p-0.5 border border-glass-border text-[11px] font-mono">
              {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
                <button
                  type="button"
                  class={`px-2 py-0.5 rounded-md transition-colors ${
                    state.aspectRatio === ratio
                      ? 'bg-accent-theme/20 text-accent-theme font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => props.engine.setAspectRatio(ratio)}
                >
                  {ratio}
                </button>
              ))}
            </div>

            {/* Backdrop Selector */}
            <Select
              value={state.backdropMode}
              onChange={(val) => props.engine.setBackdropMode(val as BackdropMode)}
            >
              <SelectTrigger class="h-7 w-32 text-xs font-mono border-glass-border bg-glass-surface/60">
                <SelectValue placeholder="Backdrop" />
              </SelectTrigger>
              <SelectContent class="glass-panel border-glass-border">
                <SelectItem value="testcard" class="text-xs font-mono">SMPTE Testcard</SelectItem>
                <SelectItem value="dark" class="text-xs font-mono">Obsidian Dark</SelectItem>
                <SelectItem value="white" class="text-xs font-mono">Studio White</SelectItem>
                <SelectItem value="checkerboard" class="text-xs font-mono">Checkerboard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
