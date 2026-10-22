import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { cn } from '@/lib/utils';
import { GitBranch, Zap, Plus } from 'lucide-react';

export interface DagConditionEdgeData {
  condition?: string;
  decisionCase?: string;
  isDefaultCase?: boolean;
  routingMode?: 'bezier' | 'smoothstep';
  onEditEdge?: (edgeId: string) => void;
  onSplitEdge?: (edgeId: string, position?: { x: number; y: number }) => void;
  [key: string]: unknown;
}

export const DagConditionEdge = memo(
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
    markerEnd,
    markerStart,
    style,
    label,
  }: EdgeProps) => {
    const edgeData = data as DagConditionEdgeData | undefined;
    const isSmoothstep = edgeData?.routingMode === 'smoothstep';

    const [edgePath, labelX, labelY] = isSmoothstep
      ? getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 8,
        })
      : getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
        });

    const displayLabel =
      (label as string) ||
      edgeData?.decisionCase ||
      (edgeData?.isDefaultCase ? 'DEFAULT' : edgeData?.condition);

    const handleLabelClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (edgeData?.onEditEdge) {
        edgeData.onEditEdge(id);
      }
    };

    const handleSplitClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (edgeData?.onSplitEdge) {
        edgeData.onSplitEdge(id, { x: e.clientX, y: e.clientY });
      }
    };

    const hasControls = Boolean(displayLabel || edgeData?.onSplitEdge);

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          markerStart={markerStart}
          style={{
            ...style,
            strokeWidth: selected ? 2.5 : 2,
            stroke: selected ? '#6366f1' : undefined,
          }}
        />
        {hasControls && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan flex items-center gap-1 group/edge-ctrl"
            >
              {displayLabel && (
                <button
                  type="button"
                  onClick={handleLabelClick}
                  className={cn(
                    'group flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all shadow-sm',
                    'backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border border-white/40 dark:border-white/10 text-foreground',
                    'hover:bg-primary/10 hover:border-primary/50 hover:text-primary hover:scale-105 active:scale-95',
                    edgeData?.isDefaultCase &&
                      'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                  )}
                  title="Click to configure branch condition or switch case"
                  data-testid={`dag-edge-label-${id}`}
                >
                  {edgeData?.isDefaultCase ? (
                    <Zap className="w-2.5 h-2.5 text-amber-500" />
                  ) : (
                    <GitBranch className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary" />
                  )}
                  <span className="truncate max-w-[120px]">{displayLabel}</span>
                </button>
              )}
              {edgeData?.onSplitEdge && (
                <button
                  type="button"
                  onClick={handleSplitClick}
                  className={cn(
                    'p-1 rounded-full text-muted-foreground transition-all shadow-sm opacity-70 hover:opacity-100',
                    'backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border border-white/40 dark:border-white/10',
                    'hover:bg-primary/10 hover:border-primary/50 hover:text-primary hover:scale-110 active:scale-95'
                  )}
                  title="Insert task node along this edge"
                  data-testid={`dag-edge-split-${id}`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }
);

DagConditionEdge.displayName = 'DagConditionEdge';
