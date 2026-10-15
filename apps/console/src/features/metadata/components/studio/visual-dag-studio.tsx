import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DagWorkflowNodeComponent, type DagNodeData, type DagNodeType } from './dag-node';
import { DagPalette } from './dag-palette';
import { DagPropertyInspector } from './dag-property-inspector';
import { WorkflowIrDialog } from './workflow-ir-dialog';
import {
  exportToWorkflowIR,
  importFromWorkflowIR,
  validateGraphTopology,
  type WorkflowIR,
  type GraphValidationError,
} from './workflow-ir-converter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  RotateCcw,
  Activity,
  Plus,
  Trash2,
  FileCode,
  Upload,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Save,
  Eye,
} from 'lucide-react';
import { ExecutionRunDrawer } from '@/features/workflows/components/execution-run-drawer';
import { useWorkflowExecutionStream } from '@/features/workflows/hooks/use-workflow-execution-stream';
import { useSaveWorkflowDefinition, useWorkflowDefinition } from '@/features/workflows/api/workflow-api';

export interface VisualDagStudioProps {
  mode?: 'designer' | 'execution';
  workflowKey?: string;
  executionId?: string | null;
  onCloseExecution?: () => void;
  onSaveSuccess?: () => void;
}

const nodeTypes = {
  dagNode: DagWorkflowNodeComponent,
};

const INITIAL_NODES: Node<DagNodeData>[] = [
  {
    id: 'node-inventory',
    type: 'dagNode',
    position: { x: 50, y: 150 },
    data: {
      taskReferenceName: 'checkInventory',
      taskType: 'SIMPLE',
      label: 'Check Inventory',
      domain: 'inventory',
      timeoutSeconds: 15,
      retryCount: 3,
      retryDelaySeconds: 2,
      backoffRate: 2.0,
      executionState: 'COMPLETED',
      inputParameters: {
        orderId: '${workflow.input.orderId}',
      },
    },
  },
  {
    id: 'node-route',
    type: 'dagNode',
    position: { x: 340, y: 150 },
    data: {
      taskReferenceName: 'routeShipping',
      taskType: 'SWITCH',
      label: 'Route Shipping',
      condition: '${workflow.input.speed}',
      executionState: 'COMPLETED',
      decisionCases: {
        EXPRESS: ['expressCourier'],
        STANDARD: ['groundPostal'],
      },
      defaultCase: ['groundPostal'],
    },
  },
  {
    id: 'node-courier',
    type: 'dagNode',
    position: { x: 620, y: 70 },
    data: {
      taskReferenceName: 'expressCourier',
      taskType: 'SIMPLE',
      label: 'Express Courier',
      domain: 'shipping',
      timeoutSeconds: 30,
      retryCount: 3,
      executionState: 'IN_PROGRESS',
      inputParameters: {
        trackingNumber: '${checkInventory.output.trackingNumber}',
      },
      compensateHandlerRef: 'cancelCourierBooking',
    },
  },
  {
    id: 'node-ground',
    type: 'dagNode',
    position: { x: 620, y: 230 },
    data: {
      taskReferenceName: 'groundPostal',
      taskType: 'SIMPLE',
      label: 'Ground Postal',
      domain: 'shipping',
      timeoutSeconds: 30,
      retryCount: 2,
      executionState: 'PENDING',
      inputParameters: {
        postalCode: '${workflow.input.postalCode}',
      },
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'node-inventory', target: 'node-route', animated: true },
  { id: 'e2', source: 'node-route', target: 'node-courier', label: 'EXPRESS', animated: true },
  { id: 'e3', source: 'node-route', target: 'node-ground', label: 'STANDARD' },
];

function DagStudioCanvas({
  mode = 'designer',
  workflowKey,
  executionId,
  onCloseExecution,
  onSaveSuccess,
}: VisualDagStudioProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<Node<DagNodeData>[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showPalette, setShowPalette] = useState(mode === 'designer');

  // Real-time execution stream integration
  const stream = useWorkflowExecutionStream(executionId || null);

  // Sync execution stream states onto canvas nodes
  React.useEffect(() => {
    if (mode === 'execution' && Object.keys(stream.nodeStates).length > 0) {
      setNodes((nds) =>
        nds.map((n) => {
          const taskRef = n.data.taskReferenceName;
          const liveState = stream.nodeStates[taskRef];
          if (liveState && liveState !== n.data.executionState) {
            return {
              ...n,
              data: {
                ...n.data,
                executionState: liveState,
              },
            };
          }
          return n;
        })
      );
    }
  }, [mode, stream.nodeStates]);

  // Load existing workflow definition if workflowKey is provided
  const workflowDefQuery = useWorkflowDefinition(workflowKey || null);
  const saveWorkflowMutation = useSaveWorkflowDefinition();

  React.useEffect(() => {
    if (workflowDefQuery.data) {
      try {
        const { nodes: loadedNodes, edges: loadedEdges } = importFromWorkflowIR(
          workflowDefQuery.data as any
        );
        setNodes(loadedNodes);
        setEdges(loadedEdges);
      } catch (e) {
        console.warn('Failed to parse imported workflow definition:', e);
      }
    }
  }, [workflowDefQuery.data]);

  // Property Inspector Sheet State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // IR Dialog State
  const [irDialogMode, setIrDialogMode] = useState<'export' | 'import'>('export');
  const [isIrDialogOpen, setIsIrDialogOpen] = useState(false);
  const [irDialogContent, setIrDialogContent] = useState('');

  // Validation State
  const [validationErrors, setValidationErrors] = useState<GraphValidationError[]>([]);
  const [validationBannerVisible, setValidationBannerVisible] = useState(false);

  const availableTaskRefs = useMemo(
    () => nodes.map((n) => n.data.taskReferenceName),
    [nodes]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const onNodesChange: OnNodesChange<Node<DagNodeData>> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    []
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setIsInspectorOpen(true);
  }, []);

  const handleUpdateNodeData = useCallback(
    (nodeId: string, updatedData: Partial<DagNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                ...updatedData,
              },
            };
          }
          return n;
        })
      );
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/dag-node-type') as DagNodeType;
      const rawData = event.dataTransfer.getData('application/dag-node-data');

      if (!type || !rawData) return;

      const parsedData = JSON.parse(rawData);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const uniqueSuffix = Date.now().toString().slice(-4);
      const taskRef = `${type.toLowerCase()}_task_${uniqueSuffix}`;
      const newNodeId = `node-${taskRef}`;

      const newNode: Node<DagNodeData> = {
        id: newNodeId,
        type: 'dagNode',
        position,
        data: {
          taskReferenceName: taskRef,
          executionState: 'PENDING',
          domain: 'default',
          timeoutSeconds: 30,
          retryCount: 3,
          retryDelaySeconds: 2,
          backoffRate: 2.0,
          inputParameters: {},
          ...parsedData,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition]
  );

  const handleValidateDag = useCallback(() => {
    const errors = validateGraphTopology(nodes, edges);
    setValidationErrors(errors);
    setValidationBannerVisible(true);

    // Apply or clear validation errors on nodes
    const errorMap = new Map<string, string>();
    for (const err of errors) {
      if (err.nodeId) {
        errorMap.set(err.nodeId, err.message);
      }
    }

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          validationError: errorMap.get(n.id) || undefined,
        },
      }))
    );
  }, [nodes, edges]);

  const handleExportJson = useCallback(() => {
    const ir = exportToWorkflowIR(nodes, edges);
    setIrDialogContent(JSON.stringify(ir, null, 2));
    setIrDialogMode('export');
    setIsIrDialogOpen(true);
  }, [nodes, edges]);

  const handleOpenImportDialog = useCallback(() => {
    setIrDialogContent('');
    setIrDialogMode('import');
    setIsIrDialogOpen(true);
  }, []);

  const handleApplyImportedJson = useCallback((importedIr: WorkflowIR) => {
    try {
      const { nodes: newNodes, edges: newEdges } = importFromWorkflowIR(importedIr);
      setNodes(newNodes);
      setEdges(newEdges);
      setValidationErrors([]);
      setValidationBannerVisible(false);
    } catch (e: any) {
      alert(`Import error: ${e.message}`);
    }
  }, []);

  const handleSimulateStep = () => {
    setIsSimulating(true);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.data.taskReferenceName === 'expressCourier') {
          return {
            ...n,
            data: { ...n.data, executionState: 'COMPLETED' },
          };
        }
        return n;
      })
    );
  };

  const handleReset = () => {
    setIsSimulating(false);
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setSelectedNodeId(null);
    setIsInspectorOpen(false);
    setValidationErrors([]);
    setValidationBannerVisible(false);
  };

  const handleClearSelected = () => {
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !e.selected));
  };

  return (
    <div
      ref={reactFlowWrapper}
      className="relative w-full h-[650px] rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-xl bg-card/60"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Studio Header Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 p-2 rounded-xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/30 dark:border-white/10 shadow-lg flex-wrap">
        <div className="flex items-center gap-2 mr-1">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-bold text-foreground">Visual DAG Studio</span>
          <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/20">
            Phase 32
          </Badge>
        </div>

        <div className="h-4 w-[1px] bg-border/50" />

        <Button
          size="sm"
          variant={showPalette ? 'default' : 'outline'}
          className="h-7 text-xs gap-1"
          onClick={() => setShowPalette((prev) => !prev)}
        >
          <Plus className="w-3 h-3" />
          Palette
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handleValidateDag}
          title="Run Kahn & Tarjan cycle checks and binding validation"
        >
          {validationErrors.length > 0 ? (
            <AlertTriangle className="w-3 h-3 text-rose-500" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          )}
          Validate DAG
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handleExportJson}
          title="Export graph to canonical workflow-ir-schema-v1.json"
        >
          <FileCode className="w-3 h-3 text-sky-500" />
          Export IR
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handleOpenImportDialog}
          title="Import canonical JSON IR onto canvas"
        >
          <Upload className="w-3 h-3 text-indigo-500" />
          Import IR
        </Button>

        <div className="h-4 w-[1px] bg-border/50" />

        {mode === 'designer' && (
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs gap-1 bg-primary text-primary-foreground shadow-sm"
            onClick={() => {
              const ir = exportToWorkflowIR(nodes, edges);
              saveWorkflowMutation.mutate(ir, {
                onSuccess: () => {
                  if (onSaveSuccess) onSaveSuccess();
                },
              });
            }}
            disabled={saveWorkflowMutation.isPending}
            title="Save workflow definition to backend catalog"
          >
            <Save className="w-3 h-3" />
            {saveWorkflowMutation.isPending ? 'Saving...' : 'Save DAG'}
          </Button>
        )}

        {mode === 'execution' && (
          <div className="flex items-center gap-2">
            <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20 text-[10px]">
              <Eye className="w-3 h-3 mr-1" />
              Live Execution View
            </Badge>
            {onCloseExecution && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCloseExecution}>
                Exit View
              </Button>
            )}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handleSimulateStep}
          disabled={isSimulating}
        >
          <Play className="w-3 h-3 text-emerald-500" />
          Simulate
        </Button>

        {mode === 'designer' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
            onClick={handleClearSelected}
            title="Delete selected nodes/edges"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </Button>
        )}

        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleReset}>
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>

      {/* Validation Status Notification Banner */}
      {validationBannerVisible && (
        <div className="absolute top-16 right-4 z-20 max-w-sm p-3 rounded-xl backdrop-blur-xl shadow-2xl border transition-all animate-in fade-in slide-in-from-top-2">
          {validationErrors.length === 0 ? (
            <div className="flex items-center justify-between gap-3 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-semibold">DAG is acyclic & all bindings valid!</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[10px] px-1"
                onClick={() => setValidationBannerVisible(false)}
              >
                Dismiss
              </Button>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{validationErrors.length} DAG Issue(s) Found</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 text-[10px] px-1"
                  onClick={() => setValidationBannerVisible(false)}
                >
                  Dismiss
                </Button>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-1 max-h-32 overflow-y-auto">
                {validationErrors.map((err, i) => (
                  <li key={i} className="truncate">
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Floating Drag-and-Drop Task Palette */}
      {showPalette && (
        <div className="absolute top-16 left-4 z-10">
          <DagPalette />
        </div>
      )}

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        fitView
      >
        <Background gap={16} size={1} />
        <Controls className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl !shadow-lg" />
        <MiniMap
          className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl"
          nodeColor={(n) => {
            const data = n.data as DagNodeData;
            if (data?.validationError) return '#ef4444';
            if (data?.executionState === 'COMPLETED') return '#10b981';
            if (data?.executionState === 'IN_PROGRESS') return '#0284c7';
            if (data?.executionState === 'FAILED') return '#ef4444';
            return '#94a3b8';
          }}
        />
      </ReactFlow>

      {/* Slide-Over Property Inspector Drawer */}
      <DagPropertyInspector
        nodeId={selectedNodeId}
        nodeData={selectedNode?.data || null}
        open={isInspectorOpen}
        onOpenChange={setIsInspectorOpen}
        onUpdateNodeData={handleUpdateNodeData}
        availableTaskRefs={availableTaskRefs}
      />

      {/* Workflow IR Dialog (Export / Import) */}
      <WorkflowIrDialog
        open={isIrDialogOpen}
        onOpenChange={setIsIrDialogOpen}
        mode={irDialogMode}
        initialJson={irDialogContent}
        onImportJson={handleApplyImportedJson}
      />

      {/* Execution Run Drawer (Active in Execution mode or when executionId is provided) */}
      {executionId && (
        <ExecutionRunDrawer
          executionId={executionId}
          stream={stream}
          snapshot={stream.snapshot}
          onClose={onCloseExecution}
        />
      )}
    </div>
  );
}

export function VisualDagStudio(props: VisualDagStudioProps) {
  return (
    <ReactFlowProvider>
      <DagStudioCanvas {...props} />
    </ReactFlowProvider>
  );
}

export const ConductorWorkflowStudio = VisualDagStudio;
