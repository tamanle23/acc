import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
  Panel,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react';
import type { FsmStateNode, FsmTransitionEdge, FsmWorkflowDefinition } from './studio-types';
import { FsmStateNodeComponent, type FsmNodeData, type DynamicHandleConfig } from './fsm-state-node';
import { FsmTransitionEdgeComponent, type FsmEdgeData } from './fsm-transition-edge';
import { GitFork, Zap, Sparkles, RotateCw, LayoutGrid, Layers } from 'lucide-react';
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
    id: 't-submit-reject',
    sourceState: 'SUBMITTED',
    targetState: 'DRAFT',
    triggerEvent: 'REJECT',
    label: 'Reject & Request Revisions',
    guardExpression: "attributes['rejection_reason'] != null",
    requiredRole: 'TENANT_ADMIN',
    actionType: 'NOTIFICATION_DISPATCH',
  },
  {
    id: 't-submit-fasttrack',
    sourceState: 'SUBMITTED',
    targetState: 'PUBLISHED',
    triggerEvent: 'FAST_TRACK',
    label: 'Fast-Track Direct Publish',
    guardExpression: "attributes['total_amount'] < 5000 && attributes['is_verified'] == true",
    requiredRole: 'ROLE_SUPER_ADMIN',
    actionType: 'OUTBOX_EVENT_EMIT',
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
  // and dynamically generated ingress/egress handles derived directly from lifecycle transitions
  const initialNodes: Node<FsmNodeData>[] = useMemo(() => {
    const spacingX = 230;
    const stateIndexMap: Record<string, number> = {};
    initialStates.forEach((s, idx) => {
      stateIndexMap[s.id] = idx;
    });

    return initialStates.map((state, index) => {
      // Find incoming & outgoing transitions for this state
      const outgoingTransitions = initialTransitions.filter(
        (t) => t.sourceState === state.id
      );
      const incomingTransitions = initialTransitions.filter(
        (t) => t.targetState === state.id
      );

      // Distribute outgoing handles along card edges based on topology
      // - Forward transitions -> Position.Right
      // - Backward/rejection transitions -> Position.Bottom
      // - Self-loops -> Position.Top
      const forwardOut = outgoingTransitions.filter((t) => {
        const tgtIdx = stateIndexMap[t.targetState] ?? index;
        return tgtIdx > index;
      });
      const backwardOut = outgoingTransitions.filter((t) => {
        const tgtIdx = stateIndexMap[t.targetState] ?? index;
        return tgtIdx < index;
      });
      const loopOut = outgoingTransitions.filter(
        (t) => t.targetState === state.id
      );

      const outgoingHandles: DynamicHandleConfig[] = [];

      forwardOut.forEach((t, i) => {
        const offsetPct = Math.round(((i + 1) / (forwardOut.length + 1)) * 100);
        outgoingHandles.push({
          id: `source-${t.id}`,
          type: 'source',
          position: Position.Right,
          offsetPct,
          actionName: t.triggerEvent,
          label: t.label,
        });
      });

      backwardOut.forEach((t, i) => {
        const offsetPct = Math.round(((i + 1) / (backwardOut.length + 1)) * 100);
        outgoingHandles.push({
          id: `source-${t.id}`,
          type: 'source',
          position: Position.Bottom,
          offsetPct,
          actionName: t.triggerEvent,
          label: t.label,
        });
      });

      loopOut.forEach((t, i) => {
        const offsetPct = Math.round(((i + 1) / (loopOut.length + 1)) * 60) + 20;
        outgoingHandles.push({
          id: `source-${t.id}`,
          type: 'source',
          position: Position.Top,
          offsetPct: Math.min(offsetPct + 15, 85),
          actionName: t.triggerEvent,
          label: t.label,
        });
      });

      // Distribute incoming handles along card edges based on topology
      // - Forward incoming -> Position.Left
      // - Backward incoming -> Position.Bottom
      // - Self-loops incoming -> Position.Top
      const forwardIn = incomingTransitions.filter((t) => {
        const srcIdx = stateIndexMap[t.sourceState] ?? index;
        return srcIdx < index;
      });
      const backwardIn = incomingTransitions.filter((t) => {
        const srcIdx = stateIndexMap[t.sourceState] ?? index;
        return srcIdx > index;
      });
      const loopIn = incomingTransitions.filter(
        (t) => t.sourceState === state.id
      );

      const incomingHandles: DynamicHandleConfig[] = [];

      forwardIn.forEach((t, i) => {
        const offsetPct = Math.round(((i + 1) / (forwardIn.length + 1)) * 100);
        incomingHandles.push({
          id: `target-${t.id}`,
          type: 'target',
          position: Position.Left,
          offsetPct,
          actionName: t.triggerEvent,
          label: t.label,
        });
      });

      backwardIn.forEach((t, i) => {
        const offsetPct = Math.round(((i + 1) / (backwardIn.length + 1)) * 100);
        incomingHandles.push({
          id: `target-${t.id}`,
          type: 'target',
          position: Position.Bottom,
          offsetPct,
          actionName: t.triggerEvent,
          label: t.label,
        });
      });

      loopIn.forEach((t, i) => {
        const offsetPct = Math.round(((i + 1) / (loopIn.length + 1)) * 60) + 20;
        incomingHandles.push({
          id: `target-${t.id}`,
          type: 'target',
          position: Position.Top,
          offsetPct: Math.max(offsetPct - 15, 15),
          actionName: t.triggerEvent,
          label: t.label,
        });
      });

      return {
        id: state.id,
        type: 'fsmState',
        position: {
          x: 60 + index * spacingX,
          y: index % 2 === 0 ? 100 : 180,
        },
        data: {
          ...state,
          outgoingHandles,
          incomingHandles,
        },
      };
    });
  }, [initialStates, initialTransitions]);

  const initialEdges: Edge<FsmEdgeData>[] = useMemo(() => {
    // Map state indices for topological backward/forward detection
    const stateIndexMap: Record<string, number> = {};
    initialStates.forEach((s, idx) => {
      stateIndexMap[s.id] = idx;
    });

    // Group transitions by pair of nodes to offset parallel multi-actions cleanly
    const pairGroups: Record<string, FsmTransitionEdge[]> = {};
    initialTransitions.forEach((t) => {
      const key = `${t.sourceState}->${t.targetState}`;
      if (!pairGroups[key]) pairGroups[key] = [];
      pairGroups[key].push(t);
    });

    const result: Edge<FsmEdgeData>[] = [];
    Object.values(pairGroups).forEach((group) => {
      const multiTotal = group.length;
      group.forEach((t, multiIndex) => {
        const srcIdx = stateIndexMap[t.sourceState] ?? 0;
        const tgtIdx = stateIndexMap[t.targetState] ?? 0;
        const isBackward = tgtIdx < srcIdx;
        const isSelfLoop = tgtIdx === srcIdx;

        result.push({
          id: t.id,
          source: t.sourceState,
          target: t.targetState,
          sourceHandle: `source-${t.id}`,
          targetHandle: `target-${t.id}`,
          type: 'fsmTransition',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: isBackward ? 'oklch(0.65 0.20 25 / 85%)' : 'oklch(0.62 0.16 260 / 80%)',
          },
          data: {
            ...t,
            multiIndex,
            multiTotal,
            hasSiblings: multiTotal > 1,
            isBackward,
            isSelfLoop,
          },
        });
      });
    });

    return result;
  }, [initialStates, initialTransitions]);

  const reactFlowInstanceRef = useRef<ReactFlowInstance<Node<FsmNodeData>, Edge<FsmEdgeData>> | null>(null);
  const [layoutMode, setLayoutMode] = useState<'dag' | 'stagger' | 'compact'>('stagger');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Layout algorithm: computes coordinates based on selected layout mode
  const computeLayoutCoordinates = useCallback(
    (
      states: FsmStateNode[],
      mode: 'dag' | 'stagger' | 'compact'
    ): Record<string, { x: number; y: number }> => {
      const positions: Record<string, { x: number; y: number }> = {};
      const total = states.length;

      states.forEach((state, index) => {
        if (mode === 'dag') {
          // Linear DAG horizontal flow with generous spacing for smooth edge arcs
          positions[state.id] = {
            x: 80 + index * 260,
            y: 160,
          };
        } else if (mode === 'stagger') {
          // Staggered horizontal flow to create natural breathing space for parallel actions
          positions[state.id] = {
            x: 80 + index * 240,
            y: index % 2 === 0 ? 110 : 210,
          };
        } else if (mode === 'compact') {
          // Compact 2D Grid / Matrix layout (e.g. 3 columns per row)
          const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(total))));
          const col = index % cols;
          const row = Math.floor(index / cols);
          positions[state.id] = {
            x: 80 + col * 280,
            y: 90 + row * 160,
          };
        }
      });

      return positions;
    },
    []
  );

  const [nodes, setNodes] = useState<Node<FsmNodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge<FsmEdgeData>[]>(initialEdges);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string>(
    initialTransitions[0]?.id || ''
  );

  // Force Refresh / Beautiful Auto Layout function
  const handleForceAutoLayout = useCallback(
    (modeToApply: 'dag' | 'stagger' | 'compact' = layoutMode) => {
      setIsRefreshing(true);
      const coords = computeLayoutCoordinates(initialStates, modeToApply);

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const newPos = coords[node.id];
          return newPos ? { ...node, position: { ...newPos } } : node;
        })
      );

      // Smoothly re-fit the viewport to center all nodes and edges beautifully
      setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          reactFlowInstanceRef.current.fitView({
            padding: 0.28,
            duration: 600,
          });
        }
        setIsRefreshing(false);
      }, 50);
    },
    [layoutMode, computeLayoutCoordinates, initialStates]
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
        {/* Canvas Toolbar Header */}
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

        {/* Top-Right Glass Auto Layout Action Bar */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 pointer-events-auto">
          {/* Layout Mode Selector */}
          <div className="flex items-center p-1 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/40 dark:border-white/15 shadow-md shadow-black/5 gap-1">
            <button
              type="button"
              onClick={() => {
                setLayoutMode('stagger');
                handleForceAutoLayout('stagger');
              }}
              title="Staggered Flow (Alternating breathing space)"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer',
                layoutMode === 'stagger'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-slate-800/50'
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Staggered</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode('dag');
                handleForceAutoLayout('dag');
              }}
              title="Horizontal Linear DAG Flow"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer',
                layoutMode === 'dag'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-slate-800/50'
              )}
            >
              <GitFork className="h-3.5 w-3.5" />
              <span>Linear DAG</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode('compact');
                handleForceAutoLayout('compact');
              }}
              title="Compact Matrix Grid"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer',
                layoutMode === 'compact'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-slate-800/50'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Compact</span>
            </button>
          </div>

          {/* Force Refresh Layout Button */}
          <Button
            type="button"
            variant="glass"
            size="sm"
            onClick={() => handleForceAutoLayout(layoutMode)}
            disabled={isRefreshing}
            className="h-8 px-3 rounded-xl border border-white/50 dark:border-white/15 bg-white/85 dark:bg-slate-900/85 hover:bg-white dark:hover:bg-slate-900 text-foreground shadow-md shadow-black/5 gap-1.5 font-semibold text-xs active:scale-95 transition-all"
          >
            <RotateCw
              className={cn(
                'h-3.5 w-3.5 text-sky-500 transition-transform duration-500',
                isRefreshing && 'animate-spin text-primary'
              )}
            />
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Auto Layout</span>
          </Button>
        </div>

        {/* React Flow Canvas */}
        <div className="w-full h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
            }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeClick={(_, edge) => setSelectedTransitionId(edge.id)}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.28 }}
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
