import React, { useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ConductorWorkflowNodeComponent, type ConductorNodeData } from './conductor-node';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, Activity } from 'lucide-react';

const nodeTypes = {
  conductorNode: ConductorWorkflowNodeComponent,
};

const INITIAL_NODES: Node<ConductorNodeData>[] = [
  {
    id: 'node-inventory',
    type: 'conductorNode',
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
    type: 'conductorNode',
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
    type: 'conductorNode',
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
    type: 'conductorNode',
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

export function ConductorWorkflowStudio() {
  const [nodes, setNodes] = useState<Node<ConductorNodeData>[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [isSimulating, setIsSimulating] = useState(false);

  const onNodesChange: OnNodesChange<Node<ConductorNodeData>> = (changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  const onEdgesChange: OnEdgesChange = (changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

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
  };

  return (
    <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-xl bg-card/60">
      {/* Studio Header Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 p-2 rounded-xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/30 dark:border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-bold text-foreground">Conductor Workflow Studio</span>
          <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/20">
            Phase 30
          </Badge>
        </div>
        <div className="h-4 w-[1px] bg-border/50" />
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
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleReset}>
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background gap={16} size={1} />
        <Controls className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl !shadow-lg" />
        <MiniMap
          className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl"
          nodeColor={(n) => {
            const data = n.data as ConductorNodeData;
            if (data.executionState === 'COMPLETED') return '#10b981';
            if (data.executionState === 'IN_PROGRESS') return '#0284c7';
            if (data.executionState === 'FAILED') return '#ef4444';
            return '#94a3b8';
          }}
        />
      </ReactFlow>
    </div>
  );
}
