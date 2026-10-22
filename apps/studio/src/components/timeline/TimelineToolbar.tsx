import React from 'react';
import {
  MousePointer,
  Scissors,
  Hand,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Magnet,
  ArrowRightLeft,
  LayoutGrid,
  Monitor,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Slider } from '../ui/slider';
import { Tooltip } from '../ui/tooltip';
import { Toggle } from '../ui/toggle';
import { Separator } from '../ui/separator';
import { MasterAudioMeter } from '../audio/MasterAudioMeter';
import { RationalTime } from '@acc/core-isomorphic';
import type { TimelineMode } from '../../lib/timeline/strategies/ITimelineRenderStrategy';
import type { UseShuttleEngineReturn } from '../../lib/shuttle/useShuttleEngine';

export interface TimelineToolbarProps {
  activeTool: 'select' | 'razor' | 'hand';
  onSetActiveTool: (tool: 'select' | 'razor' | 'hand') => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  shuttle: UseShuttleEngineReturn;
  snapEnabled: boolean;
  onSetSnapEnabled: (snap: boolean) => void;
  rippleEnabled: boolean;
  onSetRippleEnabled: (ripple: boolean) => void;
  timelineMode: TimelineMode;
  onSetTimelineMode: (mode: TimelineMode) => void;
  zoomScale: number;
  onSetZoomScale: (zoom: number | ((z: number) => number)) => void;
  currentFrame: number;
  totalFrames: number;
  fps: number;
}

export function TimelineToolbar({
  activeTool,
  onSetActiveTool,
  isPlaying,
  onTogglePlay,
  shuttle,
  snapEnabled,
  onSetSnapEnabled,
  rippleEnabled,
  onSetRippleEnabled,
  timelineMode,
  onSetTimelineMode,
  zoomScale,
  onSetZoomScale,
  currentFrame,
  totalFrames,
  fps,
}: TimelineToolbarProps) {
  return (
    <div className="h-11 border-b border-[var(--glass-border)] px-6 flex items-center justify-between bg-[var(--glass-bg)]/40 backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        {/* Tool Selector Bar */}
        <Tooltip content="Selection Tool (V)">
          <Button
            variant={activeTool === 'select' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => onSetActiveTool('select')}
            className={`h-7 w-7 transition-colors ${
              activeTool === 'select'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Tooltip content="Razor Split Tool (C)">
          <Button
            variant={activeTool === 'razor' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => {
              onSetActiveTool(activeTool === 'razor' ? 'select' : 'razor');
            }}
            className={`h-7 w-7 transition-colors ${
              activeTool === 'razor'
                ? 'bg-[var(--accent-primary)] text-slate-950 font-semibold shadow-[0_0_10px_var(--accent-glow)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Tooltip content="Hand Panning Tool (H)">
          <Button
            variant={activeTool === 'hand' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => onSetActiveTool('hand')}
            className={`h-7 w-7 transition-colors ${
              activeTool === 'hand'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* J-K-L Shuttle & Transport Controls */}
        <Tooltip content={`Shuttle Rewind (J): ${shuttle.speed < 0 ? Math.abs(shuttle.speed) + 'x' : '1x'}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={shuttle.shuttleReverse}
            className={`h-7 w-7 transition-colors ${
              shuttle.speed < 0
                ? 'text-amber-400 bg-amber-500/15'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <SkipBack className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Tooltip content={isPlaying ? 'Pause Timeline (K or Space)' : 'Play Timeline (K or Space)'}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePlay}
            className={`h-7 w-7 transition-colors ${
              isPlaying
                ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/15 font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </Button>
        </Tooltip>

        <Tooltip content={`Shuttle Forward (L): ${shuttle.speed > 0 ? shuttle.speed + 'x' : '1x'}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={shuttle.shuttleForward}
            className={`h-7 w-7 transition-colors ${
              shuttle.speed > 0
                ? 'text-emerald-400 bg-emerald-500/15'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        <Tooltip content="Magnetic Snapping">
          <Toggle
            pressed={snapEnabled}
            onPressedChange={onSetSnapEnabled}
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 data-[state=on]:bg-[var(--accent-primary)]/15 data-[state=on]:text-[var(--accent-primary)] data-[state=on]:border-[var(--accent-primary)]/30 border border-transparent transition-colors"
          >
            <Magnet className="w-3 h-3" />
            Snap
          </Toggle>
        </Tooltip>

        <Tooltip content="Ripple Edit Mode: Trimming or deleting automatically shifts downstream clips on track">
          <Toggle
            pressed={rippleEnabled}
            onPressedChange={onSetRippleEnabled}
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-400 data-[state=on]:border-amber-500/40 border border-transparent transition-colors"
          >
            <ArrowRightLeft className="w-3 h-3" />
            Ripple
          </Toggle>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* Dual-Mode Studio Timeline Strategy Switcher: DOM vs Canvas */}
        <div className="flex items-center rounded-md border border-border/40 p-0.5 bg-muted/20 text-xs shadow-2xs">
          <Tooltip content="DOM Mode: Interactive HTML Elements with @dnd-kit">
            <Button
              variant={timelineMode === 'dom' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onSetTimelineMode('dom')}
              className={`h-6 px-2 text-[10px] font-mono gap-1 rounded-sm transition-colors ${
                timelineMode === 'dom'
                  ? 'bg-secondary text-secondary-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              DOM
            </Button>
          </Tooltip>
          <Tooltip content="Canvas Mode: 60fps High-Performance OffscreenCanvas & Pure Math Hit-Testing">
            <Button
              variant={timelineMode === 'canvas' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onSetTimelineMode('canvas')}
              className={`h-6 px-2 text-[10px] font-mono gap-1 rounded-sm transition-colors ${
                timelineMode === 'canvas'
                  ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/40 font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Monitor className="w-3 h-3" />
              Canvas
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Center: Zoom Controls & Fit */}
      <div className="flex items-center gap-2">
        <ZoomOut
          className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => onSetZoomScale((z) => Math.max(0.4, z - 0.2))}
        />
        <Slider
          min={0.4}
          max={3.0}
          step={0.1}
          value={[zoomScale]}
          onValueChange={(val) => onSetZoomScale(val[0])}
          className="w-24 cursor-pointer"
        />
        <ZoomIn
          className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => onSetZoomScale((z) => Math.min(3.0, z + 0.2))}
        />

        <Tooltip content="Zoom to Fit (Z)">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSetZoomScale(1.0)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Maximize className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>
      </div>

      {/* Right: Master Audio VU Meter & Timecode Readout */}
      <div className="flex items-center gap-3">
        <MasterAudioMeter isPlaying={isPlaying} currentFrame={currentFrame} />

        <div className="flex items-center gap-1.5">
          {shuttle.speed !== 0 && (
            <Badge
              variant="outline"
              className="font-mono text-[11px] text-amber-400 border-amber-500/30 bg-amber-500/10 font-semibold shadow-2xs"
            >
              {shuttle.speed}x
            </Badge>
          )}
          <Badge
            variant="outline"
            className="font-mono text-[11px] border-[var(--glass-border)] text-muted-foreground bg-[var(--glass-bg)] shadow-2xs"
          >
            {RationalTime.fromFrame(currentFrame, fps).toSMPTE(fps)} /{' '}
            {RationalTime.fromFrame(totalFrames, fps).toSMPTE(fps)}
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-[11px] text-[var(--accent-primary)] border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 font-semibold shadow-2xs"
          >
            F {currentFrame} / {totalFrames}
          </Badge>
        </div>
      </div>
    </div>
  );
}
