import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Play, Split, GitMerge, Clock, Repeat, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export type DagNodeType = 'SIMPLE' | 'SWITCH' | 'FORK_JOIN' | 'WAIT' | 'DO_WHILE';
export type ExecutionState = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED';

export interface DagNodeData {
  taskReferenceName: string;
  taskType: DagNodeType;
  label?: string;
  description?: string;
  executionState?: ExecutionState;
  inputParameters?: Record<string, unknown>;
  retryCount?: number;
  timeoutSeconds?: number;
  condition?: string;
}

// Aliases for backward compatibility if imported elsewhere
export type ConductorNodeType = DagNodeType;
export type ConductorNodeData = DagNodeData;

export const DagWorkflowNodeComponent = memo(({ data, selected }: NodeProps<DagNodeData>) => {
  const getNodeIcon = () => {
    switch (data.taskType) {
      case 'SWITCH':
        return <Split className="w-4 h-4 text-amber-500" />;
      case 'FORK_JOIN':
        return <GitMerge className="w-4 h-4 text-indigo-500" />;
      case 'WAIT':
        return <Clock className="w-4 h-4 text-sky-500" />;
      case 'DO_WHILE':
        return <Repeat className="w-4 h-4 text-emerald-500" />;
      case 'SIMPLE':
      default:
        return <Play className="w-4 h-4 text-primary" />;
    }
  };

  const getStatusBadge = () => {
    switch (data.executionState) {
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-full border border-sky-500/20 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            RUNNING
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-full">
            {data.taskType}
          </span>
        );
    }
  };

  return (
    <div
      className={cn(
        'group relative px-4 py-3 min-w-[200px] rounded-2xl backdrop-blur-xl border transition-all duration-200 select-none',
        'shadow-xl shadow-black/5 dark:shadow-black/30',
        'shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
        'bg-white/75 dark:bg-slate-900/75 border-white/40 dark:border-white/10',
        data.executionState === 'COMPLETED' && 'border-emerald-500/40 bg-emerald-500/5',
        data.executionState === 'IN_PROGRESS' && 'border-sky-500/50 bg-sky-500/5 ring-1 ring-sky-500/30',
        data.executionState === 'FAILED' && 'border-rose-500/50 bg-rose-500/5',
        selected ? 'ring-2 ring-primary border-primary scale-105' : 'hover:scale-[1.02]',
        'cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Target Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-white dark:border-slate-900 -left-1.5"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
            {getNodeIcon()}
          </div>
          <span className="text-xs font-bold tracking-tight text-foreground truncate max-w-[120px]">
            {data.label || data.taskReferenceName}
          </span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Body details */}
      <div className="text-[11px] text-muted-foreground line-clamp-1 mb-1">
        Ref: <span className="font-mono text-[10px] text-foreground/80">{data.taskReferenceName}</span>
      </div>

      {data.timeoutSeconds && (
        <div className="text-[10px] text-muted-foreground/70">
          Timeout: {data.timeoutSeconds}s {data.retryCount ? `· Retries: ${data.retryCount}` : ''}
        </div>
      )}

      {/* Source Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-white dark:border-slate-900 -right-1.5"
      />
    </div>
  );
});

DagWorkflowNodeComponent.displayName = 'DagWorkflowNodeComponent';
export const ConductorWorkflowNodeComponent = DagWorkflowNodeComponent;
