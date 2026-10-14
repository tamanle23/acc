import React, { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import type { FsmStateNode, FsmTransitionEdge, FsmWorkflowDefinition } from './studio-types';
import { FsmStateNodeComponent, type FsmNodeData } from './fsm-state-node';
import { FsmTransitionEdgeComponent, type FsmEdgeData } from './fsm-transition-edge';
import { GitFork, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

const nodeTypes = {
  fsmState: FsmStateNodeComponent,
};

const edgeTypes = {
  fsmTransition: FsmTransitionEdgeComponent,
};

export const FsmWorkflowDesigner: React.FC<Props> = ({
  entityTypeName,
  workflow,
}) => {
  const initialStates = workflow?.states || DEFAULT_FSM_STATES;
  const initialTransitions = workflow?.transitions || DEFAULT_FSM_TRANSITIONS;

  // Compute clean initial layout: horizontal DAG layout with alternate vertical stagger
  const initialNodes: Node<FsmNodeData>[] = useMemo(() => {
    const spacingX = 220;
    return initialStates.map((state, index) => ({
      id: state.id,
      type: 'fsmState',
      position: {
        x: 60 + index * spacingX,
        y: index % 2 === 0 ? 100 : 170,
      },
      data: state,
    }));
  }, [initialStates]);

  const initialEdges: Edge<FsmEdgeData>[] = useMemo(() => {
    return initialTransitions.map((t) => ({
      id: t.id,
      source: t.sourceState,
      target: t.targetState,
      type: 'fsmTransition',
      data: t,
    }));
  }, [initialTransitions]);

  const [nodes, setNodes] = useState<Node<FsmNodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge<FsmEdgeData>[]>(initialEdges);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string>(
    initialTransitions[0]?.id || ''
  );

  const onNodesChange: OnNodesChange<Node<FsmNodeData>> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange<Edge<FsmEdgeData>> = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    if (params.edges.length > 0) {
      setSelectedTransitionId(params.edges[0].id);
    }
  }, []);

  const selectedTransition = useMemo(() => {
    const edge = edges.find((e) => e.id === selectedTransitionId);
    return edge?.data || initialTransitions.find((t) => t.id === selectedTransitionId) || initialTransitions[0];
  }, [edges, selectedTransitionId, initialTransitions]);

  const handleUpdateTransition = (updated: Partial<FsmTransitionEdge>) => {
    if (!selectedTransition) return;
    setEdges((prev) =>
      prev.map((e) => {
        if (e.id === selectedTransition.id && e.data) {
          return {
            ...e,
            data: { ...e.data, ...updated },
          };
        }
        return e;
      })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* React Flow Visual Canvas Area */}
      <div className="relative w-full h-[520px] rounded-3xl bg-white/40 dark:bg-slate-950/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 overflow-hidden shadow-2xl shadow-black/5 dark:shadow-black/40 flex flex-col">
        {/* Canvas Toolbar Badge */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
          <Badge className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-foreground border border-white/50 dark:border-white/15 px-3 py-1.5 text-xs font-semibold gap-2 shadow-md shadow-black/5 pointer-events-auto">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-bold">FSM Workflow: {entityTypeName}</span>
          </Badge>
          <span className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-1.5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/30 dark:border-white/10 shadow-xs pointer-events-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Drag nodes to layout · Click transition pill to inspect SpEL guards
          </span>
        </div>

        {/* React Flow Canvas */}
        <div className="w-full h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeClick={(_, edge) => setSelectedTransitionId(edge.id)}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            defaultEdgeOptions={{
              type: 'fsmTransition',
            }}
            proOptions={{ hideAttribution: true }}
            className="fsm-workflow-flow"
          >
            <Background color="var(--border)" gap={24} size={1.25} />
            <Controls className="!m-4" />
            <MiniMap
              nodeColor={(n) => (n.data as FsmNodeData)?.color || '#38bdf8'}
              className="!m-4"
              maskColor="rgba(15, 23, 42, 0.4)"
            />
          </ReactFlow>
        </div>
      </div>

      {/* Transition Guard & Action Inspector */}
      {selectedTransition && (
        <div className="p-5 rounded-3xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-black/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-xs">
                <GitFork className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Transition Rule: {selectedTransition.sourceState} → {selectedTransition.targetState}
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  Active lifecycle event trigger
                </p>
              </div>
            </div>

            {/* Quick Transition Selector Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Events:</span>
              {initialTransitions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTransitionId(t.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border shadow-xs',
                    selectedTransition.id === t.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20 scale-105'
                      : 'bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground border-white/30 dark:border-white/10'
                  )}
                >
                  {t.triggerEvent}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Guard Expression */}
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/30 dark:border-white/10">
              <Label className="text-[11px] font-medium text-foreground flex items-center justify-between">
                <span className="font-semibold">SpEL Guard Expression</span>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">attributes['field'] condition</span>
              </Label>
              <Input
                value={selectedTransition.guardExpression || ''}
                placeholder="attributes['total_amount'] < 50000"
                onChange={(e) => handleUpdateTransition({ guardExpression: e.target.value })}
                className="h-8 text-xs font-mono bg-white/80 dark:bg-slate-900/80 border-white/30 dark:border-white/10 focus-visible:ring-1"
              />
              <p className="text-[10px] text-muted-foreground">
                Evaluated atomically by Spring Boot prior to transition commit. Rejects invalid requests with 422.
              </p>
            </div>

            {/* Transactional Outbox Action */}
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/30 dark:border-white/10">
              <Label className="text-[11px] font-medium text-foreground font-semibold">
                Transactional Outbox Action
              </Label>
              <Input
                value={selectedTransition.actionType || ''}
                placeholder="e.g. NOTIFICATION_DISPATCH"
                onChange={(e) => handleUpdateTransition({ actionType: e.target.value })}
                className="h-8 text-xs font-mono bg-white/80 dark:bg-slate-900/80 border-white/30 dark:border-white/10 focus-visible:ring-1"
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
