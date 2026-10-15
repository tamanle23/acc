import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Radio,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkflowStreamEvent } from '@/features/workflows/hooks/use-workflow-execution-stream';

export interface TimeTravelScrubberProps {
  events: WorkflowStreamEvent[];
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  isLiveHead: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSeek: (index: number) => void;
  onChangeSpeed: (speed: number) => void;
  onResumeLive: () => void;
  workflowStatus?: string;
}

const SPEED_OPTIONS = [0.5, 1.0, 2.0, 5.0];

export const TimeTravelScrubber: React.FC<TimeTravelScrubberProps> = ({
  events,
  currentIndex,
  isPlaying,
  playbackSpeed,
  isLiveHead,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onSeek,
  onChangeSpeed,
  onResumeLive,
  workflowStatus = 'RUNNING',
}) => {
  const totalEvents = events.length;
  const currentEvent = events[currentIndex] || events[totalEvents - 1] || null;

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '--:--:--';
    const d = new Date(ts);
    return `${d.toLocaleTimeString()}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col gap-2 p-3 rounded-2xl backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/30 dark:border-white/10 shadow-2xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={currentIndex <= 0}
            onClick={onStepBackward}
            title="Step to Previous Event"
          >
            <SkipBack className="w-4 h-4 text-foreground" />
          </Button>

          <Button
            size="sm"
            variant={isPlaying ? 'default' : 'outline'}
            className="h-8 w-8 p-0"
            onClick={isPlaying ? onPause : onPlay}
            disabled={totalEvents <= 1}
            title={isPlaying ? 'Pause Playback' : 'Play Timeline'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 text-emerald-500 fill-emerald-500" />
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={currentIndex >= totalEvents - 1}
            onClick={onStepForward}
            title="Step to Next Event"
          >
            <SkipForward className="w-4 h-4 text-foreground" />
          </Button>

          <div className="h-4 w-[1px] bg-border/50 mx-1" />

          {/* Speed Buttons */}
          <div className="flex items-center gap-1 bg-background/50 p-0.5 rounded-lg border border-border/40">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={cn(
                  'px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors',
                  playbackSpeed === speed
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onChangeSpeed(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Current Event Context & Time */}
        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-muted-foreground text-[11px]">
            {formatTimestamp(currentEvent?.data?.timestamp)}
          </span>
          <span className="font-medium text-foreground">
            {currentEvent?.event || 'INITIAL'}
          </span>
          {currentEvent?.data?.taskReferenceName && (
            <Badge variant="outline" className="font-mono text-[10px] bg-background/60">
              {currentEvent.data.taskReferenceName}
            </Badge>
          )}
        </div>

        {/* Live vs Replay Status */}
        <div className="flex items-center gap-2">
          {isLiveHead ? (
            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 text-xs animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              LIVE (HEAD)
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs">
                TIME-TRAVEL ({currentIndex + 1}/{totalEvents})
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                onClick={onResumeLive}
                title="Snap back to real-time execution HEAD"
              >
                <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                Resume Live
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Scrubber Slider */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-[10px] font-mono text-muted-foreground w-12 text-left">
          {totalEvents > 0 ? `1 / ${totalEvents}` : '0 / 0'}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(totalEvents - 1, 0)}
          value={currentIndex}
          onChange={(e) => onSeek(parseInt(e.target.value) || 0)}
          className="flex-1 h-1.5 bg-border/60 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
        />
        <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">
          {currentIndex + 1}
        </span>
      </div>
    </div>
  );
};
