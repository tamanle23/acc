import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { FsmStateNode } from './studio-types';

export interface FsmNodeData extends FsmStateNode {
  isCurrent?: boolean;
}

export const FsmStateNodeComponent = memo(({ data, selected }: NodeProps<FsmNodeData>) => {
  return (
    <div
      className={cn(
        'group relative px-4 py-3 min-w-[160px] rounded-2xl backdrop-blur-xl border transition-all duration-200 select-none',
        'shadow-xl shadow-black/5 dark:shadow-black/30',
        'shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
        data.isInitial
          ? 'bg-sky-500/15 dark:bg-sky-500/20 border-sky-400/40 dark:border-sky-400/30'
          : data.isTerminal
          ? 'bg-rose-500/15 dark:bg-rose-500/20 border-rose-400/40 dark:border-rose-400/30'
          : 'bg-white/75 dark:bg-slate-900/75 border-white/40 dark:border-white/10',
        selected
          ? 'ring-2 ring-primary border-primary scale-105 shadow-2xl shadow-primary/20'
          : 'hover:scale-[1.02] hover:border-white/60 dark:hover:border-white/25',
        'cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Target handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-sky-400 !border-2 !border-white dark:!border-slate-900 !rounded-full -left-1.5 transition-transform hover:scale-150 shadow-xs"
      />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-2 ring-white/50 dark:ring-black/50"
            style={{ backgroundColor: data.color || '#38BDF8' }}
          />
          <span className="text-xs font-bold tracking-tight text-foreground truncate">
            {data.label}
          </span>
        </div>

        {data.isInitial ? (
          <span className="px-1.5 py-0.2 rounded-md text-[9px] font-mono font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/30">
            INIT
          </span>
        ) : data.isTerminal ? (
          <span className="px-1.5 py-0.2 rounded-md text-[9px] font-mono font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-400/30">
            TERM
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px]">
        <span className="font-mono text-muted-foreground uppercase tracking-wider font-semibold">
          {data.id}
        </span>
        <span className="text-[9px] text-muted-foreground/75 italic truncate max-w-[80px]">
          {data.description || 'State'}
        </span>
      </div>

      {/* Source handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-white dark:!border-slate-900 !rounded-full -right-1.5 transition-transform hover:scale-150 shadow-xs"
      />
    </div>
  );
});

FsmStateNodeComponent.displayName = 'FsmStateNodeComponent';
