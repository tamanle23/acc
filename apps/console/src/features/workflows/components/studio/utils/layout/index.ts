import type { DagLayoutEngineStrategy, LayoutAlgorithm } from './dag-layout-strategy';
import { DagreRankLayoutStrategy } from './dagre-rank-layout-strategy';
import { ElkCompactLayoutStrategy } from './elk-compact-layout-strategy';

export * from './dag-layout-strategy';
export * from './dagre-rank-layout-strategy';
export * from './elk-compact-layout-strategy';

const strategyRegistry: Record<LayoutAlgorithm, DagLayoutEngineStrategy> = {
  dagre: new DagreRankLayoutStrategy(),
  elk: new ElkCompactLayoutStrategy(),
};

export function getLayoutStrategy(algorithm: LayoutAlgorithm = 'dagre'): DagLayoutEngineStrategy {
  return strategyRegistry[algorithm] ?? strategyRegistry.dagre;
}

export const AVAILABLE_LAYOUT_STRATEGIES: { id: LayoutAlgorithm; name: string; description: string }[] = [
  {
    id: 'dagre',
    name: 'Dagre (Hierarchical)',
    description: 'Sugiyama layered rank ordering with barycentric crossing reduction',
  },
  {
    id: 'elk',
    name: 'ELK (Compact Orthogonal)',
    description: 'High-density compaction with spine alignment and orthogonal clearance',
  },
];
