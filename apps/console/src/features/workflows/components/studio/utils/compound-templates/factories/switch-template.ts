import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeType, type DagNodeData } from '../../../canvas/dag-node';
import { type CompoundTemplateFactory, type CompoundTemplateOptions, type CompoundTemplateResult } from '../types';

export class SwitchTemplateFactory implements CompoundTemplateFactory {
  readonly taskType: DagNodeType = 'SWITCH';

  supports(type: DagNodeType): boolean {
    return type === 'SWITCH';
  }

  create(basePos: { x: number; y: number }, options?: CompoundTemplateOptions): CompoundTemplateResult {
    const suffix = options?.uniqueSuffix || Date.now().toString().slice(-4);

    const switchRef = `switch_${suffix}`;
    const switchNodeId = `node-${switchRef}`;

    const c1Ref = `case_1_${suffix}`;
    const c1NodeId = `node-${c1Ref}`;

    const c2Ref = `case_2_${suffix}`;
    const c2NodeId = `node-${c2Ref}`;

    const cdRef = `default_${suffix}`;
    const cdNodeId = `node-${cdRef}`;

    const ejRef = `exclusive_join_${suffix}`;
    const ejNodeId = `node-${ejRef}`;

    const switchNode: Node<DagNodeData> = {
      id: switchNodeId,
      type: 'dagNode',
      position: { x: basePos.x, y: basePos.y },
      data: {
        taskReferenceName: switchRef,
        taskType: 'SWITCH',
        label: options?.label || 'Switch Router',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        condition: '${workflow.input.case}',
        decisionCases: {
          case_1: [c1Ref],
          case_2: [c2Ref],
        },
        defaultCase: [cdRef],
        ...options?.customData,
      },
    };

    const c1Node: Node<DagNodeData> = {
      id: c1NodeId,
      type: 'dagNode',
      position: { x: basePos.x + 260, y: basePos.y - 100 },
      data: {
        taskReferenceName: c1Ref,
        taskType: 'SIMPLE',
        label: 'Case 1 Action',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
      },
    };

    const c2Node: Node<DagNodeData> = {
      id: c2NodeId,
      type: 'dagNode',
      position: { x: basePos.x + 260, y: basePos.y },
      data: {
        taskReferenceName: c2Ref,
        taskType: 'SIMPLE',
        label: 'Case 2 Action',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
      },
    };

    const cdNode: Node<DagNodeData> = {
      id: cdNodeId,
      type: 'dagNode',
      position: { x: basePos.x + 260, y: basePos.y + 100 },
      data: {
        taskReferenceName: cdRef,
        taskType: 'SIMPLE',
        label: 'Default Action',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
      },
    };

    const ejNode: Node<DagNodeData> = {
      id: ejNodeId,
      type: 'dagNode',
      position: { x: basePos.x + 520, y: basePos.y },
      data: {
        taskReferenceName: ejRef,
        taskType: 'EXCLUSIVE_JOIN',
        label: 'Switch Merge',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        joinOn: [c1Ref, c2Ref, cdRef],
      },
    };

    const edges: Edge[] = [
      {
        id: `e_${switchNodeId}_to_${c1NodeId}`,
        type: 'dagEdge',
        source: switchNodeId,
        target: c1NodeId,
        sourceHandle: 'case-case_1',
        targetHandle: 'target-left',
        label: 'case_1',
        animated: true,
      },
      {
        id: `e_${switchNodeId}_to_${c2NodeId}`,
        type: 'dagEdge',
        source: switchNodeId,
        target: c2NodeId,
        sourceHandle: 'case-case_2',
        targetHandle: 'target-left',
        label: 'case_2',
        animated: true,
      },
      {
        id: `e_${switchNodeId}_to_${cdNodeId}`,
        type: 'dagEdge',
        source: switchNodeId,
        target: cdNodeId,
        sourceHandle: 'case-default',
        targetHandle: 'target-left',
        label: 'default',
        animated: true,
      },
      {
        id: `e_${c1NodeId}_to_${ejNodeId}`,
        type: 'dagEdge',
        source: c1NodeId,
        target: ejNodeId,
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        animated: true,
      },
      {
        id: `e_${c2NodeId}_to_${ejNodeId}`,
        type: 'dagEdge',
        source: c2NodeId,
        target: ejNodeId,
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        animated: true,
      },
      {
        id: `e_${cdNodeId}_to_${ejNodeId}`,
        type: 'dagEdge',
        source: cdNodeId,
        target: ejNodeId,
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        animated: true,
      },
    ];

    return {
      nodes: [switchNode, c1Node, c2Node, cdNode, ejNode],
      edges,
      primaryNodeId: switchNodeId,
      exitNodeId: ejNodeId,
      exitHandle: 'source-right',
      envelopeWidth: 520,
      envelopeHeight: 240,
    };
  }
}
