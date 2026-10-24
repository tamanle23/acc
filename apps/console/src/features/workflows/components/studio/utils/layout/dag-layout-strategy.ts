import type { Node, Edge } from '@xyflow/react';
import type { DagNodeData } from '../../canvas/dag-node';

export type LayoutAlgorithm = 'dagre' | 'elk';
export type LayoutDirection = 'LR' | 'TB';

export interface DagLayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

export interface DagLayoutResult {
  nodes: Node<DagNodeData>[];
  edges: Edge[];
}

export interface DagLayoutEngineStrategy {
  id: LayoutAlgorithm;
  name: string;
  description: string;
  layout(
    nodes: Node<DagNodeData>[],
    edges: Edge[],
    options?: DagLayoutOptions
  ): DagLayoutResult;
}
