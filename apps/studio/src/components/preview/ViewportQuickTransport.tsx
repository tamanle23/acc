import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

export interface ViewportQuickTransportProps {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  onTogglePlay?: () => void;
  onScrub?: (frame: number) => void;
}

export function ViewportQuickTransport({
  isPlaying,
  currentFrame,
  totalFrames,
  fps,
  onTogglePlay,
  onScrub,
}: ViewportQuickTransportProps) {
  const safeFps = Math.max(1, fps);

  return (
    <div className="mt-2 flex items-center gap-2 glass-panel px-4 py-2 rounded-full shadow-lg pointer-events-auto border border-glass-border-highlight transition-all duration-200 hover:scale-[1.02] z-30">
      <Tooltip content="Rewind to Start (Home)">
        <button
          type="button"
          onClick={() => onScrub?.(0)}
          className="p-1.5 text-foreground/70 hover:text-foreground rounded-full hover:bg-foreground/10 active:scale-90 transition-all cursor-pointer"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <Tooltip content={isPlaying ? 'Pause Viewport (Space)' : 'Play Viewport (Space)'}>
        <button
          type="button"
          onClick={onTogglePlay}
          className={`relative p-2.5 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer ${
            isPlaying
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
              : 'bg-accent-theme text-primary-foreground shadow-accent-glow'
          }`}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </Tooltip>

      <Tooltip content="Step Forward 1 Frame">
        <button
          type="button"
          onClick={() => onScrub?.(Math.min(totalFrames, currentFrame + 1))}
          className="p-1.5 text-foreground/70 hover:text-foreground rounded-full hover:bg-foreground/10 active:scale-90 transition-all cursor-pointer"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <div className="h-4 w-px bg-glass-border-highlight mx-1" />

      {/* Timecode Readout Pill */}
      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full glass-card border border-glass-border text-foreground/90 font-mono text-[11px] select-none tracking-tight">
        <span className="font-semibold text-accent-theme">
          {(currentFrame / safeFps).toFixed(2)}s
        </span>
        <span className="text-muted-foreground text-[10px]">
          / {(totalFrames / safeFps).toFixed(2)}s
        </span>
      </div>
    </div>
  );
}
