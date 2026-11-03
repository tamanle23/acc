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
      <div
        className={cn(
          "glass-panel px-4 py-2 rounded-full flex items-center shadow-glass border border-glass-border select-none whitespace-nowrap",
          lod === 'compact' ? "gap-1.5 px-2.5 py-1.5" : lod === 'medium' ? "gap-2 px-3.5 py-1.5" : "gap-3 px-4 py-2"
        )}
      >
        {/* Step Backward 1 Frame */}
        <Tooltip content="Step Backward 1 Frame (ArrowLeft)">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStepBack}
            aria-label="Step Backward 1 Frame"
            className={cn(
              "text-muted-foreground hover:text-foreground rounded-full transition-transform active:scale-95 shrink-0",
              lod === 'compact' ? "h-6 w-6" : "h-7 w-7"
            )}
          >
            <ChevronLeft className={lod === 'compact' ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </Button>
        </Tooltip>

        {/* Play / Pause Primary Button */}
        <Tooltip content={isPlaying ? 'Pause (Space or K)' : 'Play (Space or K)'}>
          <Button
            variant="default"
            size="icon"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className={cn(
              "rounded-full bg-accent-theme text-primary-foreground shadow-accent-glow hover:brightness-110 active:scale-95 transition-all shrink-0 cursor-pointer",
              lod === 'compact' ? "h-7 w-7" : "h-8 w-8"
            )}
          >
            {isPlaying ? (
              <Pause className={lod === 'compact' ? "w-3.5 h-3.5 fill-current" : "w-4 h-4 fill-current"} />
            ) : (
              <Play className={cn(lod === 'compact' ? "w-3.5 h-3.5 fill-current" : "w-4 h-4 fill-current", "ml-0.5")} />
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
            className={cn(
              "text-muted-foreground hover:text-foreground rounded-full transition-transform active:scale-95 shrink-0",
              lod === 'compact' ? "h-6 w-6" : "h-7 w-7"
            )}
          >
            <ChevronRight className={lod === 'compact' ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </Button>
        </Tooltip>

        <div className="h-4 w-px bg-glass-border mx-0.5 shrink-0" />

        {/* SMPTE Timecode & Adaptive Frame Metrics */}
        <Tooltip content={`Timecode (SMPTE): ${smpte} • Frame ${currentFrame} of ${totalFrames} (${fps} fps)`}>
          <div className="flex items-center gap-1.5 font-mono shrink-0">
            <Badge
              variant="outline"
              className={cn(
                "border-glass-border bg-background/50 font-bold text-foreground",
                lod === 'compact' ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5"
              )}
            >
              {smpte}
            </Badge>
            {lod !== 'compact' && (
              <span className="text-[10px] text-muted-foreground font-medium font-mono shrink-0">
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
                size={lod === 'compact' ? 'icon' : 'sm'}
                onClick={() => {
                  if (zoomLevel === 'fit') {
                    onSetZoomLevel?.(1.0);
                  } else {
                    onSetZoomLevel?.('fit');
                    onResetPan?.();
                  }
                }}
                className={cn(
                  "font-mono text-muted-foreground hover:text-foreground rounded-full flex items-center gap-1 shrink-0",
                  lod === 'compact' ? "h-6 w-6 p-0" : "h-7 px-2 text-xs"
                )}
              >
                {zoomLevel === 'fit' ? (
                  <>
                    <Maximize2 className={lod === 'compact' ? "w-3 h-3" : "w-3.5 h-3.5"} />
                    {lod !== 'compact' && <span>Fit</span>}
                  </>
                ) : (
                  <>
                    <RotateCcw className={lod === 'compact' ? "w-3 h-3" : "w-3.5 h-3.5"} />
                    {lod !== 'compact' && (
                      <span>{typeof zoomLevel === 'number' ? `${Math.round(zoomLevel * 100)}%` : '100%'}</span>
                    )}
                  </>
                )}
              </Button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
};
