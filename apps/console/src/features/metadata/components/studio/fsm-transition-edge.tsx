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
      curvature: 0.25,
    });

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: selected ? '#38BDF8' : '#818CF8',
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
                'group flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-tight shadow-lg transition-all',
                'cursor-pointer active:scale-95',
                selected
                  ? 'bg-sky-500 text-white shadow-sky-500/40 ring-2 ring-sky-300 scale-105'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-sky-200 border border-sky-500/40 shadow-black/40'
              )}
            >
              <span>{data?.triggerEvent || id}</span>
              {data?.guardExpression && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Protected by SpEL Guard" />
              )}
            </button>
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }
);

FsmTransitionEdgeComponent.displayName = 'FsmTransitionEdgeComponent';
