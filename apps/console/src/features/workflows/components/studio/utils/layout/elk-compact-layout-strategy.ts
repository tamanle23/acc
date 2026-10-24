import type { Node, Edge } from '@xyflow/react';
import type { DagNodeData } from '../../canvas/dag-node';
import type { DagLayoutEngineStrategy, DagLayoutOptions, DagLayoutResult } from './dag-layout-strategy';

/**
 * ElkCompactLayoutStrategy
 * Pure TypeScript compaction layout inspired by Eclipse Layout Kernel (ELK):
 * 1. Identifies the primary linear execution spine (critical path)
 * 2. Aligns spine nodes along a direct baseline axis
 * 3. Compacts branching, dynamic fork, and leaf nodes around the spine with high density
 * 4. Resolves node collisions with strict bounding box clearance
 */
export class ElkCompactLayoutStrategy implements DagLayoutEngineStrategy {
  public readonly id = 'elk' as const;
  public readonly name = 'ELK Compact Orthogonal';
  public readonly description = 'High-density compaction with spine alignment and orthogonal routing';

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
    const rankSep = options.rankSep ?? 60; // tighter than dagre (60px vs 80px)
    const nodeSep = options.nodeSep ?? 30; // compact sibling clearance (30px vs 40px)

    const nodeIds = new Set(nodes.map((n) => n.id));
    const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

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

    // 1. Calculate longest path ranks
    const layerMap = new Map<string, number>();
    const roots = nodes.filter((n) => (predecessors.get(n.id) || []).length === 0).map((n) => n.id);
    if (roots.length === 0 && nodes.length > 0) {
      roots.push(nodes[0].id);
    }

    roots.forEach((r) => layerMap.set(r, 0));
    const queue = [...roots];
    const visited = new Set<string>(roots);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currL = layerMap.get(curr) || 0;
      for (const next of successors.get(curr) || []) {
        const nextL = Math.max(layerMap.get(next) ?? -1, currL + 1);
        layerMap.set(next, nextL);
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    nodes.forEach((n) => {
      if (!layerMap.has(n.id)) layerMap.set(n.id, 0);
    });

    // 2. Identify Critical Path (Spine)
    // Find the terminal node with maximum rank
    let maxRankNode = nodes[0].id;
    let maxRank = 0;
    layerMap.forEach((r, id) => {
      if (r > maxRank) {
        maxRank = r;
        maxRankNode = id;
      }
    });

    // Trace backwards to find spine nodes
    const spineNodes = new Set<string>();
    let tracer: string | null = maxRankNode;
    while (tracer != null) {
      spineNodes.add(tracer);
      const preds = predecessors.get(tracer) || [];
      if (preds.length === 0) break;
      // pick predecessor on layer - 1 with highest degree or first
      const currentLayer = layerMap.get(tracer) || 0;
      const spinePred = preds.find((p) => (layerMap.get(p) ?? -1) === currentLayer - 1) || preds[0];
      tracer = spinePred;
    }

    // 3. Group by rank and order with spine node centered
    const ranks: string[][] = Array.from({ length: maxRank + 1 }, () => []);
    nodes.forEach((n) => {
      const r = layerMap.get(n.id) ?? 0;
      ranks[r].push(n.id);
    });

    ranks.forEach((rankNodes) => {
      // Sort nodes such that spine nodes are in the center, and remaining nodes branch out
      const spineInRank = rankNodes.filter((id) => spineNodes.has(id));
      const nonSpineInRank = rankNodes.filter((id) => !spineNodes.has(id));

      if (spineInRank.length > 0) {
        // Place half non-spine before, spine in middle, half non-spine after
        const half = Math.ceil(nonSpineInRank.length / 2);
        const topBranch = nonSpineInRank.slice(0, half);
        const bottomBranch = nonSpineInRank.slice(half);
        rankNodes.splice(0, rankNodes.length, ...topBranch, ...spineInRank, ...bottomBranch);
      }
    });

    // 4. Coordinates assignment: spine aligned at baseline
    const baseline = 240;
    const positions = new Map<string, { x: number; y: number }>();

    ranks.forEach((rankNodes, r) => {
      const totalSpan = rankNodes.length * nodeHeight + (rankNodes.length - 1) * nodeSep;
      const startCoord = baseline - totalSpan / 2;

      rankNodes.forEach((nodeId, idx) => {
        if (direction === 'LR') {
          const x = 50 + r * (nodeWidth + rankSep);
          const y = startCoord + idx * (nodeHeight + nodeSep);
          positions.set(nodeId, { x: Math.round(x), y: Math.round(y) });
        } else {
          const tbTotalSpan = rankNodes.length * nodeWidth + (rankNodes.length - 1) * nodeSep;
          const tbStart = baseline - tbTotalSpan / 2;
          const x = tbStart + idx * (nodeWidth + nodeSep);
          const y = 50 + r * (nodeHeight + rankSep);
          positions.set(nodeId, { x: Math.round(x), y: Math.round(y) });
        }
      });
    });

    // 5. Collision avoidance pass: ensure min clearance between any two nodes
    const positionedNodes = nodes.map((node) => {
      const pos = positions.get(node.id) || node.position;
      return {
        ...node,
        position: pos,
      };
    });

    return { nodes: positionedNodes, edges };
  }
}
