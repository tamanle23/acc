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

export type EdgeExecutionFlowState =
  | 'IDLE'
  | 'ACTIVE_FLOW'
  | 'COMPLETED_PATH'
  | 'BYPASSED_PATH'
  | 'FAILED_PATH';

export interface DagConditionEdgeData {
  condition?: string;
  decisionCase?: string;
  isDefaultCase?: boolean;
  routingMode?: 'bezier' | 'smoothstep';
  executionFlowState?: EdgeExecutionFlowState;
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
    const flowState: EdgeExecutionFlowState = edgeData?.executionFlowState || 'IDLE';

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

    // Compute stroke styling based on multi-state execution semantics
    const computedBaseStyle = (): React.CSSProperties => {
      if (flowState === 'ACTIVE_FLOW') {
        return {
          ...style,
          stroke: '#10b981',
          strokeWidth: selected ? 3.5 : 2.5,
          strokeOpacity: 0.45,
          filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.55))',
        };
      }
      if (flowState === 'COMPLETED_PATH') {
        return {
          ...style,
          stroke: '#10b981',
          strokeWidth: selected ? 3 : 2.5,
          filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.35))',
        };
      }
      if (flowState === 'FAILED_PATH') {
        return {
          ...style,
          stroke: '#f43f5e',
          strokeWidth: selected ? 3 : 2.5,
          filter: 'drop-shadow(0 0 6px rgba(244, 63, 94, 0.5))',
        };
      }
      if (flowState === 'BYPASSED_PATH') {
        return {
          ...style,
          stroke: '#94a3b8',
          strokeWidth: 1.5,
          strokeDasharray: '4 4',
          opacity: 0.35,
        };
      }
      return {
        ...style,
        strokeWidth: selected ? 2.5 : 2,
        stroke: selected ? '#6366f1' : style?.stroke,
      };
    };

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          markerStart={markerStart}
          style={computedBaseStyle()}
        />

        {/* Animated SVG Particle Stream for ACTIVE_FLOW */}
        {flowState === 'ACTIVE_FLOW' && (
          <path
            d={edgePath}
            fill="none"
            stroke="#34d399"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="6 14"
            className="pointer-events-none"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.9))',
              animation: 'dagEdgeParticleStream 0.65s linear infinite',
            }}
            data-testid={`dag-edge-particles-${id}`}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="20"
              to="0"
              dur="0.65s"
              repeatCount="indefinite"
            />
          </path>
        )}

        {hasControls && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
              }}
              className={cn(
                'nodrag nopan flex items-center gap-1 group/edge-ctrl transition-opacity',
                flowState === 'BYPASSED_PATH' && 'opacity-40'
              )}
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
                      'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10',
                    flowState === 'ACTIVE_FLOW' &&
                      'border-emerald-500/50 text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
                    flowState === 'COMPLETED_PATH' &&
                      'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
                    flowState === 'FAILED_PATH' &&
                      'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10'
                  )}
                  title="Click to configure branch condition or switch case"
                  data-testid={`dag-edge-label-${id}`}
                >
                  {edgeData?.isDefaultCase ? (
                    <Zap className="w-2.5 h-2.5 text-amber-500" />
                  ) : (
                    <GitBranch
                      className={cn(
                        'w-2.5 h-2.5 text-muted-foreground group-hover:text-primary',
                        (flowState === 'ACTIVE_FLOW' || flowState === 'COMPLETED_PATH') &&
                          'text-emerald-500',
                        flowState === 'FAILED_PATH' && 'text-rose-500'
                      )}
                    />
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
