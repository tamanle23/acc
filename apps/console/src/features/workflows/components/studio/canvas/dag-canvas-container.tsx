import React from 'react';
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
  type IsValidConnection,
  SelectionMode,
} from '@xyflow/react';
import type { DagNodeData } from './dag-node';

export interface DagCanvasContainerProps {
  nodes: Node<DagNodeData>[];
  edges: Edge[];
  nodeTypes: any;
  edgeTypes: any;
  isReadOnly: boolean;
  isExecutionMode: boolean;
  isSnapToGrid: boolean;
  followLive: boolean;
  onNodesChange?: OnNodesChange<Node<DagNodeData>>;
  onEdgesChange?: OnEdgesChange<Edge>;
  onConnect?: OnConnect;
  isValidConnection?: IsValidConnection;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  onMoveStart?: (event?: any) => void;
  onResumeFollow?: () => void;
}

export const DagCanvasContainer: React.FC<DagCanvasContainerProps> = ({
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  isReadOnly,
  isExecutionMode,
  isSnapToGrid,
  followLive,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onNodeClick,
  onEdgeClick,
  onMoveStart,
  onResumeFollow,
}) => {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={isReadOnly ? undefined : onNodesChange}
      onEdgesChange={isReadOnly ? undefined : onEdgesChange}
      onConnect={isReadOnly ? undefined : onConnect}
      isValidConnection={isValidConnection}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      nodesDraggable={!isReadOnly}
      nodesConnectable={!isReadOnly}
      elementsSelectable={true}
      selectionOnDrag={!isReadOnly}
      selectionMode={SelectionMode?.Partial || ('partial' as SelectionMode)}
      panOnDrag={[1, 2]}
      snapToGrid={isSnapToGrid}
      snapGrid={[16, 16]}
      fitView
      onMoveStart={isExecutionMode ? onMoveStart : undefined}
    >
      <Background gap={16} size={1} />
      <Controls className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl !shadow-lg" />
      <MiniMap
        className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl"
        nodeColor={(n) => {
          const data = n.data as DagNodeData;
          if (data?.validationError) return '#ef4444';
          if (data?.executionState === 'COMPLETED') return '#10b981';
          if (data?.executionState === 'PAUSED_AT_BREAKPOINT') return '#f59e0b';
          if (data?.executionState === 'IN_PROGRESS') return '#0284c7';
          if (data?.executionState === 'FAILED') return '#ef4444';
          return '#94a3b8';
        }}
      />
      {/* Resume Follow pill — appears when user has disabled follow-live in execution mode */}
      {isExecutionMode && !followLive && onResumeFollow && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={onResumeFollow}
            aria-label="Resume camera follow for active tasks"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 border border-white/30 dark:border-white/15 shadow-xl shadow-black/10 hover:bg-white/95 dark:hover:bg-slate-800/95 transition-all duration-150 text-foreground"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Resume Follow
          </button>
        </div>
      )}
    </ReactFlow>
  );
};
