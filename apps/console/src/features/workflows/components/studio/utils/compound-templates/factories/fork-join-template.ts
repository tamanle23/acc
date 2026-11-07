import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeType, type DagNodeData } from '../../../canvas/dag-node';
import { type CompoundTemplateFactory, type CompoundTemplateOptions, type CompoundTemplateResult } from '../types';

export class ForkJoinTemplateFactory implements CompoundTemplateFactory {
  readonly taskType: DagNodeType = 'FORK_JOIN';

  supports(type: DagNodeType): boolean {
    return type === 'FORK_JOIN' || type === 'DYNAMIC_FORK';
  }

  create(basePos: { x: number; y: number }, options?: CompoundTemplateOptions): CompoundTemplateResult {
    const isDynamic = options?.customData?.taskType === 'DYNAMIC_FORK';
    const suffix = options?.uniqueSuffix || Date.now().toString().slice(-4);

    if (isDynamic) {
      return this.createDynamicForkTemplate(basePos, suffix, options);
    }
    return this.createStaticForkJoinTemplate(basePos, suffix, options);
  }

  private createStaticForkJoinTemplate(
    basePos: { x: number; y: number },
    suffix: string,
    options?: CompoundTemplateOptions
  ): CompoundTemplateResult {
    const forkRef = `fork_${suffix}`;
    const forkNodeId = `node-${forkRef}`;

    const b1Ref = `fork_branch_1_${suffix}`;
    const b1NodeId = `node-${b1Ref}`;

    const b2Ref = `fork_branch_2_${suffix}`;
    const b2NodeId = `node-${b2Ref}`;

    const joinRef = `join_${suffix}`;
    const joinNodeId = `node-${joinRef}`;

    const forkNode: Node<DagNodeData> = {
      id: forkNodeId,
      type: 'dagNode',
      position: { x: basePos.x, y: basePos.y },
      data: {
        taskReferenceName: forkRef,
        taskType: 'FORK_JOIN',
        label: options?.label || 'Parallel Fork',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        forkTasks: [[b1Ref], [b2Ref]],
        ...options?.customData,
      },
    };

    const b1Node: Node<DagNodeData> = {
      id: b1NodeId,
      type: 'dagNode',
      position: { x: basePos.x + 240, y: basePos.y - 80 },
      data: {
        taskReferenceName: b1Ref,
        taskType: 'SIMPLE',
        label: 'Branch Task 1',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
      },
    };

    const b2Node: Node<DagNodeData> = {
      id: b2NodeId,
      type: 'dagNode',
      position: { x: basePos.x + 240, y: basePos.y + 80 },
      data: {
        taskReferenceName: b2Ref,
        taskType: 'SIMPLE',
        label: 'Branch Task 2',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
      },
    };

    const joinNode: Node<DagNodeData> = {
      id: joinNodeId,
      type: 'dagNode',
      position: { x: basePos.x + 480, y: basePos.y },
      data: {
        taskReferenceName: joinRef,
        taskType: 'JOIN',
        label: 'Parallel Join',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        joinOn: [b1Ref, b2Ref],
      },
    };

    const edges: Edge[] = [
      {
        id: `e_${forkNodeId}_to_${b1NodeId}`,
        type: 'dagEdge',
        source: forkNodeId,
        target: b1NodeId,
        sourceHandle: 'source',
        targetHandle: 'target',
        label: 'Branch 1',
        animated: true,
      },
      {
        id: `e_${forkNodeId}_to_${b2NodeId}`,
        type: 'dagEdge',
        source: forkNodeId,
        target: b2NodeId,
        sourceHandle: 'source',
        targetHandle: 'target',
        label: 'Branch 2',
        animated: true,
      },
      {
        id: `e_${b1NodeId}_to_${joinNodeId}`,
        type: 'dagEdge',
        source: b1NodeId,
        target: joinNodeId,
        sourceHandle: 'source',
        targetHandle: 'target',
        animated: true,
      },
      {
        id: `e_${b2NodeId}_to_${joinNodeId}`,
        type: 'dagEdge',
        source: b2NodeId,
        target: joinNodeId,
        sourceHandle: 'source',
        targetHandle: 'target',
        animated: true,
      },
    ];

    return {
      nodes: [forkNode, b1Node, b2Node, joinNode],
      edges,
      primaryNodeId: forkNodeId,
      exitNodeId: joinNodeId,
      exitHandle: 'source',
      envelopeWidth: 480,
      envelopeHeight: 180,
    };
  }

  private createDynamicForkTemplate(
    basePos: { x: number; y: number },
    suffix: string,
    options?: CompoundTemplateOptions
  ): CompoundTemplateResult {
    const dynamicForkRef = `dynamic_fork_${suffix}`;
    const dynamicForkNodeId = `node-${dynamicForkRef}`;

    const joinRef = `join_${suffix}`;
    const joinNodeId = `node-${joinRef}`;

    const dynamicForkNode: Node<DagNodeData> = {
      id: dynamicForkNodeId,
      type: 'dagNode',
      position: { x: basePos.x, y: basePos.y },
      data: {
        taskReferenceName: dynamicForkRef,
        taskType: 'DYNAMIC_FORK',
        label: options?.label || 'Dynamic Fork',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        ...options?.customData,
      },
    };

    const joinNode: Node<DagNodeData> = {
      id: joinNodeId,
      type: 'dagNode',
      position: { x: basePos.x + 260, y: basePos.y },
      data: {
        taskReferenceName: joinRef,
        taskType: 'JOIN',
        label: 'Dynamic Join',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        joinOn: [dynamicForkRef],
      },
    };

    const edge: Edge = {
      id: `e_${dynamicForkNodeId}_to_${joinNodeId}`,
      type: 'dagEdge',
      source: dynamicForkNodeId,
      target: joinNodeId,
      sourceHandle: 'source',
      targetHandle: 'target',
      animated: true,
    };

    return {
      nodes: [dynamicForkNode, joinNode],
      edges: [edge],
      primaryNodeId: dynamicForkNodeId,
      exitNodeId: joinNodeId,
      exitHandle: 'source',
      envelopeWidth: 260,
      envelopeHeight: 80,
    };
  }
}
