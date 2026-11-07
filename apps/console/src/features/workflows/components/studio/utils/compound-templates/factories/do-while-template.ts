import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeType, type DagNodeData } from '../../../canvas/dag-node';
import { type CompoundTemplateFactory, type CompoundTemplateOptions, type CompoundTemplateResult } from '../types';

export class DoWhileTemplateFactory implements CompoundTemplateFactory {
  readonly taskType: DagNodeType = 'DO_WHILE';

  supports(type: DagNodeType): boolean {
    return type === 'DO_WHILE';
  }

  create(basePos: { x: number; y: number }, options?: CompoundTemplateOptions): CompoundTemplateResult {
    const suffix = options?.uniqueSuffix || Date.now().toString().slice(-4);

    const loopRef = `do_while_${suffix}`;
    const loopNodeId = `node-${loopRef}`;

    const bodyRef = `loop_step_${suffix}`;
    const bodyNodeId = `node-${bodyRef}`;

    const loopNode: Node<DagNodeData> = {
      id: loopNodeId,
      type: 'dagNode',
      position: { x: basePos.x, y: basePos.y },
      data: {
        taskReferenceName: loopRef,
        taskType: 'DO_WHILE',
        label: options?.label || 'Do-While Loop',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
        condition: '${workflow.iteration < 5}',
        loopOver: [bodyRef],
        ...options?.customData,
      },
    };

    const bodyNode: Node<DagNodeData> = {
      id: bodyNodeId,
      type: 'dagNode',
      position: { x: basePos.x + 240, y: basePos.y - 60 },
      data: {
        taskReferenceName: bodyRef,
        taskType: 'SIMPLE',
        label: 'Loop Step 1',
        executionState: 'PENDING',
        domain: 'default',
        timeoutSeconds: 30,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: {},
      },
    };

    const bodyEdge: Edge = {
      id: `e_${loopNodeId}_${bodyNodeId}_body`,
      type: 'dagEdge',
      source: loopNodeId,
      target: bodyNodeId,
      sourceHandle: 'loop-body',
      targetHandle: 'target-left',
      label: 'BODY',
      animated: true,
      data: {},
    };

    const loopbackEdge: Edge = {
      id: `e_${bodyNodeId}_${loopNodeId}_back`,
      type: 'dagEdge',
      source: bodyNodeId,
      target: loopNodeId,
      sourceHandle: 'source-right',
      targetHandle: 'loop-back',
      label: 'LOOP-BACK',
      animated: true,
      data: { isLoopbackEdge: true },
    };

    return {
      nodes: [loopNode, bodyNode],
      edges: [bodyEdge, loopbackEdge],
      primaryNodeId: loopNodeId,
      exitNodeId: loopNodeId,
      exitHandle: 'loop-exit',
      envelopeWidth: 240,
      envelopeHeight: 140,
    };
  }
}
