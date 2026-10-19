import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { FsmStateNode } from './studio-types';

export interface DynamicHandleConfig {
  id: string;
  type: 'source' | 'target';
  position: Position;
  offsetPct: number; // 0 to 100 percentage along the side
  actionName?: string;
  label?: string;
}

export interface FsmNodeData extends FsmStateNode, Record<string, unknown> {
  isCurrent?: boolean;
  incomingHandles?: DynamicHandleConfig[];
  outgoingHandles?: DynamicHandleConfig[];
}

export const FsmStateNodeComponent = memo(({ data: rawData, selected }: NodeProps | any) => {
  const data = (rawData || {}) as FsmNodeData;
  const incoming = data.incomingHandles || [
    { id: 'target-left', type: 'target', position: Position.Left, offsetPct: 50 },
  ];
  const outgoing = data.outgoingHandles || [
    { id: 'source-right', type: 'source', position: Position.Right, offsetPct: 50 },
  ];

  const getHandleStyle = (handle: DynamicHandleConfig) => {
    switch (handle.position) {
      case Position.Top:
        return { left: `${handle.offsetPct}%`, top: '-4px' };
      case Position.Bottom:
        return { left: `${handle.offsetPct}%`, bottom: '-4px' };
      case Position.Left:
        return { top: `${handle.offsetPct}%`, left: '-4px' };
      case Position.Right:
        return { top: `${handle.offsetPct}%`, right: '-4px' };
    }
  };

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
      {/* Dynamically Generated Ingress (Target) Handles based on Lifecycle Config */}
      {incoming.map((h) => (
        <Handle
          key={h.id}
          type="target"
          id={h.id}
          position={h.position}
          style={getHandleStyle(h)}
          className="!w-2.5 !h-2.5 !bg-sky-400 !border-2 !border-white dark:!border-slate-900 !rounded-full transition-transform hover:scale-150 shadow-xs z-10"
          title={h.label || `Ingress: ${h.id}`}
        />
      ))}

      {/* State Node Content */}
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

      {/* Dynamically Generated Egress (Source) Handles based on Lifecycle Config */}
      {outgoing.map((h) => (
        <Handle
          key={h.id}
          type="source"
          id={h.id}
          position={h.position}
          style={getHandleStyle(h)}
          className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-white dark:!border-slate-900 !rounded-full transition-transform hover:scale-150 shadow-xs z-10"
          title={h.label || `Egress Action: ${h.actionName || h.id}`}
        />
      ))}
    </div>
  );
});

FsmStateNodeComponent.displayName = 'FsmStateNodeComponent';
