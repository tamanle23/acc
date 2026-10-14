import React, { useState, useCallback, useRef } from 'react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, Activity, Plus, Trash2 } from 'lucide-react';

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
      timeoutSeconds: 15,
      retryCount: 3,
      executionState: 'COMPLETED',
    },
  },
  {
    id: 'node-route',
    type: 'dagNode',
    position: { x: 320, y: 150 },
    data: {
      taskReferenceName: 'routeShipping',
      taskType: 'SWITCH',
      label: 'Route Shipping',
      condition: '${workflow.input.speed}',
      executionState: 'COMPLETED',
    },
  },
  {
    id: 'node-courier',
    type: 'dagNode',
    position: { x: 600, y: 70 },
    data: {
      taskReferenceName: 'expressCourier',
      taskType: 'SIMPLE',
      label: 'Express Courier',
      timeoutSeconds: 30,
      executionState: 'IN_PROGRESS',
    },
  },
  {
    id: 'node-ground',
    type: 'dagNode',
    position: { x: 600, y: 230 },
    data: {
      taskReferenceName: 'groundPostal',
      taskType: 'SIMPLE',
      label: 'Ground Postal',
      timeoutSeconds: 30,
      executionState: 'PENDING',
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'node-inventory', target: 'node-route', animated: true },
  { id: 'e2', source: 'node-route', target: 'node-courier', label: 'EXPRESS', animated: true },
  { id: 'e3', source: 'node-route', target: 'node-ground', label: 'STANDARD' },
];

function DagStudioCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<Node<DagNodeData>[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showPalette, setShowPalette] = useState(true);

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
          ...parsedData,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition]
  );

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
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 p-2 rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/30 dark:border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-bold text-foreground">Visual DAG Studio</span>
          <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/20">
            Phase 31
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
          onClick={handleSimulateStep}
          disabled={isSimulating}
        >
          <Play className="w-3 h-3 text-emerald-500" />
          Simulate Step
        </Button>
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
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleReset}>
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>

      {/* Floating Drag-and-Drop Task Palette */}
      {showPalette && (
        <div className="absolute top-16 left-4 z-10">
          <DagPalette />
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background gap={16} size={1} />
        <Controls className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl !shadow-lg" />
        <MiniMap
          className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl"
          nodeColor={(n) => {
            const data = n.data as DagNodeData;
            if (data?.executionState === 'COMPLETED') return '#10b981';
            if (data?.executionState === 'IN_PROGRESS') return '#0284c7';
            if (data?.executionState === 'FAILED') return '#ef4444';
            return '#94a3b8';
          }}
        />
      </ReactFlow>
    </div>
  );
}

export function VisualDagStudio() {
  return (
    <ReactFlowProvider>
      <DagStudioCanvas />
    </ReactFlowProvider>
  );
}

export const ConductorWorkflowStudio = VisualDagStudio;
