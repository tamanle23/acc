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
  Monitor,
  Activity,
  Layers,
} from 'lucide-solid';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Slider } from '../../ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import type { PlaygroundEngine, BackdropMode } from './usePlaygroundEngine';

export interface PlaygroundViewportProps {
  engine: PlaygroundEngine;
}

export function PlaygroundViewport(props: PlaygroundViewportProps) {
  let containerRef: HTMLDivElement | undefined;
  let canvasRef: HTMLCanvasElement | undefined;

  const { state, activePlugin } = props.engine;

  // Format frame to timecode HH:MM:SS:FF
  const formatTimecode = (frame: number, fps: number) => {
    const totalSecs = Math.floor(frame / fps);
    const f = frame % fps;
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
  };

  // High-DPI Canvas Resizing
  const updateCanvasDimensions = () => {
    if (!canvasRef || !containerRef) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = containerRef.getBoundingClientRect();
    const availWidth = Math.max(120, rect.width - 32);
    const availHeight = Math.max(120, rect.height - 32);

    let targetWidth = availWidth;
    let targetHeight = availHeight;

    // Calculate aspect ratio bounds inside container
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

    // Set physical buffer size
    canvasRef.width = Math.round(targetWidth * dpr);
    canvasRef.height = Math.round(targetHeight * dpr);

    // Set CSS display size
    canvasRef.style.width = `${Math.round(targetWidth)}px`;
    canvasRef.style.height = `${Math.round(targetHeight)}px`;

    // Notify engine
    props.engine.attachCanvas(canvasRef);
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
    // Re-evaluate on aspect ratio change
    state.aspectRatio;
    updateCanvasDimensions();
  });

  return (
    <div class="flex flex-col h-full w-full min-h-0 min-w-0 bg-background/50 overflow-hidden select-none">
      {/* Central Canvas Viewport Area */}
      <div
        ref={containerRef}
        class="relative flex-1 min-h-0 min-w-0 flex items-center justify-center p-4 overflow-hidden bg-slate-950/40"
      >
        <canvas
          ref={canvasRef}
          data-testid="playground-preview-canvas"
          class="rounded-xl shadow-2xl border border-white/10 max-w-full max-h-full object-contain transition-all"
        />

        {/* Floating Top-Left Telemetry Badges */}
        <div class="absolute top-6 left-6 flex items-center gap-2 pointer-events-none z-10">
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
        </div>

        {/* Floating Top-Right Phase Badges */}
        <div class="absolute top-6 right-6 flex items-center gap-2 pointer-events-none z-10">
          <Show when={activePlugin()?.targetPhase}>
            {(phase) => (
              <Badge
                variant="outline"
                class="font-mono text-[10px] px-2 py-0.5 backdrop-blur-md bg-accent-theme/15 text-accent-theme border-accent-theme/30"
              >
                Phase {phase()}
              </Badge>
            )}
          </Show>

          <Show when={activePlugin()?.targetScope}>
            {(scope) => (
              <Badge
                variant="outline"
                class="font-mono text-[10px] px-2 py-0.5 backdrop-blur-md bg-white/10 text-muted-foreground border-white/15"
              >
                Scope: {scope()}
              </Badge>
            )}
          </Show>
        </div>

        {/* Error Alert Overlay */}
        <Show when={state.telemetry.lastError}>
          {(err) => (
            <div class="absolute bottom-6 left-6 right-6 p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs backdrop-blur-md flex items-center gap-3 shadow-xl z-20">
              <AlertTriangle class="w-4 h-4 text-rose-400 shrink-0" />
              <div class="flex-1 truncate">
                <span class="font-bold">Render Exception: </span>
                <span>{err()}</span>
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* Bottom Transport Controls Bar */}
      <div class="px-5 py-3 border-t border-glass-border bg-glass-surface/80 backdrop-blur-md shrink-0 flex flex-col gap-2.5">
        {/* Scrubber Slider */}
        <div class="flex items-center gap-3">
          <Slider
            data-testid="playground-scrubber"
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

        {/* Buttons and Mode Selectors */}
        <div class="flex items-center justify-between gap-4">
          {/* Playback Controls */}
          <div class="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              class="h-8 px-2.5 gap-1.5 font-mono text-xs border-glass-border hover:bg-accent-theme/10 hover:text-accent-theme"
              onClick={props.engine.togglePlay}
              data-testid="playground-play-toggle"
            >
              {state.isPlaying ? <Pause class="w-3.5 h-3.5" /> : <Play class="w-3.5 h-3.5" />}
              <span>{state.isPlaying ? 'Pause' : 'Play'}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => props.engine.seek(state.currentFrame - 1)}
              title="Step -1 Frame (Left Arrow)"
            >
              <SkipBack class="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => props.engine.seek(state.currentFrame + 1)}
              title="Step +1 Frame (Right Arrow)"
            >
              <SkipForward class="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => props.engine.seek(0)}
              title="Return to Frame 0"
            >
              <RotateCcw class="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Speed & Aspect Ratio & Backdrop Selectors */}
          <div class="flex items-center gap-2">
            {/* Speed Selector */}
            <div class="flex items-center rounded-lg bg-black/20 p-0.5 border border-white/10 text-[11px] font-mono">
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

            {/* Aspect Ratio Selector */}
            <div class="flex items-center rounded-lg bg-black/20 p-0.5 border border-white/10 text-[11px] font-mono">
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

            {/* Backdrop Mode Selector */}
            <Select
              value={state.backdropMode}
              onChange={(val) => props.engine.setBackdropMode(val as BackdropMode)}
            >
              <SelectTrigger class="h-8 w-32 text-xs font-mono border-glass-border bg-glass-surface/60">
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
