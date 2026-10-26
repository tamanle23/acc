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
import type { UseShuttleEngineReturn } from '../../lib/shuttle/useShuttleEngine';

export interface ToolbarProps {
  activeTool: 'select' | 'razor' | 'hand';
  onSetActiveTool: (tool: 'select' | 'razor' | 'hand') => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  shuttle: UseShuttleEngineReturn;
  snapEnabled: boolean;
  onSetSnapEnabled: (snap: boolean) => void;
  rippleEnabled: boolean;
  onSetRippleEnabled: (ripple: boolean) => void;
  zoomScale: number;
  onSetZoomScale: (zoom: number | ((z: number) => number)) => void;
  currentFrame: number;
  totalFrames: number;
  fps: number;
}

export type TimelineToolbarProps = ToolbarProps;

export function Toolbar({
  activeTool,
  onSetActiveTool,
  isPlaying,
  onTogglePlay,
  shuttle,
  snapEnabled,
  onSetSnapEnabled,
  rippleEnabled,
  onSetRippleEnabled,
  zoomScale,
  onSetZoomScale,
  currentFrame,
  totalFrames,
  fps,
}: ToolbarProps) {
  return (
    <div className="h-11 border-b border-glass-border px-6 flex items-center justify-between bg-glass-surface/60 backdrop-blur-md">
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
                ? 'bg-accent-theme text-primary-foreground font-semibold shadow-accent-glow'
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
                ? 'text-accent-theme bg-accent-theme/15 font-bold shadow-xs'
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
            className="h-7 px-2 text-[11px] gap-1 data-[state=on]:bg-accent-theme/15 data-[state=on]:text-accent-theme data-[state=on]:border-accent-theme/30 border border-transparent transition-colors"
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
      </div>

      {/* Center: Zoom Controls & Fit */}
      <div className="flex items-center gap-1.5">
        <ZoomOut
          className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => onSetZoomScale((z) => Math.max(0.1, +(z - 0.2).toFixed(2)))}
        />
        <Slider
          min={0.1}
          max={4.0}
          step={0.05}
          value={[zoomScale]}
          onValueChange={(val) => onSetZoomScale(val[0])}
          className="w-24 cursor-pointer"
        />
        <ZoomIn
          className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => onSetZoomScale((z) => Math.min(4.0, +(z + 0.2).toFixed(2)))}
        />

        {/* Current Zoom Readout Badge (Clickable to reset to 1.0x / 100%) */}
        <Tooltip content="Current Zoom Level (Click to reset to 100%)">
          <Badge
            variant="outline"
            onClick={() => onSetZoomScale(1.0)}
            className="font-mono text-[10px] px-1.5 py-0.5 border-glass-border text-muted-foreground hover:text-foreground hover:border-accent-theme/40 cursor-pointer transition-colors shadow-2xs select-none"
          >
            {Math.round(zoomScale * 100)}%
          </Badge>
        </Tooltip>

        <Tooltip content="Zoom to Fit 100% (Z)">
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
            className="font-mono text-[11px] border-glass-border text-muted-foreground bg-glass-surface shadow-2xs"
          >
            {RationalTime.fromFrame(currentFrame, fps).toSMPTE(fps)} /{' '}
            {RationalTime.fromFrame(totalFrames, fps).toSMPTE(fps)}
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-[11px] text-accent-theme border-accent-theme/30 bg-accent-theme/10 font-semibold shadow-2xs"
          >
            F {currentFrame} / {totalFrames}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// Backward-compatible alias
export const TimelineToolbar = Toolbar;

