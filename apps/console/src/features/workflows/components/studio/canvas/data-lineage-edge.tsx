import React, { memo } from 'react';
import {
  type EdgeProps,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  type Node,
} from '@xyflow/react';
import { type DagNodeData } from './dag-node';
import { cn } from '@/lib/utils';

export interface DataLineageEdgeData {
  sourceTaskRef: string;
  targetTaskRef: string;
  paramKey: string;
  expression: string;
  isHighlighted?: boolean;
}

/**
 * Extracts all data dependencies across nodes, matching:
 * - ${taskRef.output.path} -> edge from taskRef to consumer
 * - ${workflow.input.param} -> edge from START_WORKFLOW to consumer
 */
export function buildDataLineageEdges(nodes: Node<DagNodeData>[]): Array<{
  id: string;
  source: string;
  target: string;
  type: string;
  animated: boolean;
  data: DataLineageEdgeData;
}> {
  const nodeMap = new Map(nodes.map((n) => [n.data.taskReferenceName, n]));
  const startNode = nodes.find((n) => n.data.taskType === 'START_WORKFLOW' || n.data.isStartNode);

  const lineageEdges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    animated: boolean;
    data: DataLineageEdgeData;
  }> = [];

  const seenEdges = new Set<string>();

  const exprRegex = /\$\{([a-zA-Z0-9_-]+)\.(output|input)(\.[^}]+)?\}/g;

  for (const targetNode of nodes) {
    const inputParams = targetNode.data.inputParameters || {};

    for (const [paramKey, val] of Object.entries(inputParams)) {
      const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
      let match: RegExpExecArray | null;

      while ((match = exprRegex.exec(valStr)) !== null) {
        const [fullExpr, sourceRef, refType, propPath] = match;

        let sourceNode: Node<DagNodeData> | undefined;
        if (sourceRef === 'workflow' && refType === 'input' && startNode) {
          sourceNode = startNode;
        } else {
          sourceNode = nodeMap.get(sourceRef);
        }

        if (sourceNode && sourceNode.id !== targetNode.id) {
          const edgeId = `lineage_${sourceNode.id}_${targetNode.id}_${paramKey}`;
          if (!seenEdges.has(edgeId)) {
            seenEdges.add(edgeId);
            lineageEdges.push({
              id: edgeId,
              source: sourceNode.id,
              target: targetNode.id,
              type: 'dataLineage',
              animated: true,
              data: {
                sourceTaskRef: sourceNode.data.taskReferenceName,
                targetTaskRef: targetNode.data.taskReferenceName,
                paramKey,
                expression: fullExpr,
              },
            });
          }
        }
      }
    }
  }

  return lineageEdges;
}

export const DataLineageEdgeComponent: React.FC<EdgeProps> = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  const lineageData = data as DataLineageEdgeData | undefined;
  const isHighlighted = lineageData?.isHighlighted ?? false;

  return (
    <>
      <path
        id={id}
        className={cn(
          'react-flow__edge-path transition-all duration-300 pointer-events-none',
          isHighlighted
            ? 'stroke-sky-400 dark:stroke-sky-300 stroke-[2.5px] opacity-100 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]'
            : 'stroke-sky-500/60 dark:stroke-sky-400/50 stroke-[1.5px] opacity-75'
        )}
        d={edgePath}
        markerEnd={markerEnd}
        strokeDasharray="4 4"
        style={{
          strokeLinecap: 'round',
        }}
        data-testid={`data-lineage-edge-${id}`}
      />

      {lineageData?.paramKey && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold transition-all shadow-xs',
              'bg-sky-500/15 dark:bg-sky-500/25 border border-sky-500/40 text-sky-700 dark:text-sky-300 backdrop-blur-md',
              isHighlighted && 'scale-110 ring-1 ring-sky-400 font-bold'
            )}
            data-testid={`data-lineage-label-${lineageData.paramKey}`}
          >
            ↳ {lineageData.paramKey}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

DataLineageEdgeComponent.displayName = 'DataLineageEdgeComponent';
