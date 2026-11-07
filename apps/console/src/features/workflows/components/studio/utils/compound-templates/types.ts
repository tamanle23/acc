import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeType, type DagNodeData } from '../../canvas/dag-node';

export interface CompoundTemplateOptions {
  label?: string;
  uniqueSuffix?: string;
  branchCount?: number;
  customData?: Partial<DagNodeData>;
}

export interface CompoundTemplateResult {
  nodes: Node<DagNodeData>[];
  edges: Edge[];
  primaryNodeId: string;
  exitNodeId: string;
  exitHandle?: string;
  envelopeWidth: number;
  envelopeHeight: number;
}

export interface CompoundTemplateFactory {
  taskType: DagNodeType;
  supports(type: DagNodeType): boolean;
  create(basePos: { x: number; y: number }, options?: CompoundTemplateOptions): CompoundTemplateResult;
}
