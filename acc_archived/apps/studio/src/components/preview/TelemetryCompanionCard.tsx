import React, { useEffect, useState } from 'react';
import {
  Activity,
  Sliders,
  Cpu,
  Zap,
  Radio,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

export interface TelemetryCompanionCardProps {
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
  sseEndpoint?: string;
}

interface SseFleetTelemetry {
  timestamp: number;
  system: {
    cpuCount: number;
    totalMemoryMb: number;
    freeMemoryMb: number;
    hardwareTier: string;
  };
  services: Record<
    string,
    {
      name: string;
      status: string;
      cpuPercent: number;
      memoryRssMb: number;
      domain?: any;
    }
  >;
}

export const TelemetryCompanionCard: React.FC<TelemetryCompanionCardProps> = ({
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
  sseEndpoint = 'http://127.0.0.1:3333/api/telemetry/stream',
}) => {
  const currentSec = (currentFrame / Math.max(1, fps)).toFixed(2);
  const totalSec = (totalFrames / Math.max(1, fps)).toFixed(2);

  // 5-State Component Matrix for SSE Connection:
  // 'connecting' | 'connected' | 'reconnecting' | 'error' | 'disabled'
  const [streamState, setStreamState] = useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');
  const [liveTelemetry, setLiveTelemetry] = useState<SseFleetTelemetry | null>(null);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(sseEndpoint);

      es.addEventListener('open', () => {
        setStreamState('connected');
      });

      es.addEventListener('telemetry', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setLiveTelemetry(parsed);
          setStreamState('connected');
        } catch {}
      });

      es.onerror = () => {
        setStreamState('error');
      };
    } catch {
      setStreamState('error');
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [sseEndpoint]);

  const pythonService = liveTelemetry?.services?.['python-backend'];
  const workerService = liveTelemetry?.services?.['worker'];
  const workerFps = workerService?.domain?.renderFps;
  const pythonVramMb = pythonService?.domain?.vramUsedMb;

  return (
    <div className="flex flex-col gap-2 w-full select-none text-xs font-mono" role="region" aria-label="Timeline Telemetry & Viewport Helpers">
      {/* 1. Scene & Engine Telemetry Card */}
      <div className="glass-card rounded-xl p-3 border border-glass-border bg-glass-surface/80 backdrop-blur-md shadow-sm space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-glass-border pb-1.5 font-semibold">
          <span className="flex items-center gap-1.5 text-foreground">
            <Activity className="w-3.5 h-3.5 text-accent-theme" />
            Telemetry
          </span>
          <div className="flex items-center gap-1.5">
            {/* Live SSE Status Badge */}
            <Tooltip content={`Fleet SSE Stream: ${streamState}`}>
              <span
                className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border ${
                  streamState === 'connected'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : streamState === 'connecting'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 animate-pulse'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                }`}
              >
                <Radio className="w-2.5 h-2.5" />
                {streamState === 'connected' ? 'LIVE' : streamState === 'connecting' ? 'SYNC' : 'LOCAL'}
              </span>
            </Tooltip>
            <span className="text-[10px] text-accent-theme bg-accent-theme/10 px-1.5 py-0.5 rounded border border-accent-theme/20 font-bold">
              {fps} FPS
            </span>
          </div>
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

          {/* Live Fleet Metrics (when connected) */}
          {liveTelemetry && (
            <>
              <div className="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
                <span className="text-muted-foreground text-[9px] flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5 text-accent-theme" /> ACCELERATOR
                </span>
                <span className="font-semibold text-emerald-400 uppercase truncate">
                  {liveTelemetry.system.hardwareTier}
                </span>
              </div>

              <div className="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
                <span className="text-muted-foreground text-[9px] flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-accent-theme" /> AI VRAM
                </span>
                <span className="font-semibold text-foreground truncate">
                  {pythonVramMb ? `${pythonVramMb} MB` : `${liveTelemetry.system.freeMemoryMb} MB free`}
                </span>
              </div>
            </>
          )}
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
              aria-label={`Safe Guides: ${safeGuidesMode}`}
              className={`flex-1 py-1 px-1.5 rounded border text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-theme ${
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
              aria-label="Toggle Checkerboard Transparency"
              className={`flex-1 py-1 px-1.5 rounded border text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-theme ${
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
              aria-label="Toggle VFX Ambiance HUD"
              className={`flex-1 py-1 px-1.5 rounded border text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-theme ${
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
