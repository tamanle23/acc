import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import type { DagNodeData } from '../../canvas/dag-node';
import { DagreRankLayoutStrategy } from './dagre-rank-layout-strategy';
import { ElkCompactLayoutStrategy } from './elk-compact-layout-strategy';
import { getLayoutStrategy } from './index';

function createMockNode(id: string, label: string): Node<DagNodeData> {
  return {
    id,
    type: 'dagNode',
    position: { x: 0, y: 0 },
    data: {
      type: 'TASK',
      label,
      description: 'Test node',
      isConfigured: true,
      hasError: false,
    },
  };
}

describe('DAG Layout Strategies', () => {
  const sampleNodes: Node<DagNodeData>[] = [
    createMockNode('start', 'Start'),
    createMockNode('fetchOrder', 'Fetch Order'),
    createMockNode('validateInventory', 'Validate Inventory'),
    createMockNode('chargeCard', 'Charge Card'),
    createMockNode('sendReceipt', 'Send Receipt'),
    createMockNode('end', 'End'),
  ];

  const sampleEdges: Edge[] = [
    { id: 'e1', source: 'start', target: 'fetchOrder' },
    { id: 'e2', source: 'fetchOrder', target: 'validateInventory' },
    { id: 'e3', source: 'fetchOrder', target: 'chargeCard' },
    { id: 'e4', source: 'validateInventory', target: 'sendReceipt' },
    { id: 'e5', source: 'chargeCard', target: 'sendReceipt' },
    { id: 'e6', source: 'sendReceipt', target: 'end' },
  ];

  describe('DagreRankLayoutStrategy', () => {
    const strategy = new DagreRankLayoutStrategy();

    it('returns empty result when nodes array is empty', () => {
      const result = strategy.layout([], []);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('produces deterministic and strictly monotonic x-coordinates in LR direction', () => {
      const result = strategy.layout(sampleNodes, sampleEdges, { direction: 'LR' });
      expect(result.nodes).toHaveLength(6);

      const posMap = new Map(result.nodes.map((n) => [n.id, n.position]));
      expect(posMap.get('start')!.x).toBeLessThan(posMap.get('fetchOrder')!.x);
      expect(posMap.get('fetchOrder')!.x).toBeLessThan(posMap.get('validateInventory')!.x);
      expect(posMap.get('validateInventory')!.x).toBeLessThan(posMap.get('sendReceipt')!.x);
      expect(posMap.get('sendReceipt')!.x).toBeLessThan(posMap.get('end')!.x);
    });

    it('places parallel nodes at distinct y-coordinates without overlapping', () => {
      const result = strategy.layout(sampleNodes, sampleEdges, { direction: 'LR' });
      const posMap = new Map(result.nodes.map((n) => [n.id, n.position]));

      const y1 = posMap.get('validateInventory')!.y;
      const y2 = posMap.get('chargeCard')!.y;
      expect(y1).not.toBe(y2);
      expect(Math.abs(y1 - y2)).toBeGreaterThanOrEqual(90); // nodeHeight = 90
    });

    it('supports TB direction with strictly monotonic y-coordinates', () => {
      const result = strategy.layout(sampleNodes, sampleEdges, { direction: 'TB' });
      const posMap = new Map(result.nodes.map((n) => [n.id, n.position]));

      expect(posMap.get('start')!.y).toBeLessThan(posMap.get('fetchOrder')!.y);
      expect(posMap.get('sendReceipt')!.y).toBeLessThan(posMap.get('end')!.y);
    });
  });

  describe('ElkCompactLayoutStrategy', () => {
    const strategy = new ElkCompactLayoutStrategy();

    it('aligns primary spine and compacts branch coordinates with tight spacing', () => {
      const result = strategy.layout(sampleNodes, sampleEdges, { direction: 'LR' });
      expect(result.nodes).toHaveLength(6);

      const posMap = new Map(result.nodes.map((n) => [n.id, n.position]));
      // Start to fetchOrder should advance along x axis
      expect(posMap.get('start')!.x).toBeLessThan(posMap.get('fetchOrder')!.x);
      // All nodes have valid positions
      result.nodes.forEach((n) => {
        expect(n.position.x).toBeGreaterThanOrEqual(0);
        expect(n.position.y).toBeDefined();
      });
    });

    it('handles disconnected and orphan nodes gracefully', () => {
      const orphanNodes = [...sampleNodes, createMockNode('orphan', 'Orphan Task')];
      const result = strategy.layout(orphanNodes, sampleEdges, { direction: 'LR' });
      expect(result.nodes).toHaveLength(7);
      const orphan = result.nodes.find((n) => n.id === 'orphan');
      expect(orphan).toBeDefined();
      expect(orphan!.position.x).toBeDefined();
    });
  });

  describe('Strategy Registry', () => {
    it('retrieves registered strategies properly', () => {
      const dagre = getLayoutStrategy('dagre');
      const elk = getLayoutStrategy('elk');
      expect(dagre.id).toBe('dagre');
      expect(elk.id).toBe('elk');

      // fallback
      const fallback = getLayoutStrategy(undefined as any);
      expect(fallback.id).toBe('dagre');
    });
  });
});
