import type { Node, Edge } from '@xyflow/react';
import type { DagNodeData } from '../../canvas/dag-node';
import type { DagLayoutEngineStrategy, DagLayoutOptions, DagLayoutResult } from './dag-layout-strategy';

/**
 * DagreRankLayoutStrategy
 * Pure TypeScript implementation of the Sugiyama hierarchical layout:
 * 1. Cycle removal / DAG layering using longest path
 * 2. Barycentric heuristic for edge-crossing minimization between adjacent layers
 * 3. Symmetrical coordinate assignment with rank and sibling separation
 */
export class DagreRankLayoutStrategy implements DagLayoutEngineStrategy {
  public readonly id = 'dagre' as const;
  public readonly name = 'Dagre Hierarchical';
  public readonly description = 'Layered hierarchical rank layout with barycentric crossing reduction';

  public layout(
    nodes: Node<DagNodeData>[],
    edges: Edge[],
    options: DagLayoutOptions = {}
  ): DagLayoutResult {
    if (nodes.length === 0) {
      return { nodes: [], edges };
    }

    const direction = options.direction ?? 'LR';
    const nodeWidth = options.nodeWidth ?? 240;
    const nodeHeight = options.nodeHeight ?? 90;
    const rankSep = options.rankSep ?? 80;
    const nodeSep = options.nodeSep ?? 40;

    const nodeIds = new Set(nodes.map((n) => n.id));
    const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    // 1. Build adjacency maps
    const successors = new Map<string, string[]>();
    const predecessors = new Map<string, string[]>();
    nodes.forEach((n) => {
      successors.set(n.id, []);
      predecessors.set(n.id, []);
    });

    validEdges.forEach((e) => {
      successors.get(e.source)!.push(e.target);
      predecessors.get(e.target)!.push(e.source);
    });

    // 2. Longest-path layering (Sugiyama Layer 1)
    const inDegree = new Map<string, number>();
    nodes.forEach((n) => {
      inDegree.set(n.id, (predecessors.get(n.id) || []).length);
    });

    const layerMap = new Map<string, number>();
    const roots: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) {
        roots.push(id);
        layerMap.set(id, 0);
      }
    });

    // If cyclic or no roots, seed first node as layer 0
    if (roots.length === 0 && nodes.length > 0) {
      roots.push(nodes[0].id);
      layerMap.set(nodes[0].id, 0);
    }

    const queue = [...roots];
    const visited = new Set<string>(roots);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currLayer = layerMap.get(curr) || 0;

      for (const next of successors.get(curr) || []) {
        const existingLayer = layerMap.get(next) ?? -1;
        const newLayer = Math.max(existingLayer, currLayer + 1);
        layerMap.set(next, newLayer);

        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    // Assign any unvisited orphaned nodes to layer 0
    nodes.forEach((n) => {
      if (!layerMap.has(n.id)) {
        layerMap.set(n.id, 0);
      }
    });

    // 3. Group nodes into ranks
    const maxRank = Math.max(...Array.from(layerMap.values()), 0);
    const ranks: string[][] = Array.from({ length: maxRank + 1 }, () => []);

    nodes.forEach((n) => {
      const r = layerMap.get(n.id) ?? 0;
      ranks[r].push(n.id);
    });

    // 4. Barycentric heuristic for crossing minimization (rank 1 to maxRank)
    for (let r = 1; r <= maxRank; r++) {
      const prevRank = ranks[r - 1];
      const prevPositionMap = new Map<string, number>();
      prevRank.forEach((id, idx) => prevPositionMap.set(id, idx));

      const rankNodes = ranks[r];
      const barycenters = rankNodes.map((nodeId, originalIdx) => {
        const preds = predecessors.get(nodeId) || [];
        const connectedPreds = preds.filter((p) => prevPositionMap.has(p));
        if (connectedPreds.length === 0) {
          return { id: nodeId, barycenter: originalIdx };
        }
        const sum = connectedPreds.reduce((acc, p) => acc + prevPositionMap.get(p)!, 0);
        return { id: nodeId, barycenter: sum / connectedPreds.length };
      });

      barycenters.sort((a, b) => a.barycenter - b.barycenter);
      ranks[r] = barycenters.map((b) => b.id);
    }

    // 5. Position assignment with vertical / horizontal centering
    const maxLayerNodes = Math.max(...ranks.map((r) => r.length), 1);
    const maxSpan = maxLayerNodes * nodeHeight + (maxLayerNodes - 1) * nodeSep;

    const positions = new Map<string, { x: number; y: number }>();

    ranks.forEach((rankNodes, r) => {
      const layerSpan = rankNodes.length * nodeHeight + (rankNodes.length - 1) * nodeSep;
      const centeringOffset = (maxSpan - layerSpan) / 2;

      rankNodes.forEach((nodeId, idx) => {
        if (direction === 'LR') {
          const x = 60 + r * (nodeWidth + rankSep);
          const y = 80 + centeringOffset + idx * (nodeHeight + nodeSep);
          positions.set(nodeId, { x: Math.round(x), y: Math.round(y) });
        } else {
          // TB: direction is top to bottom
          const tbMaxSpan = maxLayerNodes * nodeWidth + (maxLayerNodes - 1) * nodeSep;
          const tbLayerSpan = rankNodes.length * nodeWidth + (rankNodes.length - 1) * nodeSep;
          const tbOffset = (tbMaxSpan - tbLayerSpan) / 2;
          const x = 80 + tbOffset + idx * (nodeWidth + nodeSep);
          const y = 60 + r * (nodeHeight + rankSep);
          positions.set(nodeId, { x: Math.round(x), y: Math.round(y) });
        }
      });
    });

    const updatedNodes = nodes.map((node) => {
      const pos = positions.get(node.id) || node.position;
      return {
        ...node,
        position: pos,
      };
    });

    return { nodes: updatedNodes, edges };
  }
}
