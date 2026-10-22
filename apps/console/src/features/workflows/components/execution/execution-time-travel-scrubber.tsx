import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Radio,
  Clock,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkflowStreamEvent } from '../hooks/use-workflow-execution-stream';

export interface ExecutionTimeTravelScrubberProps {
  events: WorkflowStreamEvent[];
  currentIndex: number;
  isPlaying?: boolean;
  playbackSpeed?: number;
  isLiveHead?: boolean;
  bufferedLiveEventsCount?: number;
  workflowStatus?: string;
  onSeek: (index: number) => void;
  onStepForward?: () => void;
  onStepBackward?: () => void;
  onTogglePlay?: () => void;
  onChangeSpeed?: (speed: number) => void;
  onResumeLive?: () => void;
  onResetToStart?: () => void;
}

const SPEED_OPTIONS = [0.5, 1.0, 2.0, 5.0];

export const ExecutionTimeTravelScrubber: React.FC<ExecutionTimeTravelScrubberProps> = ({
  events,
  currentIndex,
  isPlaying = false,
  playbackSpeed = 1.0,
  isLiveHead = true,
  bufferedLiveEventsCount = 0,
  workflowStatus,
  onSeek,
  onStepForward,
  onStepBackward,
  onTogglePlay,
  onChangeSpeed,
  onResumeLive,
  onResetToStart,
}) => {
  const totalEvents = events.length;
  const currentEvent = events[currentIndex] || events[totalEvents - 1] || null;

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '--:--:--';
    const d = new Date(ts);
    const ms = d.getMilliseconds().toString().padStart(3, '0');
    return `${d.toLocaleTimeString()}.${ms}`;
  };

  const calculateProgressPercent = () => {
    if (totalEvents <= 1) return 100;
    return Math.min(100, Math.max(0, (currentIndex / (totalEvents - 1)) * 100));
  };

  const eventType = currentEvent ? currentEvent.event || 'EVENT' : null;
  const eventTimestamp = currentEvent?.data?.timestamp;

  return (
    <div
      data-testid="execution-time-travel-scrubber"
      aria-label="Execution Time Travel Scrubber"
      className={cn(
        'relative flex flex-col gap-2 p-3 rounded-2xl backdrop-blur-2xl transition-all duration-300',
        'bg-white/85 dark:bg-slate-900/85 border border-white/30 dark:border-white/10 shadow-2xl'
      )}
    >
      {/* Background Live Events Notice Pill */}
      {!isLiveHead && bufferedLiveEventsCount > 0 && onResumeLive && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 animate-bounce">
          <Button
            size="sm"
            onClick={onResumeLive}
            className="h-8 px-3 rounded-full text-xs font-semibold shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{bufferedLiveEventsCount} new live events</span>
            <span className="opacity-80">· Jump to Live</span>
          </Button>
        </div>
      )}

      {/* Top Controls Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Playback Button Group */}
        <div className="flex items-center gap-1.5">
          {onResetToStart && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={currentIndex <= 0}
              onClick={onResetToStart}
              title="Reset to Start (T0)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-foreground" />
            </Button>
          )}

          {onStepBackward && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={currentIndex <= 0}
              onClick={onStepBackward}
              title="Step Backward"
            >
              <SkipBack className="w-4 h-4 text-foreground" />
            </Button>
          )}

          {onTogglePlay && (
            <Button
              size="sm"
              variant={isPlaying ? 'default' : 'outline'}
              className="h-8 w-8 p-0"
              onClick={onTogglePlay}
              disabled={totalEvents <= 1}
              title={isPlaying ? 'Pause Replay' : 'Play Replay'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </Button>
          )}

          {onStepForward && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={currentIndex >= totalEvents - 1}
              onClick={onStepForward}
              title="Step Forward"
            >
              <SkipForward className="w-4 h-4 text-foreground" />
            </Button>
          )}

          {/* Speed Selector */}
          {onChangeSpeed && (
            <div className="flex items-center gap-1 ml-2 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => onChangeSpeed(speed)}
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-mono rounded font-semibold transition-all',
                    playbackSpeed === speed
                      ? 'bg-white dark:bg-slate-800 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current Event Timestamp & Type Display */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-[11px] px-2 py-0.5 border-white/20 dark:border-white/10 bg-black/5 dark:bg-white/5"
          >
            <Clock className="w-3 h-3 mr-1 text-muted-foreground" />
            {formatTimestamp(eventTimestamp)}
          </Badge>

          {eventType && (
            <Badge
              className={cn(
                'text-[10px] uppercase font-mono px-2 py-0.5 border',
                eventType.includes('COMPLETED') &&
                  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                eventType.includes('PROGRESS') &&
                  'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
                eventType.includes('FAILED') &&
                  'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
                !eventType.includes('COMPLETED') &&
                  !eventType.includes('PROGRESS') &&
                  !eventType.includes('FAILED') &&
                  'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
              )}
            >
              {eventType}
            </Badge>
          )}

          {workflowStatus && (
            <span className="sr-only">{workflowStatus}</span>
          )}

          {/* Live vs Replay Badge */}
          {isLiveHead ? (
            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 flex items-center gap-1 text-[11px]">
              <Radio className="w-3 h-3 animate-pulse text-emerald-500" />
              LIVE
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onResumeLive}
              className="h-6 px-2 text-[10px] font-mono border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              REPLAY (Jump to Live)
            </Button>
          )}
        </div>
      </div>

      {/* Slider Scrubber Track */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-[10px] font-mono text-muted-foreground select-none w-10 text-right">
          Step {totalEvents > 0 ? currentIndex + 1 : 0}/{totalEvents}
        </span>

        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalEvents - 1)}
            value={totalEvents > 0 ? currentIndex : 0}
            disabled={totalEvents <= 1}
            onChange={(e) => onSeek(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
            aria-label="Timeline scrubber slider"
          />
        </div>

        <span className="text-[10px] font-mono text-muted-foreground select-none w-12 text-left">
          {Math.round(calculateProgressPercent())}%
        </span>
      </div>
    </div>
  );
};
