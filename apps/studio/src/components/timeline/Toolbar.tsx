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
    <div className="h-11 border-b border-glass-border px-3 sm:px-6 flex items-center justify-between bg-glass-surface/60 backdrop-blur-md gap-2 overflow-hidden select-none shrink-0">
      {/* 1. Left: Editing Tools & Transport Shuttling */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Tool Selector Bar */}
        <Tooltip content="Selection Tool (V)">
          <Button
            variant={activeTool === 'select' ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Selection Tool (V)"
            aria-pressed={activeTool === 'select'}
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
            aria-label="Razor Split Tool (C)"
            aria-pressed={activeTool === 'razor'}
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
            aria-label="Hand Panning Tool (H)"
            aria-pressed={activeTool === 'hand'}
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

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        {/* J-K-L Shuttle & Transport Controls */}
        <Tooltip content={`Shuttle Rewind (J): ${shuttle.speed < 0 ? Math.abs(shuttle.speed) + 'x' : '1x'}`}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Shuttle Rewind (J)"
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
            aria-label={isPlaying ? 'Pause Timeline' : 'Play Timeline'}
            aria-pressed={isPlaying}
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
            aria-label="Shuttle Forward (L)"
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

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        <Tooltip content="Magnetic Snapping (S)">
          <Toggle
            pressed={snapEnabled}
            onPressedChange={onSetSnapEnabled}
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 data-[state=on]:bg-accent-theme/15 data-[state=on]:text-accent-theme data-[state=on]:border-accent-theme/30 border border-transparent transition-colors"
          >
            <Magnet className="w-3 h-3" />
            <span className="hidden sm:inline">Snap</span>
          </Toggle>
        </Tooltip>

        <Tooltip content="Ripple Edit Mode (R): Trimming or deleting automatically shifts downstream clips">
          <Toggle
            pressed={rippleEnabled}
            onPressedChange={onSetRippleEnabled}
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-400 data-[state=on]:border-amber-500/40 border border-transparent transition-colors"
          >
            <ArrowRightLeft className="w-3 h-3" />
            <span className="hidden sm:inline">Ripple</span>
          </Toggle>
        </Tooltip>
      </div>

      {/* 2. Center: Progressive Zoom Stepper & Slider */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <Tooltip content="Zoom Out (-)">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom Out"
            onClick={() => onSetZoomScale((z) => Math.max(0.1, +(z - 0.2).toFixed(2)))}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <div className="hidden md:flex items-center">
          <Slider
            min={0.1}
            max={4.0}
            step={0.05}
            value={[zoomScale]}
            onValueChange={(val) => onSetZoomScale(val[0])}
            className="w-16 lg:w-24 cursor-pointer"
          />
        </div>

        <Tooltip content="Zoom In (+)">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom In"
            onClick={() => onSetZoomScale((z) => Math.min(4.0, +(z + 0.2).toFixed(2)))}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        {/* Current Zoom Readout Badge (Clickable to reset to 100%) */}
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
            aria-label="Zoom to fit 100%"
            onClick={() => onSetZoomScale(1.0)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Maximize className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>
      </div>

      {/* 3. Right: Master Audio VU Meter & Timecode Readout */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <MasterAudioMeter isPlaying={isPlaying} currentFrame={currentFrame} />

        <div className="flex items-center gap-1 sm:gap-1.5">
          {shuttle.speed !== 0 && (
            <Badge
              variant="outline"
              className="font-mono text-[10px] sm:text-[11px] text-amber-400 border-amber-500/30 bg-amber-500/10 font-semibold shadow-2xs"
            >
              {shuttle.speed}x
            </Badge>
          )}
          <Badge
            variant="outline"
            className="font-mono text-[10px] sm:text-[11px] border-glass-border text-foreground bg-glass-surface shadow-2xs font-semibold"
          >
            {RationalTime.fromFrame(currentFrame, fps).toSMPTE(fps)}
            <span className="opacity-60 hidden lg:inline">
              {' '}/ {RationalTime.fromFrame(totalFrames, fps).toSMPTE(fps)}
            </span>
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-[10px] sm:text-[11px] text-accent-theme border-accent-theme/30 bg-accent-theme/10 font-semibold shadow-2xs hidden xl:inline-flex"
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
