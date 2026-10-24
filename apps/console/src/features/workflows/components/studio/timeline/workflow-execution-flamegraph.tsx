import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Cpu, AlertCircle, CheckCircle2, Loader2, Navigation } from 'lucide-react';
import type { WorkflowStreamEvent } from '@/features/workflows/hooks/use-workflow-execution-stream';

export interface WorkflowExecutionFlamegraphProps {
  events: WorkflowStreamEvent[];
  activeTaskRef?: string | null;
  onHoverTask?: (taskRef: string | null) => void;
  onClickTask?: (taskRef: string) => void;
  // Bi-directional time travel scrubber sync
  currentStepIndex?: number;
  onSeekStep?: (stepIndex: number) => void;
  isLiveHead?: boolean;
}

interface TaskInterval {
  taskReferenceName: string;
  taskType: string;
  status: string;
  scheduledAt: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  waitMs: number;
  workerId?: string;
  error?: string;
  firstEventIndex: number;
  lastEventIndex: number;
}

export const WorkflowExecutionFlamegraph: React.FC<WorkflowExecutionFlamegraphProps> = ({
  events,
  activeTaskRef,
  onHoverTask,
  onClickTask,
  currentStepIndex,
  onSeekStep,
  isLiveHead = true,
}) => {
  // Aggregate task events into intervals and map to event indices
  const intervals: TaskInterval[] = useMemo(() => {
    const map = new Map<string, Partial<TaskInterval>>();

    events.forEach((ev, idx) => {
      const data = ev.data;
      if (!data?.taskReferenceName) return;
      const ref = data.taskReferenceName;
      const existing = map.get(ref) || {
        taskReferenceName: ref,
        taskType: data.taskType || 'SIMPLE',
        status: data.status || 'PENDING',
        scheduledAt: data.timestamp || Date.now(),
        startedAt: data.timestamp || Date.now(),
        endedAt: data.timestamp || Date.now(),
        durationMs: (data.durationMs as number) || 0,
        waitMs: 0,
        workerId: data.workerId as string | undefined,
        error: data.error as string | undefined,
        firstEventIndex: idx,
        lastEventIndex: idx,
      };

      existing.lastEventIndex = idx;

      if (data.status === 'SCHEDULED') {
        existing.scheduledAt = data.timestamp || existing.scheduledAt;
      }
      if (data.status === 'IN_PROGRESS' || data.status === 'RUNNING') {
        existing.startedAt = data.timestamp || existing.startedAt;
        existing.status = 'IN_PROGRESS';
      }
      if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'TIMED_OUT') {
        existing.endedAt = data.timestamp || existing.endedAt;
        existing.status = data.status;
        if (data.durationMs) existing.durationMs = data.durationMs as number;
        if (data.error) existing.error = data.error as string;
      }
      if (data.workerId) {
        existing.workerId = data.workerId as string;
      }

      map.set(ref, existing);
    });

    return Array.from(map.values()).map((t) => {
      const scheduled = t.scheduledAt || Date.now();
      const started = Math.max(t.startedAt || scheduled, scheduled);
      const ended = Math.max(t.endedAt || started, started);
      const durationMs = t.durationMs || Math.max(ended - started, 40);
      const waitMs = Math.max(started - scheduled, 0);

      return {
        taskReferenceName: t.taskReferenceName!,
        taskType: t.taskType || 'SIMPLE',
        status: t.status || 'COMPLETED',
        scheduledAt: scheduled,
        startedAt: started,
        endedAt: started + durationMs,
        durationMs,
        waitMs,
        workerId: t.workerId,
        error: t.error,
        firstEventIndex: t.firstEventIndex ?? 0,
        lastEventIndex: t.lastEventIndex ?? 0,
      };
    });
  }, [events]);

  if (intervals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-64 border border-dashed rounded-xl">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm font-medium">No concurrency timeline data available</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Execute tasks or scrub historical timeline events to inspect the concurrency waterfall.
        </p>
      </div>
    );
  }

  // Calculate timeline bounds
  const minTime = Math.min(...intervals.map((i) => i.scheduledAt));
  const maxTime = Math.max(...intervals.map((i) => i.endedAt));
  const totalSpanMs = Math.max(maxTime - minTime, 100);

  // Current scrubber cursor position as a percentage
  const scrubberTime =
    currentStepIndex !== undefined && events[currentStepIndex]?.data?.timestamp
      ? (events[currentStepIndex].data.timestamp as number)
      : null;

  const scrubberCursorPct =
    scrubberTime !== null
      ? Math.max(Math.min(((scrubberTime - minTime) / totalSpanMs) * 100, 100), 0)
      : null;

  const handleTaskClick = (interval: TaskInterval) => {
    // 1. Notify parent of task selection
    onClickTask?.(interval.taskReferenceName);
    // 2. Scrub timeline to this task's terminal or latest event
    if (onSeekStep && interval.lastEventIndex !== undefined) {
      onSeekStep(interval.lastEventIndex);
    }
  };

  return (
    <div
      className="p-4 rounded-xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl flex flex-col gap-3 relative"
      data-testid="workflow-flamegraph"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Concurrency Flamegraph & Task Execution Waterfall
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">
            {intervals.length} Tasks ({totalSpanMs}ms Span)
          </Badge>
          {!isLiveHead && scrubberTime && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1"
            >
              <Navigation className="w-2.5 h-2.5 text-amber-500" />
              Scrubbed: Step {currentStepIndex! + 1}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/30 border border-sky-500/50" />
            Queue Wait
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            Failed
          </span>
        </div>
      </div>

      {/* Waterfall Rows with Scrubber Playhead Line */}
      <div className="relative space-y-2 max-h-72 overflow-y-auto pr-1">
        {/* Playhead vertical needle line */}
        {scrubberCursorPct !== null && (
          <div
            style={{ left: `${scrubberCursorPct}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] z-20 pointer-events-none transition-all duration-150"
            data-testid="flamegraph-playhead-line"
          >
            <div className="w-2 h-2 -ml-[3px] rounded-full bg-amber-500 border border-white" />
          </div>
        )}

        {intervals.map((interval) => {
          const waitOffsetPct = ((interval.scheduledAt - minTime) / totalSpanMs) * 100;
          const waitWidthPct = Math.max((interval.waitMs / totalSpanMs) * 100, 0);

          const startOffsetPct = ((interval.startedAt - minTime) / totalSpanMs) * 100;
          const runWidthPct = Math.max((interval.durationMs / totalSpanMs) * 100, 2);

          const isHovered = activeTaskRef === interval.taskReferenceName;

          return (
            <div
              key={interval.taskReferenceName}
              onMouseEnter={() => onHoverTask?.(interval.taskReferenceName)}
              onMouseLeave={() => onHoverTask?.(null)}
              onClick={() => handleTaskClick(interval)}
              data-testid={`flamegraph-row-${interval.taskReferenceName}`}
              className={`group flex flex-col gap-1 p-1.5 rounded-lg transition-all cursor-pointer ${
                isHovered
                  ? 'bg-primary/10 ring-1 ring-primary/40'
                  : 'hover:bg-white/40 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {interval.status === 'COMPLETED' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : interval.status === 'FAILED' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin" />
                  )}
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {interval.taskReferenceName}
                  </span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                    {interval.taskType}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  {interval.workerId && (
                    <span className="flex items-center gap-0.5">
                      <Cpu className="w-2.5 h-2.5 text-primary/70" />
                      {interval.workerId}
                    </span>
                  )}
                  <span>{interval.durationMs}ms</span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="relative h-3 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
                {/* Wait Duration (Striped) */}
                {waitWidthPct > 0 && (
                  <div
                    style={{
                      left: `${waitOffsetPct}%`,
                      width: `${waitWidthPct}%`,
                    }}
                    className="absolute top-0 bottom-0 bg-sky-500/30 border-r border-sky-500/50"
                    title={`Queue Wait: ${interval.waitMs}ms`}
                  />
                )}

                {/* Execution Duration */}
                <div
                  style={{
                    left: `${startOffsetPct}%`,
                    width: `${runWidthPct}%`,
                  }}
                  className={`absolute top-0 bottom-0 rounded-sm shadow-sm transition-all ${
                    interval.status === 'COMPLETED'
                      ? 'bg-emerald-500'
                      : interval.status === 'FAILED'
                      ? 'bg-rose-500'
                      : 'bg-sky-500 animate-pulse'
                  }`}
                  title={`Execution Run: ${interval.durationMs}ms`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
