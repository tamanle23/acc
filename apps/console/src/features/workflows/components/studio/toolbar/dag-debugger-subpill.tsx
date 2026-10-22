import React from 'react';
import { Button } from '@/components/ui/button';
import { Bug, Pause, StepForward, Play, Braces } from 'lucide-react';

export interface DagDebuggerSubpillProps {
  top: number;
  breakpointsCount: number;
  onPause: () => void;
  onStepOver: () => void;
  onResume: () => void;
  isVariableWatchOpen: boolean;
  onToggleVariableWatch: () => void;
}

export const DagDebuggerSubpill: React.FC<DagDebuggerSubpillProps> = ({
  top,
  breakpointsCount,
  onPause,
  onStepOver,
  onResume,
  isVariableWatchOpen,
  onToggleVariableWatch,
}) => {
  return (
    <div
      data-testid="dag-execution-debugger-subpill"
      style={{ top: `${top}px` }}
      className="absolute left-3 z-10 flex items-center gap-1.5 p-1.5 px-2.5 rounded-xl backdrop-blur-xl bg-amber-500/10 border border-amber-500/30 shadow-lg text-amber-700 dark:text-amber-300 max-w-[calc(100%-1.5rem)] overflow-x-auto scrollbar-none animate-in fade-in slide-in-from-top-1"
    >
      <div className="flex items-center gap-1 mr-1 shrink-0">
        <Bug className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider hidden xs:inline">
          Debugger {breakpointsCount > 0 ? `(${breakpointsCount} BP)` : ''}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider xs:hidden">Debug</span>
      </div>

      <div className="h-3 w-[1px] bg-amber-500/30" />

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onPause}
        className="h-6 px-1.5 text-[10px] gap-1 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200"
        title="Pause execution before next task"
        data-testid="debugger-pause-btn"
      >
        <Pause className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        Pause
      </Button>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onStepOver}
        className="h-6 px-1.5 text-[10px] gap-1 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200"
        title="Step Over single frontier task"
        data-testid="debugger-step-btn"
      >
        <StepForward className="w-3 h-3 text-sky-500" />
        Step Over
      </Button>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onResume}
        className="h-6 px-1.5 text-[10px] gap-1 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200"
        title="Resume workflow execution"
        data-testid="debugger-resume-btn"
      >
        <Play className="w-3 h-3 text-emerald-500" />
        Resume
      </Button>

      <div className="h-3 w-[1px] bg-amber-500/30" />

      <Button
        type="button"
        size="sm"
        variant={isVariableWatchOpen ? 'default' : 'ghost'}
        onClick={onToggleVariableWatch}
        className="h-6 px-1.5 text-[10px] gap-1 hover:bg-amber-500/20"
        title="Toggle Live Variable Watch & State Diff Drawer"
        data-testid="debugger-variable-watch-btn"
      >
        <Braces className="w-3 h-3" />
        Watch
      </Button>
    </div>
  );
};
