import { describe, it, expect } from 'vitest';
import { compoundTemplateRegistry } from './compound-template-registry';
import { validateGraphTopology } from '../workflow-ir-converter';
import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData } from '../../canvas/dag-node';

describe('Compound Node Templates & Fast-Start Engine', () => {
  it('correctly identifies compound node types in the registry', () => {
    expect(compoundTemplateRegistry.isCompound('FORK_JOIN')).toBe(true);
    expect(compoundTemplateRegistry.isCompound('DYNAMIC_FORK')).toBe(true);
    expect(compoundTemplateRegistry.isCompound('SWITCH')).toBe(true);
    expect(compoundTemplateRegistry.isCompound('DO_WHILE')).toBe(true);
    expect(compoundTemplateRegistry.isCompound('HUMAN')).toBe(true);
    expect(compoundTemplateRegistry.isCompound('SIMPLE')).toBe(false);
    expect(compoundTemplateRegistry.isCompound('HTTP')).toBe(false);
  });

  describe('Topology 1: FORK_JOIN + Parallel Branches + JOIN Barrier', () => {
    it('generates 4 interconnected nodes and 4 edges with Conductor-compliant joinOn', () => {
      const result = compoundTemplateRegistry.create('FORK_JOIN', { x: 200, y: 150 });
      expect(result).not.toBeNull();
      if (!result) return;

      const { nodes, edges, primaryNodeId, exitNodeId, exitHandle } = result;
      expect(nodes).toHaveLength(4);
      expect(edges).toHaveLength(4);

      const forkNode = nodes.find((n) => n.data.taskType === 'FORK_JOIN');
      const branchNodes = nodes.filter((n) => n.data.taskType === 'SIMPLE');
      const joinNode = nodes.find((n) => n.data.taskType === 'JOIN');

      expect(forkNode).toBeDefined();
      expect(branchNodes).toHaveLength(2);
      expect(joinNode).toBeDefined();

      expect(primaryNodeId).toBe(forkNode!.id);
      expect(exitNodeId).toBe(joinNode!.id);
      expect(exitHandle).toBe('source');

      const branchRefs = branchNodes.map((n) => n.data.taskReferenceName);
      expect(joinNode!.data.joinOn).toEqual(expect.arrayContaining(branchRefs));
      expect(forkNode!.data.forkTasks).toEqual([[branchRefs[0]], [branchRefs[1]]]);

      // Check wiring
      const forkEdges = edges.filter((e) => e.source === forkNode!.id);
      expect(forkEdges).toHaveLength(2);
      const joinEdges = edges.filter((e) => e.target === joinNode!.id);
      expect(joinEdges).toHaveLength(2);
    });

    it('validates without errors when enclosed in START_WORKFLOW and END_WORKFLOW', () => {
      const template = compoundTemplateRegistry.create('FORK_JOIN', { x: 200, y: 150 })!;
      const startNode: Node<DagNodeData> = {
        id: 'start',
        type: 'dagNode',
        position: { x: 0, y: 150 },
        data: { taskReferenceName: 'start', taskType: 'START_WORKFLOW', isStartNode: true },
      };
      const endNode: Node<DagNodeData> = {
        id: 'end',
        type: 'dagNode',
        position: { x: 800, y: 150 },
        data: { taskReferenceName: 'end', taskType: 'END_WORKFLOW', isEndNode: true },
      };

      const inEdge: Edge = {
        id: 'e_start_to_fork',
        source: startNode.id,
        target: template.primaryNodeId,
      };
      const outEdge: Edge = {
        id: 'e_join_to_end',
        source: template.exitNodeId,
        target: endNode.id,
      };

      const allNodes = [startNode, ...template.nodes, endNode];
      const allEdges = [inEdge, ...template.edges, outEdge];

      const errors = validateGraphTopology(allNodes, allEdges);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Topology 2: DYNAMIC_FORK + Dynamic JOIN Barrier', () => {
    it('generates paired DYNAMIC_FORK and JOIN barrier with joinOn', () => {
      const result = compoundTemplateRegistry.create('DYNAMIC_FORK', { x: 100, y: 100 }, {
        customData: { taskType: 'DYNAMIC_FORK' },
      });
      expect(result).not.toBeNull();
      if (!result) return;

      const { nodes, edges, primaryNodeId, exitNodeId } = result;
      expect(nodes).toHaveLength(2);
      expect(edges).toHaveLength(1);

      const dynNode = nodes.find((n) => n.data.taskType === 'DYNAMIC_FORK');
      const joinNode = nodes.find((n) => n.data.taskType === 'JOIN');

      expect(dynNode).toBeDefined();
      expect(joinNode).toBeDefined();
      expect(joinNode!.data.joinOn).toEqual([dynNode!.data.taskReferenceName]);
      expect(primaryNodeId).toBe(dynNode!.id);
      expect(exitNodeId).toBe(joinNode!.id);
    });
  });

  describe('Topology 3: SWITCH + Case Branches + EXCLUSIVE_JOIN', () => {
    it('generates 5 nodes and 6 edges converging into EXCLUSIVE_JOIN', () => {
      const result = compoundTemplateRegistry.create('SWITCH', { x: 200, y: 200 });
      expect(result).not.toBeNull();
      if (!result) return;

      const { nodes, edges, primaryNodeId, exitNodeId } = result;
      expect(nodes).toHaveLength(5);
      expect(edges).toHaveLength(6);

      const switchNode = nodes.find((n) => n.data.taskType === 'SWITCH');
      const actionNodes = nodes.filter((n) => n.data.taskType === 'SIMPLE');
      const exclusiveJoinNode = nodes.find((n) => n.data.taskType === 'EXCLUSIVE_JOIN');

      expect(switchNode).toBeDefined();
      expect(actionNodes).toHaveLength(3);
      expect(exclusiveJoinNode).toBeDefined();

      expect(primaryNodeId).toBe(switchNode!.id);
      expect(exitNodeId).toBe(exclusiveJoinNode!.id);

      const actionRefs = actionNodes.map((n) => n.data.taskReferenceName);
      expect(exclusiveJoinNode!.data.joinOn).toEqual(expect.arrayContaining(actionRefs));

      // Check handle mappings
      const case1Edge = edges.find((e) => e.sourceHandle === 'case-case_1');
      const case2Edge = edges.find((e) => e.sourceHandle === 'case-case_2');
      const defaultEdge = edges.find((e) => e.sourceHandle === 'case-default');

      expect(case1Edge).toBeDefined();
      expect(case2Edge).toBeDefined();
      expect(defaultEdge).toBeDefined();

      // Check convergence into exclusiveJoin
      const mergeEdges = edges.filter((e) => e.target === exclusiveJoinNode!.id);
      expect(mergeEdges).toHaveLength(3);
    });
  });

  describe('Topology 4: DO_WHILE + Loop Body + Back-Edge', () => {
    it('generates 2 nodes and 2 edges with isLoopbackEdge and exitHandle', () => {
      const result = compoundTemplateRegistry.create('DO_WHILE', { x: 150, y: 150 });
      expect(result).not.toBeNull();
      if (!result) return;

      const { nodes, edges, primaryNodeId, exitNodeId, exitHandle } = result;
      expect(nodes).toHaveLength(2);
      expect(edges).toHaveLength(2);

      const loopNode = nodes.find((n) => n.data.taskType === 'DO_WHILE');
      const bodyNode = nodes.find((n) => n.data.taskType === 'SIMPLE');

      expect(loopNode).toBeDefined();
      expect(bodyNode).toBeDefined();

      expect(primaryNodeId).toBe(loopNode!.id);
      expect(exitNodeId).toBe(loopNode!.id);
      expect(exitHandle).toBe('loop-exit');

      const bodyEdge = edges.find((e) => e.sourceHandle === 'loop-body');
      const backEdge = edges.find((e) => e.targetHandle === 'loop-back');

      expect(bodyEdge).toBeDefined();
      expect(bodyEdge!.target).toBe(bodyNode!.id);

      expect(backEdge).toBeDefined();
      expect(backEdge!.source).toBe(bodyNode!.id);
      expect((backEdge!.data as any)?.isLoopbackEdge).toBe(true);
    });
  });

  describe('Topology 5: HUMAN + Approved + Rejected Path', () => {
    it('generates 3 nodes and 2 decision edges', () => {
      const result = compoundTemplateRegistry.create('HUMAN', { x: 100, y: 100 });
      expect(result).not.toBeNull();
      if (!result) return;

      const { nodes, edges, primaryNodeId, exitNodeId } = result;
      expect(nodes).toHaveLength(3);
      expect(edges).toHaveLength(2);

      const humanNode = nodes.find((n) => n.data.taskType === 'HUMAN');
      const approveNode = nodes.find((n) => n.data.taskReferenceName.startsWith('approve_action_'));
      const rejectNode = nodes.find((n) => n.data.taskReferenceName.startsWith('reject_term_'));

      expect(humanNode).toBeDefined();
      expect(approveNode).toBeDefined();
      expect(rejectNode).toBeDefined();
      expect(rejectNode!.data.taskType).toBe('TERMINATE');

      expect(primaryNodeId).toBe(humanNode!.id);
      expect(exitNodeId).toBe(approveNode!.id);

      const approvedEdge = edges.find((e) => e.sourceHandle === 'approved');
      const rejectedEdge = edges.find((e) => e.sourceHandle === 'rejected');

      expect(approvedEdge?.target).toBe(approveNode!.id);
      expect(rejectedEdge?.target).toBe(rejectNode!.id);
    });
  });
});
