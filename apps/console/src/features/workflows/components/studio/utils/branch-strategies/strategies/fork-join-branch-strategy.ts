import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData, type DagNodeType } from '../../../canvas/dag-node';
import {
  type MultiBranchStrategy,
  type BranchDescriptor,
  type BranchAdditionResult,
  type BranchRemovalResult,
} from '../types';

export class ForkJoinBranchStrategy implements MultiBranchStrategy {
  readonly taskType: DagNodeType = 'FORK_JOIN';
  readonly minBranches: number = 2;
  readonly addActionLabel: string = 'Add Branch';

  getBranches(data: DagNodeData): BranchDescriptor[] {
    const forkTasks: string[][] = data.forkTasks || [];
    return forkTasks.map((branchTasks, idx) => ({
      id: `branch_${idx + 1}`,
      label: `Branch ${idx + 1}`,
      handleId: 'source-right',
      targetTaskRef: branchTasks[0],
      isRemovable: forkTasks.length > 2,
      isDefault: false,
    }));
  }

  addBranch(data: DagNodeData, options?: { name?: string }): BranchAdditionResult {
    const forkTasks: string[][] = (data.forkTasks || []).map((b) => [...b]);
    const nextIdx = forkTasks.length + 1;
    const branchLabel = options?.name?.trim() || `Branch ${nextIdx}`;

    const uniqueSuffix = Date.now().toString().slice(-4);
    const targetTaskRef = `fork_branch_${nextIdx}_${uniqueSuffix}`;

    forkTasks.push([targetTaskRef]);

    const newBranch: BranchDescriptor = {
      id: `branch_${nextIdx}`,
      label: branchLabel,
      handleId: 'source-right',
      targetTaskRef,
      isRemovable: true,
      isDefault: false,
    };

    return {
      updatedParentData: {
        forkTasks,
      },
      newBranch,
      suggestedTaskType: 'SIMPLE',
      initialBranchLabel: `${branchLabel} Action`,
    };
  }

  removeBranch(data: DagNodeData, branchId: string): BranchRemovalResult {
    const forkTasks: string[][] = (data.forkTasks || []).map((b) => [...b]);
    if (forkTasks.length <= this.minBranches) {
      throw new Error(`Cannot reduce FORK_JOIN below ${this.minBranches} parallel branches`);
    }

    // Parse branch index (e.g. 'branch_3' -> index 2)
    const match = branchId.match(/^branch_(\d+)$/);
    const targetIdx = match ? parseInt(match[1], 10) - 1 : -1;

    let prunedTaskRefs: string[] = [];
    if (targetIdx >= 0 && targetIdx < forkTasks.length) {
      prunedTaskRefs = forkTasks[targetIdx];
      forkTasks.splice(targetIdx, 1);
    } else {
      // Fallback: match by task ref if branchId is a task ref
      const foundIdx = forkTasks.findIndex((b) => b.includes(branchId));
      if (foundIdx >= 0) {
        prunedTaskRefs = forkTasks[foundIdx];
        forkTasks.splice(foundIdx, 1);
      }
    }

    const removedBranch: BranchDescriptor = {
      id: branchId,
      label: `Branch ${targetIdx >= 0 ? targetIdx + 1 : branchId}`,
      handleId: 'source-right',
      targetTaskRef: prunedTaskRefs[0],
      isRemovable: true,
    };

    return {
      updatedParentData: {
        forkTasks,
      },
      removedBranch,
      prunedTaskRefs,
    };
  }

  findBarrierNode(
    parentNode: Node<DagNodeData>,
    nodes: Node<DagNodeData>[],
    edges: Edge[]
  ): Node<DagNodeData> | null {
    const nodeMap = new Map<string, Node<DagNodeData>>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    const visited = new Set<string>();
    const queue: string[] = [parentNode.id];
    visited.add(parentNode.id);

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currNode = nodeMap.get(currId);

      if (currNode && currNode.id !== parentNode.id && currNode.data.taskType === 'JOIN') {
        return currNode;
      }

      for (const edge of edges) {
        if (edge.source === currId && edge.targetHandle !== 'loop-back') {
          if (!visited.has(edge.target)) {
            visited.add(edge.target);
            queue.push(edge.target);
          }
        }
      }
    }

    return (
      nodes.find((n) => n.data.taskType === 'JOIN') ||
      nodes.find((n) => n.data.isEndNode || n.data.taskType === 'END_WORKFLOW') ||
      null
    );
  }

  syncBarrierNode(
    barrierNode: Node<DagNodeData>,
    action: 'add' | 'remove',
    branchRef: string
  ): Partial<DagNodeData> {
    if (barrierNode.data.taskType !== 'JOIN') {
      return {};
    }

    let joinOn = [...(barrierNode.data.joinOn || [])];
    if (action === 'add') {
      if (!joinOn.includes(branchRef)) {
        joinOn.push(branchRef);
      }
    } else if (action === 'remove') {
      joinOn = joinOn.filter((ref) => ref !== branchRef);
    }

    return { joinOn };
  }
}
