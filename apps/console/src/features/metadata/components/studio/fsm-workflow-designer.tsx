import React, { useState } from 'react';
import type { FsmStateNode, FsmTransitionEdge, FsmWorkflowDefinition } from './studio-types';
import { GitFork, ArrowRight, ShieldAlert, Sparkles, Plus, Play, RefreshCw, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export const DEFAULT_FSM_STATES: FsmStateNode[] = [
  { id: 'DRAFT', label: 'Draft', isInitial: true, color: '#94A3B8', description: 'Initial uncommitted state' },
  { id: 'SUBMITTED', label: 'Submitted', color: '#38BDF8', description: 'Under review by domain operator' },
  { id: 'APPROVED', label: 'Approved', color: '#34D399', description: 'Authorized and validated' },
  { id: 'PUBLISHED', label: 'Published', color: '#818CF8', description: 'Live operational record' },
  { id: 'ARCHIVED', label: 'Archived', isTerminal: true, color: '#F472B6', description: 'Soft-deleted or deprecated' },
];

export const DEFAULT_FSM_TRANSITIONS: FsmTransitionEdge[] = [
  {
    id: 't-draft-submit',
    sourceState: 'DRAFT',
    targetState: 'SUBMITTED',
    triggerEvent: 'SUBMIT',
    label: 'Submit for Review',
    guardExpression: "attributes['total_amount'] != null",
    requiredRole: 'TENANT_OPERATOR',
    actionType: 'AUDIT_LOG',
  },
  {
    id: 't-submit-approve',
    sourceState: 'SUBMITTED',
    targetState: 'APPROVED',
    triggerEvent: 'APPROVE',
    label: 'Approve Record',
    guardExpression: "attributes['total_amount'] < 50000",
    requiredRole: 'TENANT_ADMIN',
    actionType: 'NOTIFICATION_DISPATCH',
  },
  {
    id: 't-approve-publish',
    sourceState: 'APPROVED',
    targetState: 'PUBLISHED',
    triggerEvent: 'PUBLISH',
    label: 'Publish Live',
    guardExpression: "attributes['is_verified'] == true",
    requiredRole: 'TENANT_ADMIN',
    actionType: 'OUTBOX_EVENT_EMIT',
  },
  {
    id: 't-publish-archive',
    sourceState: 'PUBLISHED',
    targetState: 'ARCHIVED',
    triggerEvent: 'ARCHIVE',
    label: 'Deprecate Record',
    requiredRole: 'TENANT_ADMIN',
    actionType: 'CLEANUP_INDEX',
  },
];

interface Props {
  entityTypeName: string;
  workflow?: FsmWorkflowDefinition;
  onSaveWorkflow?: (def: FsmWorkflowDefinition) => void;
}

export const FsmWorkflowDesigner: React.FC<Props> = ({
  entityTypeName,
  workflow,
  onSaveWorkflow,
}) => {
  const [states, setStates] = useState<FsmStateNode[]>(workflow?.states || DEFAULT_FSM_STATES);
  const [transitions, setTransitions] = useState<FsmTransitionEdge[]>(
    workflow?.transitions || DEFAULT_FSM_TRANSITIONS
  );
  const [selectedTransitionId, setSelectedTransitionId] = useState<string>(
    transitions[0]?.id || ''
  );

  const selectedTransition = transitions.find((t) => t.id === selectedTransitionId) || transitions[0];

  const handleUpdateTransition = (updated: Partial<FsmTransitionEdge>) => {
    if (!selectedTransition) return;
    setTransitions((prev) =>
      prev.map((t) => (t.id === selectedTransition.id ? { ...t, ...updated } : t))
    );
  };

  // Node positions in circular / sequential DAG layout
  const width = 760;
  const height = 360;
  const nodeWidth = 120;
  const nodeHeight = 56;
  const positions: Record<string, { x: number; y: number }> = {};

  states.forEach((state, idx) => {
    const total = states.length;
    // Sequential curved pipeline
    const x = 50 + (idx / (total - 1)) * (width - 100 - nodeWidth);
    const y = height / 2 - nodeHeight / 2 + (idx % 2 === 0 ? -35 : 35);
    positions[state.id] = { x, y };
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Visual Canvas Area */}
      <div className="relative w-full h-[400px] rounded-3xl bg-slate-950/30 dark:bg-slate-950/60 backdrop-blur-2xl border border-white/20 dark:border-white/10 overflow-hidden shadow-2xl flex flex-col">
        {/* Canvas Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <Badge className="bg-primary/20 text-primary border-primary/30 backdrop-blur-md px-2.5 py-1 text-xs font-semibold gap-1.5 shadow-sm">
            <Zap className="h-3.5 w-3.5" />
            <span>FSM Workflow: {entityTypeName}</span>
          </Badge>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Click edge or transition to inspect SpEL guards
          </span>
        </div>

        {/* SVG Diagram Connections */}
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
          <defs>
            <linearGradient id="fsmEdgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#818CF8" stopOpacity="0.8" />
            </linearGradient>
            <marker
              id="fsmArrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#818CF8" />
            </marker>
          </defs>

          {transitions.map((trans) => {
            const src = positions[trans.sourceState];
            const dst = positions[trans.targetState];
            if (!src || !dst) return null;

            const isSelected = selectedTransition?.id === trans.id;
            const sx = src.x + nodeWidth;
            const sy = src.y + nodeHeight / 2;
            const tx = dst.x;
            const ty = dst.y + nodeHeight / 2;
            const mx = (sx + tx) / 2;
            const my = (sy + ty) / 2 - 25;

            return (
              <g
                key={trans.id}
                onClick={() => setSelectedTransitionId(trans.id)}
                className="cursor-pointer group"
              >
                <path
                  d={`M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`}
                  fill="none"
                  stroke={isSelected ? '#38BDF8' : 'url(#fsmEdgeGradient)'}
                  strokeWidth={isSelected ? '3' : '2'}
                  strokeDasharray={trans.guardExpression ? '5 3' : undefined}
                  markerEnd="url(#fsmArrow)"
                  className="transition-all duration-200"
                />
                {/* Edge Label */}
                <foreignObject x={mx - 50} y={my - 16} width="100" height="28">
                  <div className="flex items-center justify-center">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-tight shadow-md transition-all',
                        isSelected
                          ? 'bg-sky-500 text-white shadow-sky-500/30 ring-2 ring-sky-300'
                          : 'bg-slate-900/90 text-sky-200 border border-sky-500/30'
                      )}
                    >
                      {trans.triggerEvent}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {/* State Machine Nodes */}
        {states.map((state) => {
          const pos = positions[state.id];
          if (!pos) return null;

          return (
            <div
              key={state.id}
              style={{
                position: 'absolute',
                left: `${(pos.x / width) * 100}%`,
                top: `${(pos.y / height) * 100}%`,
                width: `${(nodeWidth / width) * 100}%`,
              }}
              className={cn(
                'p-2.5 rounded-2xl backdrop-blur-xl border flex flex-col items-center justify-center text-center shadow-lg transition-all hover:scale-105',
                state.isInitial
                  ? 'bg-sky-500/15 border-sky-400/40 text-sky-300 shadow-sky-500/10'
                  : state.isTerminal
                  ? 'bg-pink-500/15 border-pink-400/40 text-pink-300 shadow-pink-500/10'
                  : 'bg-white/70 dark:bg-slate-900/80 border-white/30 dark:border-white/10 text-foreground'
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: state.color }} />
                <span className="text-xs font-bold tracking-tight">{state.label}</span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground uppercase">
                {state.id}
              </span>
            </div>
          );
        })}
      </div>

      {/* Transition Guard & Action Inspector */}
      {selectedTransition && (
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <GitFork className="h-4 w-4 text-sky-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Transition Rule: {selectedTransition.sourceState} → {selectedTransition.targetState}
              </h4>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono bg-sky-500/10 text-sky-700 dark:text-sky-300">
              EVENT: {selectedTransition.triggerEvent}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Guard Expression */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                <span>SpEL Guard Expression</span>
                <span className="text-[10px] text-sky-500 font-mono">attributes['field'] condition</span>
              </Label>
              <Input
                value={selectedTransition.guardExpression || ''}
                placeholder="attributes['total_amount'] < 50000"
                onChange={(e) => handleUpdateTransition({ guardExpression: e.target.value })}
                className="h-8 text-xs font-mono bg-white/70 dark:bg-slate-800/70 border-white/30"
              />
              <p className="text-[10px] text-muted-foreground">
                Evaluated atomically by Spring Boot prior to transition commit. Rejects invalid requests with 422.
              </p>
            </div>

            {/* Transactional Outbox Action */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Transactional Outbox Action
              </Label>
              <Input
                value={selectedTransition.actionType || ''}
                placeholder="e.g. NOTIFICATION_DISPATCH"
                onChange={(e) => handleUpdateTransition({ actionType: e.target.value })}
                className="h-8 text-xs font-mono bg-white/70 dark:bg-slate-800/70 border-white/30"
              />
              <p className="text-[10px] text-muted-foreground">
                Side-effect staged atomically in outbox_events to avoid dual-write hazards.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
