import type { Node, Edge } from '@xyflow/react';
import type { DagNodeData } from '@/features/workflows/components/studio/canvas/dag-node';
import {
  MULTI_BRANCH_ORDER_NODES as RAW_NODES,
  MULTI_BRANCH_ORDER_EDGES as RAW_EDGES,
} from '@acc/sandbox';

export const MULTI_BRANCH_ORDER_NODES: Node<DagNodeData>[] = RAW_NODES as unknown as Node<DagNodeData>[];
export const MULTI_BRANCH_ORDER_EDGES: Edge[] = RAW_EDGES as unknown as Edge[];
