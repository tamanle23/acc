import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData, type DagNodeType } from '../../../canvas/dag-node';
import {
  type MultiBranchStrategy,
  type BranchDescriptor,
  type BranchAdditionResult,
  type BranchRemovalResult,
} from '../types';

export class DoWhileBranchStrategy implements MultiBranchStrategy {
  readonly taskType: DagNodeType = 'DO_WHILE';
  readonly minBranches: number = 1;
  readonly addActionLabel: string = 'Add Step';

  getBranches(data: DagNodeData): BranchDescriptor[] {
    const loopOver = data.loopOver || [];
    const branches: BranchDescriptor[] = loopOver.map((stepRef, idx) => ({
      id: `step_${idx + 1}`,
      label: `Loop Step ${idx + 1}`,
      handleId: idx === 0 ? 'loop-body' : 'source-right',
      targetTaskRef: stepRef,
      isRemovable: loopOver.length > 1,
      isDefault: false,
    }));

    // Loop Exit Forwarder
    branches.push({
      id: 'loop-exit',
      label: 'Loop Exit Completion',
      handleId: 'loop-exit',
      isRemovable: false,
      isDefault: true,
    });

    return branches;
  }

  addBranch(data: DagNodeData, options?: { name?: string }): BranchAdditionResult {
    const loopOver = [...(data.loopOver || [])];
    const nextIdx = loopOver.length + 1;
    const stepLabel = options?.name?.trim() || `Loop Step ${nextIdx}`;

    const uniqueSuffix = Date.now().toString().slice(-4);
    const targetTaskRef = `loop_step_${nextIdx}_${uniqueSuffix}`;

    loopOver.push(targetTaskRef);

    const newBranch: BranchDescriptor = {
      id: `step_${nextIdx}`,
      label: stepLabel,
      handleId: loopOver.length === 1 ? 'loop-body' : 'source-right',
      targetTaskRef,
      isRemovable: true,
      isDefault: false,
    };

    return {
      updatedParentData: {
        loopOver,
      },
      newBranch,
      suggestedTaskType: 'SIMPLE',
      initialBranchLabel: `${stepLabel} Task`,
    };
  }

  removeBranch(data: DagNodeData, branchId: string): BranchRemovalResult {
    if (branchId === 'loop-exit') {
      throw new Error('Loop exit port cannot be removed');
    }

    const loopOver = [...(data.loopOver || [])];
    if (loopOver.length <= this.minBranches) {
      throw new Error(`Cannot reduce DO_WHILE below ${this.minBranches} body steps`);
    }

    const match = branchId.match(/^step_(\d+)$/);
    const targetIdx = match ? parseInt(match[1], 10) - 1 : -1;

    let prunedTaskRefs: string[] = [];
    if (targetIdx >= 0 && targetIdx < loopOver.length) {
      prunedTaskRefs = [loopOver[targetIdx]];
      loopOver.splice(targetIdx, 1);
    } else {
      const foundIdx = loopOver.indexOf(branchId);
      if (foundIdx >= 0) {
        prunedTaskRefs = [loopOver[foundIdx]];
        loopOver.splice(foundIdx, 1);
      }
    }

    const removedBranch: BranchDescriptor = {
      id: branchId,
      label: `Step ${targetIdx >= 0 ? targetIdx + 1 : branchId}`,
      handleId: 'source-right',
      targetTaskRef: prunedTaskRefs[0],
      isRemovable: true,
    };

    return {
      updatedParentData: {
        loopOver,
      },
      removedBranch,
      prunedTaskRefs,
    };
  }

  findBarrierNode(
    parentNode: Node<DagNodeData>,
    _nodes: Node<DagNodeData>[],
    _edges: Edge[]
  ): Node<DagNodeData> | null {
    // For DO_WHILE, loopback returns directly to parent node
    return parentNode;
  }

  syncBarrierNode(
    _barrierNode: Node<DagNodeData>,
    _action: 'add' | 'remove',
    _branchRef: string
  ): Partial<DagNodeData> {
    return {};
  }
}
