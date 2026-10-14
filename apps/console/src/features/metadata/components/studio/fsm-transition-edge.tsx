import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { FsmTransitionEdge } from './studio-types';

export interface FsmEdgeData extends FsmTransitionEdge {}

export const FsmTransitionEdgeComponent = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  }: EdgeProps<FsmEdgeData>) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      curvature: 0.3,
    });

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: selected ? 'var(--primary)' : 'oklch(0.65 0.15 260 / 60%)',
            strokeWidth: selected ? 2.5 : 1.75,
            strokeDasharray: data?.guardExpression ? '6, 4' : undefined,
            transition: 'stroke 0.2s, stroke-width 0.2s',
          }}
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              type="button"
              className={cn(
                'group flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-tight shadow-md transition-all duration-200 select-none cursor-pointer',
                'backdrop-blur-xl border',
                selected
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30 scale-105 ring-2 ring-primary/40'
                  : 'bg-white/80 dark:bg-slate-900/85 hover:bg-white dark:hover:bg-slate-900 text-foreground border-white/40 dark:border-white/10 hover:border-primary/50 shadow-black/5 hover:scale-105'
              )}
            >
              <span>{data?.triggerEvent || id}</span>
              {data?.guardExpression && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0 ring-1 ring-amber-400/50"
                  title={`Protected by SpEL Guard: ${data.guardExpression}`}
                />
              )}
            </button>
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }
);

FsmTransitionEdgeComponent.displayName = 'FsmTransitionEdgeComponent';
