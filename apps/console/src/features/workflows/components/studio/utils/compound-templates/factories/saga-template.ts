import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeType, type DagNodeData } from '../../../canvas/dag-node';
import { type CompoundTemplateFactory, type CompoundTemplateOptions, type CompoundTemplateResult } from '../types';

export class SagaTemplateFactory implements CompoundTemplateFactory {
  readonly taskType: DagNodeType = 'SIMPLE';

  supports(type: DagNodeType): boolean {
    return (
      type === 'SIMPLE' &&
      Boolean(arguments[1]?.isSagaCompensable || arguments[1]?.customData?.compensateHandlerRef)
    );
  }

  create(basePos: { x: number; y: number }, options?: CompoundTemplateOptions): CompoundTemplateResult {
    const suffix = options?.uniqueSuffix || Date.now().toString().slice(-4);
    const targetType = options?.customData?.taskType || 'SIMPLE';

    const mainRef = `${targetType.toLowerCase()}_action_${suffix}`;
    const mainNodeId = `node-${mainRef}`;

    const compRef = `${targetType.toLowerCase()}_rollback_${suffix}`;
    const compNodeId = `node-${compRef}`;

    const mainNode: Node<DagNodeData> = {
      id: mainNodeId,
      type: 'dagNode',
      position: { x: basePos.x, y: basePos.y },
      data: {
        taskReferenceName: mainRef,
        taskType: targetType,
        label: options?.label || `${targetType} (Transactional)`,
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        compensateHandlerRef: compRef,
        ...options?.customData,
      },
    };

    const compNode: Node<DagNodeData> = {
      id: compNodeId,
      type: 'dagNode',
      position: { x: basePos.x, y: basePos.y + 110 },
      data: {
        taskReferenceName: compRef,
        taskType: 'SIMPLE',
        label: `Rollback ${options?.label || targetType}`,
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
      },
    };

    const compEdge: Edge = {
      id: `e_${mainNodeId}_to_${compNodeId}_comp`,
      type: 'dagEdge',
      source: mainNodeId,
      target: compNodeId,
      sourceHandle: 'compensate',
      targetHandle: 'target-left',
      label: 'COMPENSATE',
      animated: true,
      data: { isCompensationEdge: true },
    };

    return {
      nodes: [mainNode, compNode],
      edges: [compEdge],
      primaryNodeId: mainNodeId,
      exitNodeId: mainNodeId,
      exitHandle: 'source-right',
      envelopeWidth: 180,
      envelopeHeight: 180,
    };
  }
}
