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
        'relative px-4 py-3 min-w-[140px] rounded-2xl backdrop-blur-xl border flex flex-col items-center justify-center text-center shadow-lg transition-all',
        data.isInitial
          ? 'bg-sky-500/20 border-sky-400/50 text-sky-200 shadow-sky-500/20'
          : data.isTerminal
          ? 'bg-pink-500/20 border-pink-400/50 text-pink-200 shadow-pink-500/20'
          : 'bg-slate-900/80 border-white/20 text-foreground',
        selected && 'ring-2 ring-sky-400 border-sky-400 scale-105 shadow-xl shadow-sky-500/25',
        'hover:scale-102 hover:border-white/40 cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Target input handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-sky-400 !border-2 !border-slate-950 !rounded-full -left-1.5 transition-transform hover:scale-125"
      />

      {/* State Badge and Color Accent */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
          style={{ backgroundColor: data.color || '#38BDF8' }}
        />
        <span className="text-xs font-bold tracking-tight text-white">{data.label}</span>
      </div>

      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        {data.id}
      </span>

      {data.isInitial && (
        <span className="mt-1 px-1.5 py-0.2 rounded text-[8px] font-mono bg-sky-400/20 text-sky-300 border border-sky-400/30">
          INITIAL
        </span>
      )}
      {data.isTerminal && (
        <span className="mt-1 px-1.5 py-0.2 rounded text-[8px] font-mono bg-pink-400/20 text-pink-300 border border-pink-400/30">
          TERMINAL
        </span>
      )}

      {/* Source output handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-950 !rounded-full -right-1.5 transition-transform hover:scale-125"
      />
    </div>
  );
});

FsmStateNodeComponent.displayName = 'FsmStateNodeComponent';
