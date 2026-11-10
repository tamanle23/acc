import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import {
  Activity,
  Sliders,
  Cpu,
  Zap,
  Radio,
} from 'lucide-solid';
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
      domain?: Record<string, unknown>;
    }
  >;
}

export function TelemetryCompanionCard(props: TelemetryCompanionCardProps) {
  const currentSec = () => (props.currentFrame / Math.max(1, props.fps)).toFixed(2);
  const totalSec = () => (props.totalFrames / Math.max(1, props.fps)).toFixed(2);

  const [streamState, setStreamState] = createSignal<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');
  const [liveTelemetry, setLiveTelemetry] = createSignal<SseFleetTelemetry | null>(null);

  onMount(() => {
    if (typeof EventSource === 'undefined') return;

    let es: EventSource | null = null;
    const endpoint = props.sseEndpoint || 'http://127.0.0.1:3333/api/telemetry/stream';
    try {
      es = new EventSource(endpoint);

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

    onCleanup(() => {
      if (es) {
        es.close();
      }
    });
  });

  const pythonService = () => liveTelemetry()?.services?.['python-backend'];
  const pythonVramMb = () => pythonService()?.domain?.vramUsedMb;

  return (
    <div class="flex flex-col gap-2 w-full select-none text-xs font-mono" role="region" aria-label="Timeline Telemetry & Viewport Helpers">
      {/* 1. Scene & Engine Telemetry Card */}
      <div class="glass-card rounded-xl p-3 border border-glass-border bg-glass-surface/80 backdrop-blur-md shadow-sm space-y-2">
        <div class="flex items-center justify-between text-[11px] text-muted-foreground border-b border-glass-border pb-1.5 font-semibold">
          <span class="flex items-center gap-1.5 text-foreground">
            <Activity class="w-3.5 h-3.5 text-accent-theme" />
            Telemetry
          </span>
          <div class="flex items-center gap-1.5">
            {/* Live SSE Status Badge */}
            <Tooltip content={`Fleet SSE Stream: ${streamState()}`}>
              <span
                class={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border ${
                  streamState() === 'connected'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : streamState() === 'connecting'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 animate-pulse'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                }`}
              >
                <Radio class="w-2.5 h-2.5" />
                {streamState() === 'connected' ? 'LIVE' : streamState() === 'connecting' ? 'SYNC' : 'LOCAL'}
              </span>
            </Tooltip>
            <span class="text-[10px] text-accent-theme bg-accent-theme/10 px-1.5 py-0.5 rounded border border-accent-theme/20 font-bold">
              {props.fps} FPS
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[10px]">
          <div class="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
            <span class="text-muted-foreground text-[9px]">CANVAS SIZE</span>
            <span class="font-semibold text-foreground truncate">{props.width}×{props.height}</span>
          </div>

          <div class="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
            <span class="text-muted-foreground text-[9px]">TIMELINE</span>
            <span class="font-semibold text-foreground truncate">{currentSec()}s / {totalSec()}s</span>
          </div>

          <div class="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
            <span class="text-muted-foreground text-[9px]">ACTIVE TRACKS</span>
            <span class="font-semibold text-foreground">{props.trackCount} tracks</span>
          </div>

          <div class="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
            <span class="text-muted-foreground text-[9px]">ACTIVE CLIPS</span>
            <span class="font-semibold text-accent-theme">{props.activeSequenceCount} rendering</span>
          </div>

          {/* Live Fleet Metrics (when connected) */}
          <Show when={liveTelemetry()}>
            {(telemetry) => (
              <>
                <div class="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
                  <span class="text-muted-foreground text-[9px] flex items-center gap-1">
                    <Cpu class="w-2.5 h-2.5 text-accent-theme" /> ACCELERATOR
                  </span>
                  <span class="font-semibold text-emerald-400 uppercase truncate">
                    {telemetry().system.hardwareTier}
                  </span>
                </div>

                <div class="flex flex-col rounded bg-muted/30 p-1.5 border border-glass-border">
                  <span class="text-muted-foreground text-[9px] flex items-center gap-1">
                    <Zap class="w-2.5 h-2.5 text-accent-theme" /> AI VRAM
                  </span>
                  <span class="font-semibold text-foreground truncate">
                    {pythonVramMb() ? `${pythonVramMb()} MB` : `${telemetry().system.freeMemoryMb} MB free`}
                  </span>
                </div>
              </>
            )}
          </Show>
        </div>
      </div>

      {/* 2. Format, Safe Guides & Viewport Quick Switches */}
      <div class="glass-card rounded-xl p-3 border border-glass-border bg-glass-surface/80 backdrop-blur-md shadow-sm space-y-2">
        <div class="flex items-center justify-between text-[11px] text-muted-foreground border-b border-glass-border pb-1.5 font-semibold">
          <span class="flex items-center gap-1.5 text-foreground">
            <Sliders class="w-3.5 h-3.5 text-accent-theme" />
            Viewport Helpers
          </span>
          <span class="text-[10px] text-muted-foreground">
            {props.zoomLevel === 'fit' ? 'Auto Fit' : `${Math.round(Number(props.zoomLevel) * 100)}%`}
          </span>
        </div>

        <div class="flex items-center justify-between gap-1 text-[10px]">
          {/* Safe Guides Toggle */}
          <Tooltip content={`Safe Guides: ${props.safeGuidesMode === 'none' ? 'Off' : props.safeGuidesMode}`}>
            <button
              type="button"
              onClick={props.onCycleSafeGuides}
              aria-label={`Safe Guides: ${props.safeGuidesMode}`}
              class={`flex-1 py-1 px-1.5 rounded border text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-theme ${
                props.safeGuidesMode !== 'none'
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-400 font-semibold'
                  : 'border-glass-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {props.safeGuidesMode === 'none' ? 'Guides Off' : props.safeGuidesMode}
            </button>
          </Tooltip>

          {/* Checkerboard Toggle */}
          <Tooltip content="Alpha Transparency Checkerboard">
            <button
              type="button"
              onClick={props.onToggleCheckerboard}
              aria-label="Toggle Checkerboard Transparency"
              class={`flex-1 py-1 px-1.5 rounded border text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-theme ${
                props.showCheckerboard
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
              onClick={props.onToggleVfxAmbiance}
              aria-label="Toggle VFX Ambiance HUD"
              class={`flex-1 py-1 px-1.5 rounded border text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-theme ${
                props.showVfxAmbiance
                  ? 'border-accent-theme/50 bg-accent-theme/15 text-accent-theme font-semibold'
                  : 'border-glass-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              VFX HUD
            </button>
          </Tooltip>
        </div>

        {/* Selected Sequence Status Pill */}
        <Show when={props.selectedSeqId}>
          <div class="pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span class="truncate max-w-[120px]">Target: {props.selectedSeqId}</span>
            <span class="text-[9px] text-accent-theme font-bold">READY</span>
          </div>
        </Show>
      </div>
    </div>
  );
}
