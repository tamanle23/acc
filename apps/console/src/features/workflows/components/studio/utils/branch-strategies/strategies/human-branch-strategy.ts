import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData, type DagNodeType } from '../../../canvas/dag-node';
import {
  type MultiBranchStrategy,
  type BranchDescriptor,
  type BranchAdditionResult,
  type BranchRemovalResult,
} from '../types';

export class HumanBranchStrategy implements MultiBranchStrategy {
  readonly taskType: DagNodeType = 'HUMAN';
  readonly minBranches: number = 2; // approved + rejected
  readonly addActionLabel: string = 'Add Outcome';

  getBranches(data: DagNodeData): BranchDescriptor[] {
    const branches: BranchDescriptor[] = [
      {
        id: 'approved',
        label: 'Approved Route',
        handleId: 'approved',
        isRemovable: false,
        isDefault: false,
      },
      {
        id: 'rejected',
        label: 'Rejected Route',
        handleId: 'rejected',
        isRemovable: false,
        isDefault: true,
      },
    ];

    const customOutcomes = (data.humanParams as { customOutcomes?: string[] } | undefined)?.customOutcomes || [];
    for (const outcome of customOutcomes) {
      branches.push({
        id: outcome,
        label: `Outcome: ${outcome}`,
        handleId: `outcome-${outcome}`,
        isRemovable: true,
        isDefault: false,
      });
    }

    return branches;
  }

  addBranch(data: DagNodeData, options?: { name?: string }): BranchAdditionResult {
    const humanParams = { ...(data.humanParams || {}) } as { role?: string; slaMinutes?: number; instructions?: string; customOutcomes?: string[] };
    const customOutcomes = [...(humanParams.customOutcomes || [])];

    let outcomeKey = options?.name?.trim() || `escalate_${customOutcomes.length + 1}`;
    if (!customOutcomes.includes(outcomeKey)) {
      customOutcomes.push(outcomeKey);
    }

    const uniqueSuffix = Date.now().toString().slice(-4);
    const targetTaskRef = `human_${outcomeKey}_${uniqueSuffix}`;

    humanParams.customOutcomes = customOutcomes;

    const newBranch: BranchDescriptor = {
      id: outcomeKey,
      label: `Outcome: ${outcomeKey}`,
      handleId: `outcome-${outcomeKey}`,
      targetTaskRef,
      isRemovable: true,
      isDefault: false,
    };

    return {
      updatedParentData: {
        humanParams,
      },
      newBranch,
      suggestedTaskType: 'SIMPLE',
      initialBranchLabel: `${outcomeKey.toUpperCase()} Action`,
    };
  }

  removeBranch(data: DagNodeData, branchId: string): BranchRemovalResult {
    if (branchId === 'approved' || branchId === 'rejected') {
      throw new Error(`Standard '${branchId}' route cannot be removed`);
    }

    const humanParams = { ...(data.humanParams || {}) } as { customOutcomes?: string[] };
    const customOutcomes = (humanParams.customOutcomes || []).filter((o) => o !== branchId);
    humanParams.customOutcomes = customOutcomes;

    const removedBranch: BranchDescriptor = {
      id: branchId,
      label: `Outcome: ${branchId}`,
      handleId: `outcome-${branchId}`,
      isRemovable: true,
    };

    return {
      updatedParentData: {
        humanParams,
      },
      removedBranch,
      prunedTaskRefs: [],
    };
  }

  findBarrierNode(
    _parentNode: Node<DagNodeData>,
    nodes: Node<DagNodeData>[],
    _edges: Edge[]
  ): Node<DagNodeData> | null {
    return (
      nodes.find((n) => n.data.isEndNode || n.data.taskType === 'END_WORKFLOW') ||
      null
    );
  }

  syncBarrierNode(
    _barrierNode: Node<DagNodeData>,
    _action: 'add' | 'remove',
    _branchRef: string
  ): Partial<DagNodeData> {
    return {};
  }
}
