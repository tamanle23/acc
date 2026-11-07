import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeType, type DagNodeData } from '../../../canvas/dag-node';
import { type CompoundTemplateFactory, type CompoundTemplateOptions, type CompoundTemplateResult } from '../types';

export class HumanTemplateFactory implements CompoundTemplateFactory {
  readonly taskType: DagNodeType = 'HUMAN';

  supports(type: DagNodeType): boolean {
    return type === 'HUMAN';
  }

  create(basePos: { x: number; y: number }, options?: CompoundTemplateOptions): CompoundTemplateResult {
    const suffix = options?.uniqueSuffix || Date.now().toString().slice(-4);

    const humanRef = `human_${suffix}`;
    const humanNodeId = `node-${humanRef}`;

    const approveRef = `approve_action_${suffix}`;
    const approveNodeId = `node-${approveRef}`;

    const rejectRef = `reject_term_${suffix}`;
    const rejectNodeId = `node-${rejectRef}`;

    const humanNode: Node<DagNodeData> = {
      id: humanNodeId,
      type: 'dagNode',
      position: { x: basePos.x, y: basePos.y },
      data: {
        taskReferenceName: humanRef,
        taskType: 'HUMAN',
        label: options?.label || 'Human Review',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        humanParams: {
          role: 'WORKFLOW_APPROVER',
          slaMinutes: 120,
          instructions: 'Review and approve customer verification.',
        },
        ...options?.customData,
      },
    };

    const approveNode: Node<DagNodeData> = {
      id: approveNodeId,
      type: 'dagNode',
      position: { x: basePos.x + 240, y: basePos.y - 60 },
      data: {
        taskReferenceName: approveRef,
        taskType: 'SIMPLE',
        label: 'Process Approval',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
      },
    };

    const rejectNode: Node<DagNodeData> = {
      id: rejectNodeId,
      type: 'dagNode',
      position: { x: basePos.x + 240, y: basePos.y + 60 },
      data: {
        taskReferenceName: rejectRef,
        taskType: 'TERMINATE',
        label: 'Reject & Terminate',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        terminateParams: {
          terminationStatus: 'FAILED',
          terminationReason: 'Rejected in human review',
        },
      },
    };

    const approveEdge: Edge = {
      id: `e_${humanNodeId}_to_${approveNodeId}`,
      type: 'dagEdge',
      source: humanNodeId,
      target: approveNodeId,
      sourceHandle: 'approved',
      targetHandle: 'target-left',
      label: 'APPROVED',
      animated: true,
    };

    const rejectEdge: Edge = {
      id: `e_${humanNodeId}_to_${rejectNodeId}`,
      type: 'dagEdge',
      source: humanNodeId,
      target: rejectNodeId,
      sourceHandle: 'rejected',
      targetHandle: 'target-left',
      label: 'REJECTED',
      animated: true,
    };

    return {
      nodes: [humanNode, approveNode, rejectNode],
      edges: [approveEdge, rejectEdge],
      primaryNodeId: humanNodeId,
      exitNodeId: approveNodeId,
      exitHandle: 'source-right',
      envelopeWidth: 240,
      envelopeHeight: 140,
    };
  }
}
