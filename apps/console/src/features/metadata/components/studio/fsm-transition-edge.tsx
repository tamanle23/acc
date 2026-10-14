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
 * Returns contextual icon for FSM transition actions.
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
    markerEnd,
    markerStart,
    style,
  }: EdgeProps<FsmEdgeData>) => {
    const multiIndex = data?.multiIndex ?? 0;
    const multiTotal = data?.multiTotal ?? 1;

    // Harmonious smooth bezier curvature based on distance and parallel fan-out
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Natural curvature dynamically proportional to span with gentle parallel fan-out
    const baseCurvature = Math.max(0.25, Math.min(0.5, dist / 900));
    const offsetFactor = multiTotal > 1 ? (multiIndex - (multiTotal - 1) / 2) * 0.18 : 0;
    const curvature = Math.max(0.15, Math.min(0.75, baseCurvature + offsetFactor));

    const [edgePath, rawLabelX, rawLabelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      curvature,
    });

    // Stagger label badges cleanly so multiple actions never occlude each other
    const labelYOffset = multiTotal > 1 ? (multiIndex - (multiTotal - 1) / 2) * 34 : 0;
    const labelXOffset = multiTotal > 1 && Math.abs(dx) < 60 ? (multiIndex - (multiTotal - 1) / 2) * 45 : 0;
    const labelX = rawLabelX + labelXOffset;
    const labelY = rawLabelY + labelYOffset;

    const ActionIcon = getActionIcon(data?.triggerEvent || '');

    const strokeColor = selected
      ? 'var(--primary)'
      : data?.isBackward
      ? 'oklch(0.65 0.20 25 / 75%)'
      : 'oklch(0.62 0.16 260 / 65%)';

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd || `url(#fsm-arrow-${selected ? 'active' : 'default'})`}
          markerStart={markerStart}
          style={{
            stroke: strokeColor,
            strokeWidth: selected ? 2.5 : 2,
            strokeDasharray: data?.guardExpression ? '6, 4' : undefined,
            transition: 'stroke 0.2s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            ...style,
          }}
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: selected ? 30 : 20,
            }}
            className="nodrag nopan"
          >
            <button
              type="button"
              className={cn(
                'group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold tracking-tight select-none cursor-pointer',
                'backdrop-blur-2xl border transition-all duration-200',
                'shadow-lg shadow-black/10 dark:shadow-black/40',
                'shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]',
                selected
                  ? 'bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/30 scale-110 ring-2 ring-primary/40'
                  : 'bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 text-foreground border-white/60 dark:border-white/15 hover:border-primary/60 hover:scale-105'
              )}
            >
              <div className="p-0.5 rounded-full bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 group-hover:scale-115 transition-transform">
                <ActionIcon className="h-3 w-3 shrink-0" />
              </div>
              <span className="font-semibold tracking-tight">{data?.triggerEvent || id}</span>

              {/* Multi-action stack indicator */}
              {multiTotal > 1 && (
                <span className="flex items-center gap-0.5 text-[8px] font-mono px-1.5 py-0.2 rounded-md bg-muted/80 text-muted-foreground border border-border/30">
                  <Layers className="h-2.5 w-2.5" />
                  <span>{multiIndex + 1}/{multiTotal}</span>
                </span>
              )}

              {/* Pulsing SpEL Guard Indicator */}
              {data?.guardExpression && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 ring-2 ring-amber-400/40"
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
