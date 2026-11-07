import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData, type DagNodeType } from '../../canvas/dag-node';

export interface BranchDescriptor {
  readonly id: string;
  readonly label: string;
  readonly handleId: string;
  readonly targetTaskRef?: string;
  readonly isRemovable: boolean;
  readonly isDefault?: boolean;
}

export interface BranchAdditionResult {
  readonly updatedParentData: Partial<DagNodeData>;
  readonly newBranch: BranchDescriptor;
  readonly suggestedTaskType: DagNodeType;
  readonly initialBranchLabel: string;
}

export interface BranchRemovalResult {
  readonly updatedParentData: Partial<DagNodeData>;
  readonly removedBranch: BranchDescriptor;
  readonly prunedTaskRefs: string[];
}

export interface MultiBranchStrategy {
  readonly taskType: DagNodeType;
  readonly minBranches: number;
  readonly addActionLabel: string;

  getBranches(data: DagNodeData): BranchDescriptor[];

  addBranch(data: DagNodeData, options?: { name?: string }): BranchAdditionResult;

  removeBranch(data: DagNodeData, branchId: string): BranchRemovalResult;

  findBarrierNode(
    parentNode: Node<DagNodeData>,
    nodes: Node<DagNodeData>[],
    edges: Edge[]
  ): Node<DagNodeData> | null;

  syncBarrierNode(
    barrierNode: Node<DagNodeData>,
    action: 'add' | 'remove',
    branchRef: string
  ): Partial<DagNodeData>;
}
