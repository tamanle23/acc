import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { FsmTransitionEdge } from './studio-types';
import {
  Send,
  ShieldCheck,
  Rocket,
  Zap,
  PauseCircle,
  RotateCcw,
  Archive,
  Ban,
  Check,
  Play,
  Layers,
} from 'lucide-react';

export interface FsmEdgeData extends FsmTransitionEdge {
  multiIndex?: number;
  multiTotal?: number;
  hasSiblings?: boolean;
}

/**
 * Returns contextual icon and styling for FSM transition actions.
 */
function getActionIcon(action: string) {
  const norm = action.toUpperCase();
  if (norm.includes('SUBMIT') || norm.includes('SEND')) return Send;
  if (norm.includes('APPROVE') || norm.includes('VERIFY')) return ShieldCheck;
  if (norm.includes('ACTIVATE') || norm.includes('PROVISION') || norm.includes('PUBLISH') || norm.includes('DEPLOY')) return Rocket;
  if (norm.includes('ENFORCE') || norm.includes('STAGE')) return Zap;
  if (norm.includes('SUSPEND') || norm.includes('PAUSE') || norm.includes('HOLD')) return PauseCircle;
  if (norm.includes('REACTIVATE') || norm.includes('RESUME') || norm.includes('REINSTATE')) return RotateCcw;
  if (norm.includes('ARCHIVE') || norm.includes('RETIRE') || norm.includes('DEPRECATE')) return Archive;
  if (norm.includes('REJECT') || norm.includes('CANCEL') || norm.includes('TERMINATE') || norm.includes('DECOMMISSION')) return Ban;
  if (norm.includes('APPROV') || norm.includes('SUCCESS')) return Check;
  return Play;
}

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
    // Dynamic curvature and offset calculation for parallel multi-action edges
    const multiIndex = data?.multiIndex ?? 0;
    const multiTotal = data?.multiTotal ?? 1;

    // Distribute curvature symmetrically around standard 0.3
    const baseCurvature = 0.3;
    const offsetFactor = multiTotal > 1 ? (multiIndex - (multiTotal - 1) / 2) * 0.16 : 0;
    const curvature = Math.max(0.12, Math.min(0.65, baseCurvature + offsetFactor));

    const [edgePath, rawLabelX, rawLabelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      curvature,
    });

    // Shift label along vertical axis when there are parallel edges between same pair of nodes
    const labelYOffset = multiTotal > 1 ? (multiIndex - (multiTotal - 1) / 2) * 32 : 0;
    const labelX = rawLabelX;
    const labelY = rawLabelY + labelYOffset;

    const ActionIcon = getActionIcon(data?.triggerEvent || '');

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
                'group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-tight shadow-md transition-all duration-200 select-none cursor-pointer',
                'backdrop-blur-xl border',
                selected
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30 scale-105 ring-2 ring-primary/40'
                  : 'bg-white/85 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 text-foreground border-white/50 dark:border-white/10 hover:border-primary/50 shadow-black/5 hover:scale-105'
              )}
            >
              <ActionIcon className="h-3 w-3 shrink-0 text-sky-500 dark:text-sky-400 group-hover:scale-110 transition-transform" />
              <span>{data?.triggerEvent || id}</span>

              {/* Multi-action stack indicator */}
              {multiTotal > 1 && (
                <span className="flex items-center gap-0.5 text-[8px] font-mono px-1 py-0.2 rounded bg-muted/80 text-muted-foreground">
                  <Layers className="h-2 w-2" />
                  <span>{multiIndex + 1}/{multiTotal}</span>
                </span>
              )}

              {/* Pulsing SpEL Guard Indicator */}
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
