import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { cn } from 'cn';
import {
  Monitor,
  Sparkles,
  Play,
  Pause,
  Move,
  Hand,
  Shield,
  Grid,
  Layers,
  LayoutPanelTop,
  ScanEye,
  Activity,
  Sliders,
  MoreHorizontal,
  Check,
} from 'lucide-solid';
import { Tooltip } from '../ui/tooltip';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '../ui/popover';
import { SnappingGuide } from '../../lib/gizmo';
import { PlayheadController } from '../../lib/playhead/PlayheadController';
import type { PreviewLOD } from './useContainerLOD';

export type PreviewResolutionMode = 'auto' | 1.0 | 0.5 | 0.25;

export interface ViewportControlBarProps {
  width: number;
  height: number;
  virtualWidth?: number;
  virtualHeight?: number;
  previewResolution?: PreviewResolutionMode;
  onSetPreviewResolution?: (res: PreviewResolutionMode) => void;
  fps?: number;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  onTogglePlay?: () => void;
  selectedSeqId: string | null;
  transform: { x: number; y: number; scale: number; rotation: number };
  activeGuides: SnappingGuide[];
  zoomLevel: 'fit' | 0.5 | 1.0 | 2.0;
  onSetZoomLevel: (zoom: 'fit' | 0.5 | 1.0 | 2.0) => void;
  onResetPan: () => void;
  isPanToolActive: boolean;
  isSpacePressed: boolean;
  onTogglePanTool: () => void;
  safeGuidesMode: 'none' | '16:9' | '9:16';
  onCycleSafeGuides: () => void;
  showCheckerboard: boolean;
  onToggleCheckerboard: () => void;
  showVfxAmbiance: boolean;
  onToggleVfxAmbiance: () => void;
  visionPassMode?: 'composite' | 'depth' | 'normals' | 'alpha';
  onCycleVisionPass?: () => void;
  showDepthHeatmap?: boolean;
  onToggleDepthHeatmap?: () => void;
  isTelemetryCompanionOpen?: boolean;
  onToggleTelemetryCompanion?: () => void;
  lod?: PreviewLOD;
  class?: string;
  className?: string;
}

export function ViewportControlBar(props: ViewportControlBarProps) {
  const fps = () => props.fps ?? 30;
  const lod = () => props.lod ?? 'full'; // lod = 'full' lod === 'compact' lod === 'full' lod !== 'full'
  const previewResolution = () => props.previewResolution ?? 'auto';

  // Real hardware render FPS & latency telemetry from actual canvas completions
  const [liveFps, setLiveFps] = createSignal<number>(fps());
  const [frameLatency, setFrameLatency] = createSignal<number>(Math.round(1000 / fps() * 10) / 10);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = createSignal(false);

  createEffect(() => {
    if (!props.isPlaying) {
      setLiveFps(fps());
      setFrameLatency(Math.round(1000 / fps() * 10) / 10);
      return;
    }

    const unsub = PlayheadController.getInstance().subscribeTelemetry((measuredFps, latencyMs) => {
      setLiveFps(measuredFps);
      setFrameLatency(latencyMs);
    });
    onCleanup(unsub);
  });

  const resolutionModes: PreviewResolutionMode[] = ['auto', 1.0, 0.5, 0.25];

  return (
    <div
      class={cn(
        "absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto transition-all max-w-[calc(100%-1.5rem)]",
        props.class || props.className
      )}
    >
      <div class="glass-panel px-3 py-1.5 rounded-full shadow-glass border border-glass-border flex items-center gap-1.5 sm:gap-2 select-none whitespace-nowrap">
        {/* 1. Canvas Resolution Badge */}
        <Tooltip
          content={`Active Preview Canvas Buffer: ${props.virtualWidth ?? props.width}×${props.virtualHeight ?? props.height} (Document Baseline: ${props.width}×${props.height})`}
        >
          <div class="glass-card px-2.5 py-1 rounded-full text-foreground/80 font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-glass-border shrink-0">
            <Monitor class="w-3 h-3 text-accent-theme" />
            <span>
              {lod() === 'compact'
                ? `${props.virtualHeight ? `${props.virtualHeight}p` : `${props.height}p`}`
                : props.virtualWidth && props.virtualWidth !== props.width
                ? `${props.virtualWidth}×${props.virtualHeight}`
                : `${props.width}×${props.height}`}
            </span>
          </div>
        </Tooltip>

        {/* 2. Virtual Buffer Resolution Selector */}
        <Show when={lod() !== 'compact' && props.onSetPreviewResolution}>
          <Tooltip content="Toggle Virtual Buffer Resolution: Auto (Dynamic) -> Full -> Half -> Quarter">
            <button
              type="button"
              onClick={() => {
                const currentIndex = resolutionModes.indexOf(previewResolution());
                const nextIndex = (currentIndex + 1) % resolutionModes.length;
                props.onSetPreviewResolution!(resolutionModes[nextIndex]!);
              }}
              class="glass-card px-2.5 py-1 rounded-full font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-glass-border hover:border-accent-theme/50 transition-colors text-foreground/80 cursor-pointer shrink-0"
            >
              <Sliders class="w-2.5 h-2.5 text-accent-theme" />
              <span class="font-semibold">
                {previewResolution() === 'auto'
                  ? `Auto (${props.virtualHeight ? `${props.virtualHeight}p` : '540p'})`
                  : previewResolution() === 1.0
                  ? `Full (${props.height}p)`
                  : previewResolution() === 0.5
                  ? `Half (${Math.round(props.height * 0.5)}p)`
                  : `Quarter (${Math.round(props.height * 0.25)}p)`}
              </span>
            </button>
          </Tooltip>
        </Show>

        {/* 3. GSAP Timeline Engine Badge (Full LOD only) */}
        <Show when={lod() === 'full'}>
          <div class="glass-card px-2.5 py-1 rounded-full text-foreground/80 font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-glass-border shrink-0">
            <Sparkles class="w-2.5 h-2.5 text-accent-theme animate-pulse" />
            GSAP Timeline Engine
          </div>
        </Show>

        {/* 4. Play/Idle State Indicator (Full LOD only) */}
        <Show when={lod() === 'full'}>
          <div
            class={`glass-card px-2.5 py-1 rounded-full font-mono text-[10px] flex items-center gap-1.5 border shadow-xs transition-colors shrink-0 ${
              props.isPlaying
                ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'border-glass-border text-muted-foreground'
            }`}
          >
            <span
              class={`w-1.5 h-1.5 rounded-full ${
                props.isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-muted-foreground/60'
              }`}
            />
            {props.isPlaying ? 'PLAYING' : 'IDLE'} [{props.currentFrame}/{props.totalFrames}]
          </div>
        </Show>

        {/* 5. Live Hardware Render FPS Badge */}
        <Tooltip content={`Measured Viewport Render FPS (${frameLatency().toFixed(1)}ms interval)`}>
          <div class="glass-card px-2.5 py-1 rounded-full font-mono text-[10px] flex items-center gap-1.5 border border-glass-border shadow-xs text-foreground/90 shrink-0">
            <Activity class="w-2.5 h-2.5 text-accent-theme" />
            <span
              class={`font-bold ${
                liveFps() >= fps() * 0.95
                  ? 'text-emerald-400'
                  : liveFps() >= fps() * 0.75
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {props.isPlaying
                ? `${liveFps().toFixed(lod() === 'compact' ? 0 : 1)} FPS`
                : `${fps()} FPS`}
            </span>
            <Show when={lod() === 'full'}>
              <span class="text-[9px] text-muted-foreground font-mono">
                ({frameLatency().toFixed(1)}ms)
              </span>
            </Show>
          </div>
        </Tooltip>

        {/* 6. Play/Pause Viewport Transport Button */}
        <Show when={props.onTogglePlay}>
          <Tooltip content={props.isPlaying ? 'Pause Viewport (Space)' : 'Play Viewport (Space)'}>
            <button
              type="button"
              onClick={props.onTogglePlay}
              aria-label={props.isPlaying ? 'Pause Viewport' : 'Play Viewport'}
              aria-pressed={props.isPlaying}
              class={`glass-button px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border shrink-0 ${
                props.isPlaying
                  ? 'border-emerald-500/50 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'border-glass-border text-foreground/80 hover:text-foreground'
              }`}
            >
              <Show
                when={props.isPlaying}
                fallback={
                  <>
                    <Play class="w-2.5 h-2.5 fill-current" />
                    <Show when={lod() !== 'compact'}>
                      <span class="font-bold tracking-wider">PLAY</span>
                    </Show>
                  </>
                }
              >
                <Pause class="w-2.5 h-2.5 fill-current" />
                <Show when={lod() !== 'compact'}>
                  <span class="font-bold tracking-wider">PAUSE</span>
                </Show>
              </Show>
            </button>
          </Tooltip>
        </Show>

        {/* Divider */}
        <div class="h-4 w-px bg-glass-border shrink-0 mx-0.5" />

        {/* 7. Active Transform Coordinates Readout */}
        <Show when={lod() === 'full'}>
          <Show
            when={props.selectedSeqId}
            fallback={
              <Tooltip content="No layer selected. Click a canvas element or timeline clip to view and edit transform coordinates.">
                <div class="glass-card px-2.5 py-1 rounded-full text-muted-foreground/50 border border-glass-border font-mono text-[10px] flex items-center justify-center gap-1.5 shadow-xs w-[248px] shrink-0 select-none">
                  <Move class="w-3 h-3 text-muted-foreground/30 shrink-0" />
                  <span class="text-[10px] tracking-wide uppercase">No Layer Selected</span>
                </div>
              </Tooltip>
            }
          >
            <Tooltip
              content={
                props.activeGuides.length > 0
                  ? `Transform: X: ${props.transform.x}px | Y: ${props.transform.y}px | Scale: ${props.transform.scale.toFixed(2)}x | Rotation: ${props.transform.rotation}° • Snap: ${props.activeGuides.map((g) => g.label).join(', ')}`
                  : `Transform: X: ${props.transform.x}px | Y: ${props.transform.y}px | Scale: ${props.transform.scale.toFixed(2)}x | Rotation: ${props.transform.rotation}°`
              }
            >
              <div class="glass-card px-2.5 py-1 rounded-full text-foreground/90 border border-accent-theme/40 font-mono text-[10px] flex items-center justify-between shadow-xs backdrop-blur-md w-[248px] shrink-0 select-none">
                <div class="flex items-center gap-1 shrink-0">
                  <Move class="w-3 h-3 text-accent-theme shrink-0" />
                  <span class="text-muted-foreground/70 text-[9px] font-medium">X</span>
                  <span class="tabular-nums font-mono w-[34px] text-right inline-block text-foreground">
                    {Math.round(props.transform.x)}
                  </span>
                </div>

                <div class="h-3 w-px bg-glass-border shrink-0" />

                <div class="flex items-center gap-1 shrink-0">
                  <span class="text-muted-foreground/70 text-[9px] font-medium">Y</span>
                  <span class="tabular-nums font-mono w-[34px] text-right inline-block text-foreground">
                    {Math.round(props.transform.y)}
                  </span>
                </div>

                <div class="h-3 w-px bg-glass-border shrink-0" />

                <div class="flex items-center gap-1 shrink-0">
                  <span class="text-muted-foreground/70 text-[9px] font-medium">S</span>
                  <span class="tabular-nums font-mono w-[30px] text-right inline-block text-foreground">
                    {props.transform.scale.toFixed(2)}
                  </span>
                </div>

                <div class="h-3 w-px bg-glass-border shrink-0" />

                <div class="flex items-center gap-1 shrink-0">
                  <span class="text-muted-foreground/70 text-[9px] font-medium">R</span>
                  <span class="tabular-nums font-mono w-[26px] text-right inline-block text-foreground">
                    {Math.round(props.transform.rotation)}°
                  </span>
                </div>

                <div
                  title={props.activeGuides.length > 0 ? `Snapping: ${props.activeGuides.map((g) => g.label).join(', ')}` : 'Snapping idle'}
                  class={cn(
                    "w-2 h-2 rounded-full shrink-0 transition-colors ml-0.5",
                    props.activeGuides.length > 0 ? "bg-accent-theme shadow-accent-glow animate-pulse" : "bg-muted-foreground/20"
                  )}
                />
              </div>
            </Tooltip>
          </Show>
        </Show>

        {/* 8. Zoom Presets Segmented Pill */}
        <div class="flex items-center gap-0.5 glass-card p-0.5 rounded-full border border-glass-border text-[10px] font-mono shrink-0">
          <Tooltip content="Fit Viewport">
            <button
              type="button"
              onClick={() => {
                props.onSetZoomLevel('fit');
                props.onResetPan();
              }}
              class={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                props.zoomLevel === 'fit'
                  ? 'bg-accent-theme text-primary-foreground font-bold shadow-xs'
                  : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10'
              }`}
            >
              Fit
            </button>
          </Tooltip>
          <Show when={lod() === 'full'}>
            <Tooltip content="Zoom 50%">
              <button
                type="button"
                onClick={() => props.onSetZoomLevel(0.5)}
                class={`px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  props.zoomLevel === 0.5
                    ? 'bg-accent-theme text-primary-foreground font-bold shadow-xs'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                50%
              </button>
            </Tooltip>
          </Show>
          <Show when={lod() !== 'compact'}>
            <Tooltip content="Zoom 100%">
              <button
                type="button"
                onClick={() => props.onSetZoomLevel(1.0)}
                class={`px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  props.zoomLevel === 1.0
                    ? 'bg-accent-theme text-primary-foreground font-bold shadow-xs'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                100%
              </button>
            </Tooltip>
          </Show>
          <Show when={lod() === 'full'}>
            <Tooltip content="Zoom 200%">
              <button
                type="button"
                onClick={() => props.onSetZoomLevel(2.0)}
                class={`px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  props.zoomLevel === 2.0
                    ? 'bg-accent-theme text-primary-foreground font-bold shadow-xs'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                200%
              </button>
            </Tooltip>
          </Show>
        </div>

        {/* 9. Medium & Full Tools Row */}
        <Show when={lod() !== 'compact'}>
          <div class="h-4 w-px bg-glass-border shrink-0 mx-0.5" />

          {/* Pan Hand Tool */}
          <Tooltip content="Pan Hand Tool (Hold Space + Drag)">
            <button
              type="button"
              onClick={props.onTogglePanTool}
              aria-label="Pan hand tool"
              class={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                props.isPanToolActive || props.isSpacePressed
                  ? 'border-accent-theme bg-accent-theme/20 text-accent-theme shadow-accent-glow'
                  : 'border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/10'
              }`}
            >
              <Hand class="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {/* Safe Guides Cycle */}
          <Tooltip content={`Safe Guides: ${props.safeGuidesMode === 'none' ? 'Off' : props.safeGuidesMode} (Click to Cycle)`}>
            <button
              type="button"
              onClick={props.onCycleSafeGuides}
              aria-label={`Safe guides: ${props.safeGuidesMode === 'none' ? 'Off' : props.safeGuidesMode}`}
              class={`px-2 py-1 rounded-full border text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                props.safeGuidesMode !== 'none'
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                  : 'border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/10'
              }`}
            >
              <Shield class="w-3 h-3 text-amber-400" />
              <span>{props.safeGuidesMode === 'none' ? 'Guides' : props.safeGuidesMode}</span>
            </button>
          </Tooltip>

          {/* Alpha Transparency Checkerboard */}
          <Tooltip content="Toggle Alpha Transparency Checkerboard">
            <button
              type="button"
              onClick={props.onToggleCheckerboard}
              aria-label="Toggle alpha transparency checkerboard"
              class={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                props.showCheckerboard
                  ? 'border-accent-theme/50 bg-accent-theme/20 text-accent-theme shadow-accent-glow'
                  : 'border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/10'
              }`}
            >
              <Grid class="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {/* Viewport Vision Pass Selector */}
          <Show
            when={props.onCycleVisionPass}
            fallback={
              <Show when={props.onToggleDepthHeatmap}>
                <Tooltip content={`Depth Disparity Heatmap: ${props.showDepthHeatmap ? 'Active' : 'Disabled'}`}>
                  <button
                    type="button"
                    onClick={props.onToggleDepthHeatmap}
                    aria-label={props.showDepthHeatmap ? 'Disable depth heatmap' : 'Enable depth heatmap'}
                    class={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                      props.showDepthHeatmap
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'border-glass-border text-foreground/40 hover:text-foreground hover:bg-foreground/10'
                    }`}
                  >
                    <ScanEye class="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </Show>
            }
          >
            <Tooltip content={`Vision Pass: ${(props.visionPassMode || 'composite').toUpperCase()} (Shift+V to Cycle)`}>
              <button
                type="button"
                onClick={props.onCycleVisionPass}
                aria-label={`Vision pass mode: ${props.visionPassMode || 'composite'}`}
                class={`px-2 py-1 rounded-full border text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                  props.visionPassMode !== 'composite'
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                    : 'border-glass-border text-foreground/60 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                <ScanEye class="w-3.5 h-3.5" />
                <Show when={lod() === 'full'}>
                  <span class="uppercase tracking-wider font-semibold">
                    {props.visionPassMode || 'composite'}
                  </span>
                </Show>
              </button>
            </Tooltip>
          </Show>
        </Show>

        {/* 10. Full LOD Auxiliary Badges & Toggles */}
        <Show when={lod() === 'full'}>
          {/* VFX Ambiance */}
          <Tooltip content={`VFX Ambiance (HUD & Particles): ${props.showVfxAmbiance ? 'Enabled' : 'Disabled'}`}>
            <button
              type="button"
              onClick={props.onToggleVfxAmbiance}
              aria-label={props.showVfxAmbiance ? 'Disable VFX ambiance' : 'Enable VFX ambiance'}
              class={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                props.showVfxAmbiance
                  ? 'border-accent-theme/50 bg-accent-theme/20 text-accent-theme shadow-accent-glow'
                  : 'border-glass-border text-foreground/40 hover:text-foreground hover:bg-foreground/10'
              }`}
            >
              <Sparkles class="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {/* Telemetry Companion Card Toggle */}
          <Show when={props.onToggleTelemetryCompanion}>
            <Tooltip content={props.isTelemetryCompanionOpen ? 'Hide Telemetry' : 'Show Telemetry'}>
              <button
                type="button"
                onClick={props.onToggleTelemetryCompanion}
                aria-label={props.isTelemetryCompanionOpen ? 'Hide Telemetry' : 'Show Telemetry'}
                class={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                  props.isTelemetryCompanionOpen
                    ? 'border-accent-theme bg-accent-theme/20 text-accent-theme shadow-accent-glow'
                    : 'border-glass-border text-foreground/40 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                <LayoutPanelTop class="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </Show>

          {/* Canvas Aspect Ratio Pill */}
          <div class="glass-card px-2.5 py-1 rounded-full text-muted-foreground font-mono text-[10px] flex items-center gap-1 border border-glass-border shrink-0">
            <Layers class="w-3 h-3 text-accent-theme" />
            16:9
          </div>
        </Show>

        {/* 11. Studio Tools Popover Menu */}
        <Show when={lod() !== 'full'}>
          <div class="h-4 w-px bg-glass-border shrink-0 mx-0.5" />
          <Popover open={isToolsMenuOpen()} onOpenChange={setIsToolsMenuOpen}>
            <Tooltip content="Viewport Options & Overlays">
              <PopoverTrigger
                type="button"
                aria-label="Viewport options and tools"
                class="p-1.5 rounded-full border border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-all cursor-pointer shrink-0"
              >
                <Show
                  when={lod() === 'compact'}
                  fallback={<MoreHorizontal class="w-3.5 h-3.5" />}
                >
                  <Sliders class="w-3.5 h-3.5 text-accent-theme" />
                </Show>
              </PopoverTrigger>
            </Tooltip>

            <PopoverContent
              align="center"
              sideOffset={8}
              class="w-64 p-3 rounded-2xl glass-panel shadow-glass border border-glass-border flex flex-col gap-2.5 text-xs select-none backdrop-blur-xl z-50"
            >
              <div class="flex items-center justify-between border-b border-glass-border pb-1.5">
                <span class="font-semibold text-foreground flex items-center gap-1.5">
                  <Monitor class="w-3.5 h-3.5 text-accent-theme" />
                  Viewport Options
                </span>
                <span class="text-[10px] font-mono text-muted-foreground">
                  {props.width}×{props.height} (16:9)
                </span>
              </div>

              {/* Buffer Resolution Selection */}
              <Show when={props.onSetPreviewResolution}>
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Buffer Resolution
                  </span>
                  <div class="grid grid-cols-4 gap-1 font-mono text-[10px]">
                    <For each={resolutionModes}>
                      {(mode) => (
                        <button
                          type="button"
                          onClick={() => {
                            props.onSetPreviewResolution!(mode);
                          }}
                          class={`py-1 px-1 rounded-lg border transition-all cursor-pointer text-center ${
                            previewResolution() === mode
                              ? 'border-accent-theme bg-accent-theme/20 text-accent-theme font-bold'
                              : 'border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                          }`}
                        >
                          {mode === 'auto' ? 'Auto' : `${Number(mode) * 100}%`}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Compact Tools Grid */}
              <Show when={lod() === 'compact'}>
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Overlays & Tools
                  </span>
                  <div class="grid grid-cols-2 gap-1.5 text-[11px]">
                    {/* Pan Tool */}
                    <button
                      type="button"
                      onClick={props.onTogglePanTool}
                      class={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        props.isPanToolActive || props.isSpacePressed
                          ? 'border-accent-theme bg-accent-theme/20 text-accent-theme font-semibold'
                          : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                      }`}
                    >
                      <Hand class="w-3.5 h-3.5" />
                      <span>Pan Hand</span>
                    </button>

                    {/* Safe Guides */}
                    <button
                      type="button"
                      onClick={props.onCycleSafeGuides}
                      class={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        props.safeGuidesMode !== 'none'
                          ? 'border-amber-400/50 bg-amber-500/20 text-amber-400 font-semibold'
                          : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                      }`}
                    >
                      <Shield class="w-3.5 h-3.5" />
                      <span>Guides: {props.safeGuidesMode === 'none' ? 'Off' : props.safeGuidesMode}</span>
                    </button>

                    {/* Checkerboard */}
                    <button
                      type="button"
                      onClick={props.onToggleCheckerboard}
                      class={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        props.showCheckerboard
                          ? 'border-accent-theme bg-accent-theme/20 text-accent-theme font-semibold'
                          : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                      }`}
                    >
                      <Grid class="w-3.5 h-3.5" />
                      <span>Checkerboard</span>
                    </button>

                    {/* Vision Pass */}
                    <Show when={props.onCycleVisionPass}>
                      <button
                        type="button"
                        onClick={props.onCycleVisionPass}
                        class={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          props.visionPassMode !== 'composite'
                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-semibold'
                            : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                        }`}
                      >
                        <ScanEye class="w-3.5 h-3.5" />
                        <span class="capitalize">{props.visionPassMode || 'composite'}</span>
                      </button>
                    </Show>
                  </div>
                </div>
              </Show>

              {/* Display & Ambiance Toggles */}
              <div class="flex flex-col gap-1">
                <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Display & Diagnostics
                </span>
                <div class="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={props.onToggleVfxAmbiance}
                    class={`flex items-center justify-between px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      props.showVfxAmbiance
                        ? 'border-accent-theme/50 bg-accent-theme/10 text-accent-theme'
                        : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                    }`}
                  >
                    <span class="flex items-center gap-1.5">
                      <Sparkles class="w-3.5 h-3.5" />
                      VFX Ambiance Mesh
                    </span>
                    <Show when={props.showVfxAmbiance}>
                      <Check class="w-3 h-3" />
                    </Show>
                  </button>

                  <Show when={props.onToggleTelemetryCompanion}>
                    <button
                      type="button"
                      onClick={props.onToggleTelemetryCompanion}
                      class={`flex items-center justify-between px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        props.isTelemetryCompanionOpen
                          ? 'border-accent-theme bg-accent-theme/20 text-accent-theme font-semibold'
                          : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                      }`}
                    >
                      <span class="flex items-center gap-1.5">
                        <LayoutPanelTop class="w-3.5 h-3.5" />
                        Telemetry Companion Card
                      </span>
                      <Show when={props.isTelemetryCompanionOpen}>
                        <Check class="w-3 h-3" />
                      </Show>
                    </button>
                  </Show>
                </div>
              </div>

              {/* Transform Summary (when sequence is selected) */}
              <Show when={props.selectedSeqId}>
                <div class="p-2 rounded-xl bg-background/50 border border-glass-border font-mono text-[10px] text-foreground/80 flex flex-col gap-0.5">
                  <span class="text-muted-foreground font-semibold flex items-center gap-1">
                    <Move class="w-3 h-3 text-accent-theme" />
                    Active Transform
                  </span>
                  <div>X: {props.transform.x}px | Y: {props.transform.y}px</div>
                  <div>Scale: {props.transform.scale.toFixed(2)}x | Rot: {props.transform.rotation}°</div>
                </div>
              </Show>
            </PopoverContent>
          </Popover>
        </Show>
      </div>
    </div>
  );
}
