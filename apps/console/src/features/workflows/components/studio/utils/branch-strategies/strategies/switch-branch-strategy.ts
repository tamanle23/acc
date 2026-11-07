import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData, type DagNodeType } from '../../../canvas/dag-node';
import {
  type MultiBranchStrategy,
  type BranchDescriptor,
  type BranchAdditionResult,
  type BranchRemovalResult,
} from '../types';

export class SwitchBranchStrategy implements MultiBranchStrategy {
  readonly taskType: DagNodeType = 'SWITCH';
  readonly minBranches: number = 2; // 1 explicit case + default
  readonly addActionLabel: string = 'Add Case';

  getBranches(data: DagNodeData): BranchDescriptor[] {
    const branches: BranchDescriptor[] = [];
    const decisionCases = data.decisionCases || {};

    for (const [caseKey, taskRefs] of Object.entries(decisionCases)) {
      branches.push({
        id: caseKey,
        label: `Case: ${caseKey}`,
        handleId: `case-${caseKey}`,
        targetTaskRef: taskRefs[0],
        isRemovable: true,
        isDefault: false,
      });
    }

    // Default Case is always present as fallback
    branches.push({
      id: 'default',
      label: 'Default Fallback',
      handleId: 'case-default',
      targetTaskRef: data.defaultCase?.[0],
      isRemovable: false,
      isDefault: true,
    });

    return branches;
  }

  addBranch(data: DagNodeData, options?: { name?: string }): BranchAdditionResult {
    const decisionCases = { ...(data.decisionCases || {}) };
    const existingKeys = Object.keys(decisionCases);

    let caseKey = options?.name?.trim();
    if (!caseKey) {
      let idx = existingKeys.length + 1;
      while (existingKeys.includes(`case_${idx}`)) {
        idx++;
      }
      caseKey = `case_${idx}`;
    }

    const uniqueSuffix = Date.now().toString().slice(-4);
    const targetTaskRef = `${caseKey}_action_${uniqueSuffix}`;

    decisionCases[caseKey] = [targetTaskRef];

    const newBranch: BranchDescriptor = {
      id: caseKey,
      label: `Case: ${caseKey}`,
      handleId: `case-${caseKey}`,
      targetTaskRef,
      isRemovable: true,
      isDefault: false,
    };

    return {
      updatedParentData: {
        decisionCases,
      },
      newBranch,
      suggestedTaskType: 'SIMPLE',
      initialBranchLabel: `${caseKey.toUpperCase()} Action`,
    };
  }

  removeBranch(data: DagNodeData, branchId: string): BranchRemovalResult {
    if (branchId === 'default') {
      throw new Error('Default fallback branch cannot be removed');
    }

    const decisionCases = { ...(data.decisionCases || {}) };
    const prunedTaskRefs = decisionCases[branchId] ? [...decisionCases[branchId]] : [];
    delete decisionCases[branchId];

    const removedBranch: BranchDescriptor = {
      id: branchId,
      label: `Case: ${branchId}`,
      handleId: `case-${branchId}`,
      targetTaskRef: prunedTaskRefs[0],
      isRemovable: true,
      isDefault: false,
    };

    return {
      updatedParentData: {
        decisionCases,
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

      if (currNode && currNode.id !== parentNode.id && currNode.data.taskType === 'EXCLUSIVE_JOIN') {
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
      nodes.find((n) => n.data.taskType === 'EXCLUSIVE_JOIN') ||
      nodes.find((n) => n.data.isEndNode || n.data.taskType === 'END_WORKFLOW') ||
      null
    );
  }

  syncBarrierNode(
    barrierNode: Node<DagNodeData>,
    action: 'add' | 'remove',
    branchRef: string
  ): Partial<DagNodeData> {
    if (barrierNode.data.taskType !== 'EXCLUSIVE_JOIN') {
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
