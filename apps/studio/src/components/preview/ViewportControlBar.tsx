import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
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
  className?: string;
}

export const ViewportControlBar: React.FC<ViewportControlBarProps> = ({
  width,
  height,
  virtualWidth,
  virtualHeight,
  previewResolution = 'auto',
  onSetPreviewResolution,
  fps = 30,
  isPlaying,
  currentFrame,
  totalFrames,
  onTogglePlay,
  selectedSeqId,
  transform,
  activeGuides,
  zoomLevel,
  onSetZoomLevel,
  onResetPan,
  isPanToolActive,
  isSpacePressed,
  onTogglePanTool,
  safeGuidesMode,
  onCycleSafeGuides,
  showCheckerboard,
  onToggleCheckerboard,
  showVfxAmbiance,
  onToggleVfxAmbiance,
  visionPassMode = 'composite',
  onCycleVisionPass,
  showDepthHeatmap = false,
  onToggleDepthHeatmap,
  isTelemetryCompanionOpen,
  onToggleTelemetryCompanion,
  lod = 'full',
  className,
}) => {
  // Real hardware render FPS & latency telemetry from actual canvas completions
  const [liveFps, setLiveFps] = useState<number>(fps);
  const [frameLatency, setFrameLatency] = useState<number>(Math.round(1000 / fps * 10) / 10);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isPlaying) {
      setLiveFps(fps);
      setFrameLatency(Math.round(1000 / fps * 10) / 10);
      return;
    }

    return PlayheadController.getInstance().subscribeTelemetry((measuredFps, latencyMs) => {
      setLiveFps(measuredFps);
      setFrameLatency(latencyMs);
    });
  }, [isPlaying, fps]);

  const resolutionModes: PreviewResolutionMode[] = ['auto', 1.0, 0.5, 0.25];

  return (
    <div
      className={cn(
        "absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto transition-all max-w-[calc(100%-1.5rem)]",
        className
      )}
    >
      <div className="glass-panel px-3 py-1.5 rounded-full shadow-glass border border-glass-border flex items-center gap-1.5 sm:gap-2 select-none whitespace-nowrap">
        {/* 1. Canvas Resolution Badge */}
        <Tooltip
          content={`Active Preview Canvas Buffer: ${virtualWidth ?? width}×${virtualHeight ?? height} (Document Baseline: ${width}×${height})`}
        >
          <div className="glass-card px-2.5 py-1 rounded-full text-foreground/80 font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-glass-border shrink-0">
            <Monitor className="w-3 h-3 text-accent-theme" />
            <span>
              {lod === 'compact'
                ? `${virtualHeight ? `${virtualHeight}p` : `${height}p`}`
                : virtualWidth && virtualWidth !== width
                ? `${virtualWidth}×${virtualHeight}`
                : `${width}×${height}`}
            </span>
          </div>
        </Tooltip>

        {/* 2. Virtual Buffer Resolution Selector (Visible on medium & full, inside tools menu on compact) */}
        {lod !== 'compact' && onSetPreviewResolution && (
          <Tooltip content="Toggle Virtual Buffer Resolution: Auto (Dynamic) -> Full -> Half -> Quarter">
            <button
              type="button"
              onClick={() => {
                const currentIndex = resolutionModes.indexOf(previewResolution);
                const nextIndex = (currentIndex + 1) % resolutionModes.length;
                onSetPreviewResolution(resolutionModes[nextIndex]!);
              }}
              className="glass-card px-2.5 py-1 rounded-full font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-glass-border hover:border-accent-theme/50 transition-colors text-foreground/80 cursor-pointer shrink-0"
            >
              <Sliders className="w-2.5 h-2.5 text-accent-theme" />
              <span className="font-semibold">
                {previewResolution === 'auto'
                  ? `Auto (${virtualHeight ? `${virtualHeight}p` : '540p'})`
                  : previewResolution === 1.0
                  ? `Full (${height}p)`
                  : previewResolution === 0.5
                  ? `Half (${Math.round(height * 0.5)}p)`
                  : `Quarter (${Math.round(height * 0.25)}p)`}
              </span>
            </button>
          </Tooltip>
        )}

        {/* 3. GSAP Timeline Engine Badge (Full LOD only) */}
        {lod === 'full' && (
          <div className="glass-card px-2.5 py-1 rounded-full text-foreground/80 font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-glass-border shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-accent-theme animate-pulse" />
            GSAP Timeline Engine
          </div>
        )}

        {/* 4. Play/Idle State Indicator (Full LOD only) */}
        {lod === 'full' && (
          <div
            className={`glass-card px-2.5 py-1 rounded-full font-mono text-[10px] flex items-center gap-1.5 border shadow-xs transition-colors shrink-0 ${
              isPlaying
                ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'border-glass-border text-muted-foreground'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-muted-foreground/60'
              }`}
            />
            {isPlaying ? 'PLAYING' : 'IDLE'} [{currentFrame}/{totalFrames}]
          </div>
        )}

        {/* 5. Live Hardware Render FPS Badge */}
        <Tooltip content={`Measured Viewport Render FPS (${frameLatency.toFixed(1)}ms interval)`}>
          <div className="glass-card px-2.5 py-1 rounded-full font-mono text-[10px] flex items-center gap-1.5 border border-glass-border shadow-xs text-foreground/90 shrink-0">
            <Activity className="w-2.5 h-2.5 text-accent-theme" />
            <span
              className={`font-bold ${
                liveFps >= fps * 0.95
                  ? 'text-emerald-400'
                  : liveFps >= fps * 0.75
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {isPlaying
                ? `${liveFps.toFixed(lod === 'compact' ? 0 : 1)} FPS`
                : `${fps} FPS`}
            </span>
            {lod === 'full' && (
              <span className="text-[9px] text-muted-foreground font-mono">
                ({frameLatency.toFixed(1)}ms)
              </span>
            )}
          </div>
        </Tooltip>

        {/* 6. Play/Pause Viewport Transport Button */}
        {onTogglePlay && (
          <Tooltip content={isPlaying ? 'Pause Viewport (Space)' : 'Play Viewport (Space)'}>
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause Viewport' : 'Play Viewport'}
              aria-pressed={isPlaying}
              className={`glass-button px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border shrink-0 ${
                isPlaying
                  ? 'border-emerald-500/50 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'border-glass-border text-foreground/80 hover:text-foreground'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-2.5 h-2.5 fill-current" />
                  {lod !== 'compact' && <span className="font-bold tracking-wider">PAUSE</span>}
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  {lod !== 'compact' && <span className="font-bold tracking-wider">PLAY</span>}
                </>
              )}
            </button>
          </Tooltip>
        )}

        {/* Divider */}
        <div className="h-4 w-px bg-glass-border shrink-0 mx-0.5" />

        {/* 7. Active Transform Coordinates Readout (Strict fixed-width container with tabular numbers to prevent bar jitter) */}
        {lod === 'full' && (
          selectedSeqId ? (
            <Tooltip
              content={
                activeGuides.length > 0
                  ? `Transform: X: ${transform.x}px | Y: ${transform.y}px | Scale: ${transform.scale.toFixed(2)}x | Rotation: ${transform.rotation}° • Snap: ${activeGuides.map((g) => g.label).join(', ')}`
                  : `Transform: X: ${transform.x}px | Y: ${transform.y}px | Scale: ${transform.scale.toFixed(2)}x | Rotation: ${transform.rotation}°`
              }
            >
              <div className="glass-card px-2.5 py-1 rounded-full text-foreground/90 border border-accent-theme/40 font-mono text-[10px] flex items-center justify-between shadow-xs backdrop-blur-md w-[248px] shrink-0 select-none">
                <div className="flex items-center gap-1 shrink-0">
                  <Move className="w-3 h-3 text-accent-theme shrink-0" />
                  <span className="text-muted-foreground/70 text-[9px] font-medium">X</span>
                  <span className="tabular-nums font-mono w-[34px] text-right inline-block text-foreground">
                    {Math.round(transform.x)}
                  </span>
                </div>

                <div className="h-3 w-px bg-glass-border shrink-0" />

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground/70 text-[9px] font-medium">Y</span>
                  <span className="tabular-nums font-mono w-[34px] text-right inline-block text-foreground">
                    {Math.round(transform.y)}
                  </span>
                </div>

                <div className="h-3 w-px bg-glass-border shrink-0" />

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground/70 text-[9px] font-medium">S</span>
                  <span className="tabular-nums font-mono w-[30px] text-right inline-block text-foreground">
                    {transform.scale.toFixed(2)}
                  </span>
                </div>

                <div className="h-3 w-px bg-glass-border shrink-0" />

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground/70 text-[9px] font-medium">R</span>
                  <span className="tabular-nums font-mono w-[26px] text-right inline-block text-foreground">
                    {Math.round(transform.rotation)}°
                  </span>
                </div>

                <div
                  title={activeGuides.length > 0 ? `Snapping: ${activeGuides.map((g) => g.label).join(', ')}` : 'Snapping idle'}
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0 transition-colors ml-0.5",
                    activeGuides.length > 0 ? "bg-accent-theme shadow-accent-glow animate-pulse" : "bg-muted-foreground/20"
                  )}
                />
              </div>
            </Tooltip>
          ) : (
            <Tooltip content="No layer selected. Click a canvas element or timeline clip to view and edit transform coordinates.">
              <div className="glass-card px-2.5 py-1 rounded-full text-muted-foreground/50 border border-glass-border font-mono text-[10px] flex items-center justify-center gap-1.5 shadow-xs w-[248px] shrink-0 select-none">
                <Move className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                <span className="text-[10px] tracking-wide uppercase">No Layer Selected</span>
              </div>
            </Tooltip>
          )
        )}

        {/* 8. Zoom Presets Segmented Pill */}
        <div className="flex items-center gap-0.5 glass-card p-0.5 rounded-full border border-glass-border text-[10px] font-mono shrink-0">
          <Tooltip content="Fit Viewport">
            <button
              type="button"
              onClick={() => {
                onSetZoomLevel('fit');
                onResetPan();
              }}
              className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                zoomLevel === 'fit'
                  ? 'bg-accent-theme text-primary-foreground font-bold shadow-xs'
                  : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10'
              }`}
            >
              Fit
            </button>
          </Tooltip>
          {lod === 'full' && (
            <Tooltip content="Zoom 50%">
              <button
                type="button"
                onClick={() => onSetZoomLevel(0.5)}
                className={`px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  zoomLevel === 0.5
                    ? 'bg-accent-theme text-primary-foreground font-bold shadow-xs'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                50%
              </button>
            </Tooltip>
          )}
          {lod !== 'compact' && (
            <Tooltip content="Zoom 100%">
              <button
                type="button"
                onClick={() => onSetZoomLevel(1.0)}
                className={`px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  zoomLevel === 1.0
                    ? 'bg-accent-theme text-primary-foreground font-bold shadow-xs'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                100%
              </button>
            </Tooltip>
          )}
          {lod === 'full' && (
            <Tooltip content="Zoom 200%">
              <button
                type="button"
                onClick={() => onSetZoomLevel(2.0)}
                className={`px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  zoomLevel === 2.0
                    ? 'bg-accent-theme text-primary-foreground font-bold shadow-xs'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                200%
              </button>
            </Tooltip>
          )}
        </div>

        {/* 9. Medium & Full Tools Row */}
        {lod !== 'compact' && (
          <>
            <div className="h-4 w-px bg-glass-border shrink-0 mx-0.5" />

            {/* Pan Hand Tool */}
            <Tooltip content="Pan Hand Tool (Hold Space + Drag)">
              <button
                type="button"
                onClick={onTogglePanTool}
                aria-label="Pan hand tool"
                className={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                  isPanToolActive || isSpacePressed
                    ? 'border-accent-theme bg-accent-theme/20 text-accent-theme shadow-accent-glow'
                    : 'border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            {/* Safe Guides Cycle */}
            <Tooltip content={`Safe Guides: ${safeGuidesMode === 'none' ? 'Off' : safeGuidesMode} (Click to Cycle)`}>
              <button
                type="button"
                onClick={onCycleSafeGuides}
                aria-label={`Safe guides: ${safeGuidesMode === 'none' ? 'Off' : safeGuidesMode}`}
                className={`px-2 py-1 rounded-full border text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                  safeGuidesMode !== 'none'
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                    : 'border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                <Shield className="w-3 h-3 text-amber-400" />
                <span>{safeGuidesMode === 'none' ? 'Guides' : safeGuidesMode}</span>
              </button>
            </Tooltip>

            {/* Alpha Transparency Checkerboard */}
            <Tooltip content="Toggle Alpha Transparency Checkerboard">
              <button
                type="button"
                onClick={onToggleCheckerboard}
                aria-label="Toggle alpha transparency checkerboard"
                className={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                  showCheckerboard
                    ? 'border-accent-theme/50 bg-accent-theme/20 text-accent-theme shadow-accent-glow'
                    : 'border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            {/* Viewport Vision Pass Selector */}
            {onCycleVisionPass ? (
              <Tooltip content={`Vision Pass: ${visionPassMode.toUpperCase()} (Shift+V to Cycle)`}>
                <button
                  type="button"
                  onClick={onCycleVisionPass}
                  aria-label={`Vision pass mode: ${visionPassMode}`}
                  className={`px-2 py-1 rounded-full border text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                    visionPassMode !== 'composite'
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'border-glass-border text-foreground/60 hover:text-foreground hover:bg-foreground/10'
                  }`}
                >
                  <ScanEye className="w-3.5 h-3.5" />
                  {lod === 'full' && (
                    <span className="uppercase tracking-wider font-semibold">
                      {visionPassMode}
                    </span>
                  )}
                </button>
              </Tooltip>
            ) : (
              onToggleDepthHeatmap && (
                <Tooltip content={`Depth Disparity Heatmap: ${showDepthHeatmap ? 'Active' : 'Disabled'}`}>
                  <button
                    type="button"
                    onClick={onToggleDepthHeatmap}
                    aria-label={showDepthHeatmap ? 'Disable depth heatmap' : 'Enable depth heatmap'}
                    className={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                      showDepthHeatmap
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'border-glass-border text-foreground/40 hover:text-foreground hover:bg-foreground/10'
                    }`}
                  >
                    <ScanEye className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )
            )}
          </>
        )}

        {/* 10. Full LOD Auxiliary Badges & Toggles */}
        {lod === 'full' && (
          <>
            {/* VFX Ambiance */}
            <Tooltip content={`VFX Ambiance (HUD & Particles): ${showVfxAmbiance ? 'Enabled' : 'Disabled'}`}>
              <button
                type="button"
                onClick={onToggleVfxAmbiance}
                aria-label={showVfxAmbiance ? 'Disable VFX ambiance' : 'Enable VFX ambiance'}
                className={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                  showVfxAmbiance
                    ? 'border-accent-theme/50 bg-accent-theme/20 text-accent-theme shadow-accent-glow'
                    : 'border-glass-border text-foreground/40 hover:text-foreground hover:bg-foreground/10'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            {/* Telemetry Companion Card Toggle */}
            {onToggleTelemetryCompanion && (
              <Tooltip content={isTelemetryCompanionOpen ? 'Hide Telemetry' : 'Show Telemetry'}>
                <button
                  type="button"
                  onClick={onToggleTelemetryCompanion}
                  aria-label={isTelemetryCompanionOpen ? 'Hide Telemetry' : 'Show Telemetry'}
                  className={`p-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                    isTelemetryCompanionOpen
                      ? 'border-accent-theme bg-accent-theme/20 text-accent-theme shadow-accent-glow'
                      : 'border-glass-border text-foreground/40 hover:text-foreground hover:bg-foreground/10'
                  }`}
                >
                  <LayoutPanelTop className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            )}

            {/* Canvas Aspect Ratio Pill */}
            <div className="glass-card px-2.5 py-1 rounded-full text-muted-foreground font-mono text-[10px] flex items-center gap-1 border border-glass-border shrink-0">
              <Layers className="w-3 h-3 text-accent-theme" />
              16:9
            </div>
          </>
        )}

        {/* 11. Studio Tools Popover Menu (Houses collapsed controls for compact and medium tiers) */}
        {lod !== 'full' && (
          <>
            <div className="h-4 w-px bg-glass-border shrink-0 mx-0.5" />
            <Popover open={isToolsMenuOpen} onOpenChange={setIsToolsMenuOpen}>
              <Tooltip content="Viewport Options & Overlays">
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Viewport options and tools"
                    className="p-1.5 rounded-full border border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-all cursor-pointer shrink-0"
                  >
                    {lod === 'compact' ? (
                      <Sliders className="w-3.5 h-3.5 text-accent-theme" />
                    ) : (
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    )}
                  </button>
                </PopoverTrigger>
              </Tooltip>

              <PopoverContent
                align="center"
                sideOffset={8}
                className="w-64 p-3 rounded-2xl glass-panel shadow-glass border border-glass-border flex flex-col gap-2.5 text-xs select-none backdrop-blur-xl z-50"
              >
                <div className="flex items-center justify-between border-b border-glass-border pb-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-accent-theme" />
                    Viewport Options
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {width}×{height} (16:9)
                  </span>
                </div>

                {/* Buffer Resolution Selection */}
                {onSetPreviewResolution && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      Buffer Resolution
                    </span>
                    <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                      {resolutionModes.map((mode) => (
                        <button
                          key={String(mode)}
                          type="button"
                          onClick={() => {
                            onSetPreviewResolution(mode);
                          }}
                          className={`py-1 px-1 rounded-lg border transition-all cursor-pointer text-center ${
                            previewResolution === mode
                              ? 'border-accent-theme bg-accent-theme/20 text-accent-theme font-bold'
                              : 'border-glass-border text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                          }`}
                        >
                          {mode === 'auto' ? 'Auto' : `${Number(mode) * 100}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compact Tools Grid */}
                {lod === 'compact' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      Overlays & Tools
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {/* Pan Tool */}
                      <button
                        type="button"
                        onClick={onTogglePanTool}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          isPanToolActive || isSpacePressed
                            ? 'border-accent-theme bg-accent-theme/20 text-accent-theme font-semibold'
                            : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                        }`}
                      >
                        <Hand className="w-3.5 h-3.5" />
                        <span>Pan Hand</span>
                      </button>

                      {/* Safe Guides */}
                      <button
                        type="button"
                        onClick={onCycleSafeGuides}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          safeGuidesMode !== 'none'
                            ? 'border-amber-400/50 bg-amber-500/20 text-amber-400 font-semibold'
                            : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Guides: {safeGuidesMode === 'none' ? 'Off' : safeGuidesMode}</span>
                      </button>

                      {/* Checkerboard */}
                      <button
                        type="button"
                        onClick={onToggleCheckerboard}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          showCheckerboard
                            ? 'border-accent-theme bg-accent-theme/20 text-accent-theme font-semibold'
                            : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                        }`}
                      >
                        <Grid className="w-3.5 h-3.5" />
                        <span>Checkerboard</span>
                      </button>

                      {/* Vision Pass */}
                      {onCycleVisionPass && (
                        <button
                          type="button"
                          onClick={onCycleVisionPass}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                            visionPassMode !== 'composite'
                              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-semibold'
                              : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                          }`}
                        >
                          <ScanEye className="w-3.5 h-3.5" />
                          <span className="capitalize">{visionPassMode}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Display & Ambiance Toggles */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Display & Diagnostics
                  </span>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={onToggleVfxAmbiance}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        showVfxAmbiance
                          ? 'border-accent-theme/50 bg-accent-theme/10 text-accent-theme'
                          : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        VFX Ambiance Mesh
                      </span>
                      {showVfxAmbiance && <Check className="w-3 h-3" />}
                    </button>

                    {onToggleTelemetryCompanion && (
                      <button
                        type="button"
                        onClick={onToggleTelemetryCompanion}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          isTelemetryCompanionOpen
                            ? 'border-accent-theme bg-accent-theme/20 text-accent-theme font-semibold'
                            : 'border-glass-border text-foreground/80 hover:bg-foreground/5'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <LayoutPanelTop className="w-3.5 h-3.5" />
                          Telemetry Companion Card
                        </span>
                        {isTelemetryCompanionOpen && <Check className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Transform Summary (when sequence is selected) */}
                {selectedSeqId && (
                  <div className="p-2 rounded-xl bg-background/50 border border-glass-border font-mono text-[10px] text-foreground/80 flex flex-col gap-0.5">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1">
                      <Move className="w-3 h-3 text-accent-theme" />
                      Active Transform
                    </span>
                    <div>X: {transform.x}px | Y: {transform.y}px</div>
                    <div>Scale: {transform.scale.toFixed(2)}x | Rot: {transform.rotation}°</div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>
    </div>
  );
};
