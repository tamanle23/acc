import { Show } from 'solid-js';
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
} from 'lucide-solid';
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

export function Toolbar(props: ToolbarProps) {
  const currentSpeed = () =>
    typeof props.shuttle.speed === 'function'
      ? (props.shuttle.speed as () => number)()
      : Number(props.shuttle.speed || 0);

  return (
    <div class="h-11 border-b border-glass-border px-3 sm:px-6 flex items-center justify-between bg-glass-surface/60 backdrop-blur-md gap-2 overflow-hidden select-none shrink-0">
      {/* 1. Left: Editing Tools & Transport Shuttling */}
      <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Tool Selector Bar */}
        <Tooltip content="Selection Tool (V)">
          <Button
            variant={props.activeTool === 'select' ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Selection Tool (V)"
            aria-pressed={props.activeTool === 'select'}
            onClick={() => props.onSetActiveTool('select')}
            class={`h-7 w-7 transition-colors ${
              props.activeTool === 'select'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MousePointer class="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Tooltip content="Razor Split Tool (C)">
          <Button
            variant={props.activeTool === 'razor' ? 'default' : 'ghost'}
            size="icon"
            aria-label="Razor Split Tool (C)"
            aria-pressed={props.activeTool === 'razor'}
            onClick={() => {
              props.onSetActiveTool(props.activeTool === 'razor' ? 'select' : 'razor');
            }}
            class={`h-7 w-7 transition-colors ${
              props.activeTool === 'razor'
                ? 'bg-accent-theme text-primary-foreground font-semibold shadow-accent-glow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scissors class="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Tooltip content="Hand Panning Tool (H)">
          <Button
            variant={props.activeTool === 'hand' ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Hand Panning Tool (H)"
            aria-pressed={props.activeTool === 'hand'}
            onClick={() => props.onSetActiveTool('hand')}
            class={`h-7 w-7 transition-colors ${
              props.activeTool === 'hand'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Hand class="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Separator orientation="vertical" class="h-4 mx-0.5" />

        {/* J-K-L Shuttle & Transport Controls */}
        <Tooltip content={`Shuttle Rewind (J): ${currentSpeed() < 0 ? Math.abs(currentSpeed()) + 'x' : '1x'}`}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Shuttle Rewind (J)"
            onClick={props.shuttle.shuttleReverse}
            class={`h-7 w-7 transition-colors ${
              currentSpeed() < 0
                ? 'text-amber-400 bg-amber-500/15'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <SkipBack class="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Tooltip content={props.isPlaying ? 'Pause Timeline (K or Space)' : 'Play Timeline (K or Space)'}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={props.isPlaying ? 'Pause Timeline' : 'Play Timeline'}
            aria-pressed={props.isPlaying}
            onClick={props.onTogglePlay}
            class={`h-7 w-7 transition-colors ${
              props.isPlaying
                ? 'text-accent-theme bg-accent-theme/15 font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Show when={props.isPlaying} fallback={<Play class="w-3.5 h-3.5" />}>
              <Pause class="w-3.5 h-3.5" />
            </Show>
          </Button>
        </Tooltip>

        <Tooltip content={`Shuttle Forward (L): ${currentSpeed() > 0 ? currentSpeed() + 'x' : '1x'}`}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Shuttle Forward (L)"
            onClick={props.shuttle.shuttleForward}
            class={`h-7 w-7 transition-colors ${
              currentSpeed() > 0
                ? 'text-emerald-400 bg-emerald-500/15'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <SkipForward class="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <Separator orientation="vertical" class="h-4 mx-0.5" />

        <Tooltip content="Magnetic Snapping (S)">
          <Toggle
            pressed={props.snapEnabled}
            onPressedChange={props.onSetSnapEnabled}
            size="sm"
            class="h-7 px-2 text-[11px] gap-1 data-[state=on]:bg-accent-theme/15 data-[state=on]:text-accent-theme data-[state=on]:border-accent-theme/30 border border-transparent transition-colors"
          >
            <Magnet class="w-3 h-3" />
            <span class="hidden sm:inline">Snap</span>
          </Toggle>
        </Tooltip>

        <Tooltip content="Ripple Edit Mode (R): Trimming or deleting automatically shifts downstream clips">
          <Toggle
            pressed={props.rippleEnabled}
            onPressedChange={props.onSetRippleEnabled}
            size="sm"
            class="h-7 px-2 text-[11px] gap-1 data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-400 data-[state=on]:border-amber-500/40 border border-transparent transition-colors"
          >
            <ArrowRightLeft class="w-3 h-3" />
            <span class="hidden sm:inline">Ripple</span>
          </Toggle>
        </Tooltip>
      </div>

      {/* 2. Center: Progressive Zoom Stepper & Slider */}
      <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <Tooltip content="Zoom Out (-)">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom Out"
            onClick={() => props.onSetZoomScale((z) => Math.max(0.1, +(z - 0.2).toFixed(2)))}
            class="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <ZoomOut class="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        <div class="hidden md:flex items-center">
          <Slider
            min={0.1}
            max={4.0}
            step={0.05}
            value={[props.zoomScale]}
            onValueChange={(val) => props.onSetZoomScale(val[0])}
            class="w-16 lg:w-24 cursor-pointer"
          />
        </div>

        <Tooltip content="Zoom In (+)">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom In"
            onClick={() => props.onSetZoomScale((z) => Math.min(4.0, +(z + 0.2).toFixed(2)))}
            class="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <ZoomIn class="w-3.5 h-3.5" />
          </Button>
        </Tooltip>

        {/* Current Zoom Readout Badge (Clickable to reset to 100%) */}
        <Tooltip content="Current Zoom Level (Click to reset to 100%)">
          <Badge
            variant="outline"
            onClick={() => props.onSetZoomScale(1.0)}
            class="font-mono text-[10px] px-1.5 py-0.5 border-glass-border text-muted-foreground hover:text-foreground hover:border-accent-theme/40 cursor-pointer transition-colors shadow-2xs select-none"
          >
            {Math.round(props.zoomScale * 100)}%
          </Badge>
        </Tooltip>

        <Tooltip content="Zoom to Fit 100% (Z)">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom to fit 100%"
            onClick={() => props.onSetZoomScale(1.0)}
            class="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Maximize class="w-3.5 h-3.5" />
          </Button>
        </Tooltip>
      </div>

      {/* 3. Right: Master Audio VU Meter & Timecode Readout */}
      <div class="flex items-center gap-2 sm:gap-3 shrink-0">
        <MasterAudioMeter isPlaying={props.isPlaying} currentFrame={props.currentFrame} />

        <div class="flex items-center gap-1 sm:gap-1.5">
          <Show when={currentSpeed() !== 0}>
            <Badge
              variant="outline"
              class="font-mono text-[10px] sm:text-[11px] text-amber-400 border-amber-500/30 bg-amber-500/10 font-semibold shadow-2xs"
            >
              {currentSpeed()}x
            </Badge>
          </Show>
          <Badge
            variant="outline"
            class="font-mono text-[10px] sm:text-[11px] border-glass-border text-foreground bg-glass-surface shadow-2xs font-semibold"
          >
            {RationalTime.fromFrame(props.currentFrame, props.fps).toSMPTE(props.fps)}
            <span class="opacity-60 hidden lg:inline">
              {' '}/ {RationalTime.fromFrame(props.totalFrames, props.fps).toSMPTE(props.fps)}
            </span>
          </Badge>
          <Badge
            variant="outline"
            class="font-mono text-[10px] sm:text-[11px] text-accent-theme border-accent-theme/30 bg-accent-theme/10 font-semibold shadow-2xs hidden xl:inline-flex"
          >
            F {props.currentFrame} / {props.totalFrames}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export const TimelineToolbar = Toolbar;
