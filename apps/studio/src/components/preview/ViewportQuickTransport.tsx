import React from 'react';
import { cn } from 'cn';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip } from '../ui/tooltip';
import { RationalTime } from '@acc/core-isomorphic';
import type { PreviewLOD } from './useContainerLOD';

export interface ViewportQuickTransportProps {
  isPlaying: boolean;
  onTogglePlay?: () => void;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  onScrub?: (frame: number) => void;
  zoomLevel?: 'fit' | 0.5 | 1.0 | 2.0;
  onSetZoomLevel?: (zoom: 'fit' | 0.5 | 1.0 | 2.0) => void;
  onResetPan?: () => void;
  lod?: PreviewLOD;
  className?: string;
}

export const ViewportQuickTransport: React.FC<ViewportQuickTransportProps> = ({
  isPlaying,
  onTogglePlay,
  currentFrame,
  totalFrames,
  fps,
  onScrub,
  zoomLevel = 'fit',
  onSetZoomLevel,
  onResetPan,
  lod = 'full',
  className,
}) => {
  const handleStepBack = () => {
    if (onScrub) onScrub(Math.max(0, currentFrame - 1));
  };

  const handleStepForward = () => {
    if (onScrub) onScrub(Math.min(totalFrames, currentFrame + 1));
  };

  const smpte = RationalTime.fromFrame(currentFrame, fps).toSMPTE(fps);

  return (
    <div
      className={cn(
        "absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto transition-all max-w-[calc(100%-1.5rem)]",
        className
      )}
    >
      <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 sm:gap-3 shadow-glass border border-glass-border select-none">
        {/* Step Backward 1 Frame */}
        <Tooltip content="Step Backward 1 Frame (ArrowLeft)">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStepBack}
            aria-label="Step Backward 1 Frame"
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full transition-transform active:scale-95 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Tooltip>

        {/* Play / Pause Primary Button */}
        <Tooltip content={isPlaying ? 'Pause (Space or K)' : 'Play (Space or K)'}>
          <Button
            variant="default"
            size="icon"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="h-8 w-8 rounded-full bg-accent-theme text-primary-foreground shadow-accent-glow hover:brightness-110 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </Button>
        </Tooltip>

        {/* Step Forward 1 Frame */}
        <Tooltip content="Step Forward 1 Frame (ArrowRight)">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStepForward}
            aria-label="Step Forward 1 Frame"
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full transition-transform active:scale-95 shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Tooltip>

        <div className="h-4 w-px bg-glass-border mx-0.5 shrink-0" />

        {/* SMPTE Timecode */}
        <Tooltip content={`Timecode (SMPTE): ${smpte} • Frame ${currentFrame} of ${totalFrames} (${fps} fps)`}>
          <div className="flex items-center gap-1.5 font-mono shrink-0">
            <Badge
              variant="outline"
              className="text-[11px] px-2 py-0.5 border-glass-border bg-background/50 font-bold text-foreground"
            >
              {smpte}
            </Badge>
            {lod !== 'compact' && (
              <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                {lod === 'full' ? `F ${currentFrame}/${totalFrames}` : `F ${currentFrame}`}
              </span>
            )}
          </div>
        </Tooltip>

        {/* Viewport Fit / Zoom Toggle */}
        {(onSetZoomLevel || onResetPan) && (
          <>
            <div className="h-4 w-px bg-glass-border mx-0.5 shrink-0" />
            <Tooltip content={zoomLevel === 'fit' ? 'Zoom 100% (Z)' : 'Fit Viewport (Z)'}>
              <Button
                variant="ghost"
                size={lod === 'full' ? 'sm' : 'icon'}
                onClick={() => {
                  if (onResetPan && zoomLevel !== 'fit') onResetPan();
                  if (onSetZoomLevel) {
                    onSetZoomLevel(zoomLevel === 'fit' ? 1.0 : 'fit');
                  }
                }}
                aria-label="Toggle Viewport Zoom"
                className="h-7 px-2 text-[10px] gap-1 font-mono text-muted-foreground hover:text-foreground rounded-full shrink-0"
              >
                {zoomLevel === 'fit' ? (
                  <Maximize2 className="w-3.5 h-3.5" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                {lod === 'full' && (
                  <span className="hidden md:inline">{zoomLevel === 'fit' ? '100%' : 'Fit'}</span>
                )}
              </Button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
};
