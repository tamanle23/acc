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
      <div className="relative w-full h-[460px] rounded-3xl bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-2xl border border-white/20 dark:border-white/10 overflow-hidden shadow-2xl flex flex-col">
        {/* Canvas Toolbar Badge */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
          <Badge className="bg-primary/20 text-primary border-primary/30 backdrop-blur-md px-2.5 py-1 text-xs font-semibold gap-1.5 shadow-sm pointer-events-auto">
            <Zap className="h-3.5 w-3.5" />
            <span>FSM Workflow: {entityTypeName}</span>
          </Badge>
          <span className="text-[11px] text-muted-foreground hidden sm:inline bg-slate-900/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 pointer-events-auto">
            Drag nodes to rearrange · Click transition pill to inspect SpEL guards
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
            fitViewOptions={{ padding: 0.2 }}
            defaultEdgeOptions={{
              type: 'fsmTransition',
            }}
            proOptions={{ hideAttribution: true }}
            className="fsm-workflow-flow"
          >
            <Background color="#64748b" gap={20} size={1} />
            <Controls className="bg-slate-900/80 border-white/20 fill-white text-white rounded-xl shadow-lg !m-3" />
            <MiniMap
              nodeColor={(n) => (n.data as FsmNodeData)?.color || '#38bdf8'}
              className="!bg-slate-950/80 !border !border-white/15 !rounded-xl !overflow-hidden !m-3"
              maskColor="rgba(15, 23, 42, 0.7)"
            />
          </ReactFlow>
        </div>
      </div>

      {/* Transition Guard & Action Inspector */}
      {selectedTransition && (
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <GitFork className="h-4 w-4 text-sky-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Transition Rule: {selectedTransition.sourceState} → {selectedTransition.targetState}
              </h4>
            </div>

            {/* Quick Transition Selector Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {initialTransitions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTransitionId(t.id)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    selectedTransition.id === t.id
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-muted/80 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {t.triggerEvent}
                </button>
              ))}
            </div>
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
