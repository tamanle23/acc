import React from 'react';
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
} from 'lucide-react';
import { Tooltip } from '../ui/tooltip';
import { SnappingGuide } from '../../lib/gizmo';

export interface ViewportControlBarProps {
  width: number;
  height: number;
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
  isBentoOpen?: boolean;
  onToggleBento?: () => void;
}

export const ViewportControlBar: React.FC<ViewportControlBarProps> = ({
  width,
  height,
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
  isBentoOpen,
  onToggleBento,
}) => {
  return (
    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
      <div className="flex items-center gap-2">
        <div className="glass-card px-2.5 py-1 rounded-full text-foreground/80 font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-[var(--glass-border)]">
          <Monitor className="w-3 h-3 text-[var(--accent-primary)]" />
          {width}×{height}
        </div>

        <div className="glass-card px-2.5 py-1 rounded-full text-foreground/80 font-mono text-[10px] flex items-center gap-1.5 shadow-xs border border-[var(--glass-border)]">
          <Sparkles className="w-2.5 h-2.5 text-[var(--accent-primary)] animate-pulse" />
          GSAP Timeline Engine
        </div>

        <div
          className={`glass-card px-2.5 py-1 rounded-full font-mono text-[10px] flex items-center gap-1.5 border shadow-xs transition-colors ${isPlaying
            ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
            : 'border-[var(--glass-border)] text-muted-foreground'
            }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-muted-foreground/60'
              }`}
          />
          {isPlaying ? 'PLAYING' : 'IDLE'} [{currentFrame}/{totalFrames}]
        </div>

        {onTogglePlay && (
          <Tooltip content={isPlaying ? 'Pause Viewport (Space)' : 'Play Viewport (Space)'}>
            <button
              type="button"
              onClick={onTogglePlay}
              className={`glass-button px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5 cursor-pointer pointer-events-auto transition-all active:scale-95 border ${isPlaying
                ? 'border-emerald-500/50 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'border-[var(--glass-border)] text-foreground/80 hover:text-foreground'
                }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-2.5 h-2.5 fill-current" />
                  <span className="font-bold tracking-wider">PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span className="font-bold tracking-wider">PLAY</span>
                </>
              )}
            </button>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Active Transform Coordinates Readout */}
        {selectedSeqId && (
          <div className="glass-card px-3 py-1 rounded-full text-foreground/90 border border-[var(--accent-primary)]/40 font-mono text-[10px] flex items-center gap-1.5 shadow-xs backdrop-blur-md">
            <Move className="w-3 h-3 text-[var(--accent-primary)]" />
            X: {transform.x}px | Y: {transform.y}px | S: {transform.scale.toFixed(2)}x | R: {transform.rotation}°
            {activeGuides.length > 0 && (
              <span className="text-[var(--accent-primary)] font-semibold ml-1">
                [Snap: {activeGuides.map((g) => g.label).join(', ')}]
              </span>
            )}
          </div>
        )}

        {/* Zoom Presets Segmented Pill */}
        <div className="flex items-center gap-0.5 glass-card p-0.5 rounded-full border border-[var(--glass-border)] text-[10px] font-mono">
          <Tooltip content="Fit Viewport">
            <button
              type="button"
              onClick={() => {
                onSetZoomLevel('fit');
                onResetPan();
              }}
              className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${zoomLevel === 'fit'
                ? 'bg-[var(--accent-primary)] text-slate-950 font-bold shadow-xs'
                : 'text-foreground/70 hover:text-foreground hover:bg-white/10'
                }`}
            >
              Fit
            </button>
          </Tooltip>
          <Tooltip content="Zoom 50%">
            <button
              type="button"
              onClick={() => onSetZoomLevel(0.5)}
              className={`px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${zoomLevel === 0.5
                ? 'bg-[var(--accent-primary)] text-slate-950 font-bold shadow-xs'
                : 'text-foreground/70 hover:text-foreground hover:bg-white/10'
                }`}
            >
              50%
            </button>
          </Tooltip>
          <Tooltip content="Zoom 100%">
            <button
              type="button"
              onClick={() => onSetZoomLevel(1.0)}
              className={`px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${zoomLevel === 1.0
                ? 'bg-[var(--accent-primary)] text-slate-950 font-bold shadow-xs'
                : 'text-foreground/70 hover:text-foreground hover:bg-white/10'
                }`}
            >
              100%
            </button>
          </Tooltip>
          <Tooltip content="Zoom 200%">
            <button
              type="button"
              onClick={() => onSetZoomLevel(2.0)}
              className={`px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${zoomLevel === 2.0
                ? 'bg-[var(--accent-primary)] text-slate-950 font-bold shadow-xs'
                : 'text-foreground/70 hover:text-foreground hover:bg-white/10'
                }`}
            >
              200%
            </button>
          </Tooltip>
        </div>

        {/* Pan Hand Tool Button */}
        <Tooltip content="Pan Hand Tool (Hold Space + Drag)">
          <button
            type="button"
            onClick={onTogglePanTool}
            aria-label="Pan hand tool"
            className={`p-1.5 rounded-full border transition-all cursor-pointer ${isPanToolActive || isSpacePressed
              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-glow)]'
              : 'border-[var(--glass-border)] text-foreground/70 hover:text-foreground hover:bg-white/10'
              }`}
          >
            <Hand className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        {/* Safe Guides Cycle Button */}
        <Tooltip content={`Safe Guides: ${safeGuidesMode === 'none' ? 'Off' : safeGuidesMode} (Click to Cycle)`}>
          <button
            type="button"
            onClick={onCycleSafeGuides}
            aria-label={`Safe guides: ${safeGuidesMode === 'none' ? 'Off' : safeGuidesMode}`}
            className={`px-2 py-1 rounded-full border text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer ${safeGuidesMode !== 'none'
              ? 'border-amber-400/50 bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
              : 'border-[var(--glass-border)] text-foreground/70 hover:text-foreground hover:bg-white/10'
              }`}
          >
            <Shield className="w-3 h-3 text-amber-400" />
            <span>{safeGuidesMode === 'none' ? 'Guides' : safeGuidesMode}</span>
          </button>
        </Tooltip>

        {/* Alpha Transparency Checkerboard Toggle */}
        <Tooltip content="Toggle Alpha Transparency Checkerboard">
          <button
            type="button"
            onClick={onToggleCheckerboard}
            aria-label="Toggle alpha transparency checkerboard"
            className={`p-1.5 rounded-full border transition-all cursor-pointer ${showCheckerboard
              ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
              : 'border-[var(--glass-border)] text-foreground/70 hover:text-foreground hover:bg-white/10'
              }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        {/* FX Ambiance (Particles & Hologram HUD) Toggle */}
        <Tooltip content={`VFX Ambiance (HUD & Particles): ${showVfxAmbiance ? 'Enabled' : 'Disabled'}`}>
          <button
            type="button"
            onClick={onToggleVfxAmbiance}
            aria-label={showVfxAmbiance ? 'Disable VFX ambiance' : 'Enable VFX ambiance'}
            className={`p-1.5 rounded-full border transition-all cursor-pointer ${showVfxAmbiance
              ? 'border-purple-400/50 bg-purple-500/20 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
              : 'border-[var(--glass-border)] text-foreground/40 hover:text-foreground hover:bg-white/10'
              }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        {onToggleBento && (
          <Tooltip content={isBentoOpen ? 'Hide Bento Telemetry' : 'Show Bento Telemetry'}>
            <button
              type="button"
              onClick={onToggleBento}
              aria-label={isBentoOpen ? 'Hide Bento Telemetry' : 'Show Bento Telemetry'}
              className={`p-1.5 rounded-full border transition-all cursor-pointer ${isBentoOpen
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-glow)]'
                : 'border-[var(--glass-border)] text-foreground/40 hover:text-foreground hover:bg-white/10'
                }`}
            >
              <LayoutPanelTop className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        )}

        <div className="glass-card px-2.5 py-1 rounded-full text-muted-foreground font-mono text-[10px] flex items-center gap-1 border border-[var(--glass-border)]">
          <Layers className="w-3 h-3 text-[var(--accent-primary)]" />
          16:9 Canvas
        </div>
      </div>
    </div>
  );
};
