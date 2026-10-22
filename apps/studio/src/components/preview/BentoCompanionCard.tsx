import React from 'react';
import {
  Monitor,
  Activity,
  Layers,
  Sparkles,
  Gauge,
  Clock,
  Sliders,
} from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

export interface BentoCompanionCardProps {
  width: number;
  height: number;
  fps: number;
  currentFrame: number;
  totalFrames: number;
  trackCount: number;
  activeSequenceCount: number;
  selectedSeqId: string | null;
  safeGuidesMode: 'none' | '16:9' | '9:16';
  onCycleSafeGuides: () => void;
  showCheckerboard: boolean;
  onToggleCheckerboard: () => void;
  showVfxAmbiance: boolean;
  onToggleVfxAmbiance: () => void;
  zoomLevel: 'fit' | 0.5 | 1.0 | 2.0;
  onSetZoomLevel: (zoom: 'fit' | 0.5 | 1.0 | 2.0) => void;
}

export const BentoCompanionCard: React.FC<BentoCompanionCardProps> = ({
  width,
  height,
  fps,
  currentFrame,
  totalFrames,
  trackCount,
  activeSequenceCount,
  selectedSeqId,
  safeGuidesMode,
  onCycleSafeGuides,
  showCheckerboard,
  onToggleCheckerboard,
  showVfxAmbiance,
  onToggleVfxAmbiance,
  zoomLevel,
  onSetZoomLevel,
}) => {
  const currentSec = (currentFrame / Math.max(1, fps)).toFixed(2);
  const totalSec = (totalFrames / Math.max(1, fps)).toFixed(2);

  return (
    <div className="flex flex-col gap-2 w-full select-none text-xs font-mono">
      {/* 1. Scene & Engine Telemetry Card */}
      <div className="glass-card rounded-xl p-3 border border-glass-border bg-glass-surface/80 backdrop-blur-md shadow-sm space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-glass-border pb-1.5 font-semibold">
          <span className="flex items-center gap-1.5 text-foreground">
            <Activity className="w-3.5 h-3.5 text-accent-theme" />
            Bento Telemetry
          </span>
          <span className="text-[10px] text-accent-theme bg-accent-theme/10 px-1.5 py-0.5 rounded border border-accent-theme/20">
            {fps} FPS
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
            <span className="text-muted-foreground text-[9px]">CANVAS SIZE</span>
            <span className="font-semibold text-foreground truncate">{width}×{height}</span>
          </div>

          <div className="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
            <span className="text-muted-foreground text-[9px]">TIMELINE</span>
            <span className="font-semibold text-foreground truncate">{currentSec}s / {totalSec}s</span>
          </div>

          <div className="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
            <span className="text-muted-foreground text-[9px]">ACTIVE TRACKS</span>
            <span className="font-semibold text-foreground">{trackCount} tracks</span>
          </div>

          <div className="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
            <span className="text-muted-foreground text-[9px]">ACTIVE CLIPS</span>
            <span className="font-semibold text-accent-theme">{activeSequenceCount} rendering</span>
          </div>
        </div>
      </div>

      {/* 2. Format, Safe Guides & Viewport Quick Switches */}
      <div className="glass-card rounded-xl p-3 border border-glass-border bg-glass-surface/80 backdrop-blur-md shadow-sm space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-glass-border pb-1.5 font-semibold">
          <span className="flex items-center gap-1.5 text-foreground">
            <Sliders className="w-3.5 h-3.5 text-accent-theme" />
            Viewport Helpers
          </span>
          <span className="text-[10px] text-muted-foreground">
            {zoomLevel === 'fit' ? 'Auto Fit' : `${Math.round(zoomLevel * 100)}%`}
          </span>
        </div>

        <div className="flex items-center justify-between gap-1 text-[10px]">
          {/* Safe Guides Toggle */}
          <Tooltip content={`Safe Guides: ${safeGuidesMode === 'none' ? 'Off' : safeGuidesMode}`}>
            <button
              type="button"
              onClick={onCycleSafeGuides}
              className={`flex-1 py-1 px-1.5 rounded border text-center transition-all cursor-pointer ${
                safeGuidesMode !== 'none'
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-400 font-semibold'
                  : 'border-glass-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {safeGuidesMode === 'none' ? 'Guides Off' : safeGuidesMode}
            </button>
          </Tooltip>

          {/* Checkerboard Toggle */}
          <Tooltip content="Alpha Transparency Checkerboard">
            <button
              type="button"
              onClick={onToggleCheckerboard}
              className={`flex-1 py-1 px-1.5 rounded border text-center transition-all cursor-pointer ${
                showCheckerboard
                  ? 'border-accent-theme/50 bg-accent-theme/15 text-accent-theme font-semibold'
                  : 'border-glass-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              Alpha BG
            </button>
          </Tooltip>

          {/* VFX Ambiance Toggle */}
          <Tooltip content="VFX Particle Ambiance & Holographic HUD">
            <button
              type="button"
              onClick={onToggleVfxAmbiance}
              className={`flex-1 py-1 px-1.5 rounded border text-center transition-all cursor-pointer ${
                showVfxAmbiance
                  ? 'border-accent-theme/50 bg-accent-theme/15 text-accent-theme font-semibold'
                  : 'border-glass-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              VFX HUD
            </button>
          </Tooltip>
        </div>

        {/* Selected Sequence Status Pill */}
        {selectedSeqId && (
          <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="truncate max-w-[120px]">Target: {selectedSeqId}</span>
            <span className="text-[9px] text-accent-theme font-bold">READY</span>
          </div>
        )}
      </div>
    </div>
  );
};
