import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDagStudioState } from '../hooks/use-dag-studio-state';
import { validateGraphTopology } from '../utils/workflow-ir-converter';
import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData } from './dag-node';
import '../utils/branch-strategies'; // register strategies

describe('Multi-Branch Node Expansion Canvas Integration', () => {
  describe('SWITCH Multi-Branch Dynamic Expansion', () => {
    const startNode: Node<DagNodeData> = {
      id: 'node-start',
      type: 'dagNode',
      position: { x: 50, y: 200 },
      data: { taskReferenceName: 'start', taskType: 'START_WORKFLOW', isStartNode: true },
    };
    const switchNode: Node<DagNodeData> = {
      id: 'node-switch',
      type: 'dagNode',
      position: { x: 250, y: 200 },
      data: {
        taskReferenceName: 'switch_router',
        taskType: 'SWITCH',
        decisionCases: {
          case_1: ['action_1'],
          case_2: ['action_2'],
        },
        defaultCase: ['action_default'],
      },
    };
    const c1Node: Node<DagNodeData> = {
      id: 'node-c1',
      type: 'dagNode',
      position: { x: 510, y: 100 },
      data: { taskReferenceName: 'action_1', taskType: 'SIMPLE' },
    };
    const c2Node: Node<DagNodeData> = {
      id: 'node-c2',
      type: 'dagNode',
      position: { x: 510, y: 200 },
      data: { taskReferenceName: 'action_2', taskType: 'SIMPLE' },
    };
    const cdNode: Node<DagNodeData> = {
      id: 'node-cd',
      type: 'dagNode',
      position: { x: 510, y: 300 },
      data: { taskReferenceName: 'action_default', taskType: 'SIMPLE' },
    };
    const ejNode: Node<DagNodeData> = {
      id: 'node-ej',
      type: 'dagNode',
      position: { x: 770, y: 200 },
      data: {
        taskReferenceName: 'switch_merge',
        taskType: 'EXCLUSIVE_JOIN',
        joinOn: ['action_1', 'action_2', 'action_default'],
      },
    };
    const endNode: Node<DagNodeData> = {
      id: 'node-end',
      type: 'dagNode',
      position: { x: 1050, y: 200 },
      data: { taskReferenceName: 'end', taskType: 'END_WORKFLOW', isEndNode: true },
    };

    const initialEdges: Edge[] = [
      { id: 'e_start_switch', source: 'node-start', target: 'node-switch', sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e_sw_c1', source: 'node-switch', target: 'node-c1', sourceHandle: 'case-case_1', targetHandle: 'target-left' },
      { id: 'e_sw_c2', source: 'node-switch', target: 'node-c2', sourceHandle: 'case-case_2', targetHandle: 'target-left' },
      { id: 'e_sw_cd', source: 'node-switch', target: 'node-cd', sourceHandle: 'case-default', targetHandle: 'target-left' },
      { id: 'e_c1_ej', source: 'node-c1', target: 'node-ej', sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e_c2_ej', source: 'node-c2', target: 'node-ej', sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e_cd_ej', source: 'node-cd', target: 'node-ej', sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e_ej_end', source: 'node-ej', target: 'node-end', sourceHandle: 'source-right', targetHandle: 'target-left' },
    ];

    it('adds 3rd decision case on SWITCH, connects to EXCLUSIVE_JOIN, and validates with 0 errors', () => {
      const { result } = renderHook(() =>
        useDagStudioState({
          initialNodes: [startNode, switchNode, c1Node, c2Node, cdNode, ejNode, endNode],
          initialEdges,
          screenToFlowPosition: (pos) => pos,
        })
      );

      // Verify baseline validates
      expect(validateGraphTopology(result.current.nodes, result.current.edges)).toHaveLength(0);

      // 1-Click Add Branch Case
      act(() => {
        result.current.handleAddNodeBranch('node-switch');
      });

      const currentNodes = result.current.nodes;
      const currentEdges = result.current.edges;

      // Initial 7 nodes + 1 new branch node = 8 nodes
      expect(currentNodes).toHaveLength(8);
      // Initial 8 edges + 2 new edges (switch -> new, new -> ej) = 10 edges
      expect(currentEdges).toHaveLength(10);

      const updatedSwitch = currentNodes.find((n) => n.id === 'node-switch');
      expect(updatedSwitch).toBeDefined();
      expect(Object.keys(updatedSwitch!.data.decisionCases || {})).toContain('case_3');

      const case3Ref = updatedSwitch!.data.decisionCases!['case_3'][0];
      const newActionNode = currentNodes.find((n) => n.data.taskReferenceName === case3Ref);
      expect(newActionNode).toBeDefined();

      const updatedEj = currentNodes.find((n) => n.id === 'node-ej');
      expect(updatedEj!.data.joinOn).toContain(case3Ref);

      // Verify inbound edge with dynamic case handle ID
      const inEdge = currentEdges.find((e) => e.target === newActionNode!.id);
      expect(inEdge).toBeDefined();
      expect(inEdge?.source).toBe('node-switch');
      expect(inEdge?.sourceHandle).toBe('case-case_3');
      expect(inEdge?.targetHandle).toBe('target-left');

      // Verify outbound edge converging to EXCLUSIVE_JOIN
      const outEdge = currentEdges.find((e) => e.source === newActionNode!.id);
      expect(outEdge).toBeDefined();
      expect(outEdge?.target).toBe('node-ej');
      expect(outEdge?.sourceHandle).toBe('source-right');
      expect(outEdge?.targetHandle).toBe('target-left');

      // Full graph validation
      const errors = validateGraphTopology(currentNodes, currentEdges);
      expect(errors).toHaveLength(0);
    });

    it('removes decision case from SWITCH, prunes branch node and edges, and updates EXCLUSIVE_JOIN', () => {
      const { result } = renderHook(() =>
        useDagStudioState({
          initialNodes: [startNode, switchNode, c1Node, c2Node, cdNode, ejNode, endNode],
          initialEdges,
          screenToFlowPosition: (pos) => pos,
        })
      );

      // Add case_3 first
      act(() => {
        result.current.handleAddNodeBranch('node-switch');
      });
      expect(result.current.nodes).toHaveLength(8);

      // Now remove case_3
      act(() => {
        result.current.handleRemoveNodeBranch('node-switch', 'case_3');
      });

      expect(result.current.nodes).toHaveLength(7);
      expect(result.current.edges).toHaveLength(8);

      const switchAfter = result.current.nodes.find((n) => n.id === 'node-switch');
      expect(switchAfter!.data.decisionCases?.['case_3']).toBeUndefined();

      const ejAfter = result.current.nodes.find((n) => n.id === 'node-ej');
      expect(ejAfter!.data.joinOn).not.toContain(expect.stringMatching(/^case_3/));

      const errors = validateGraphTopology(result.current.nodes, result.current.edges);
      expect(errors).toHaveLength(0);
    });
  });

  describe('FORK_JOIN Multi-Branch Dynamic Expansion', () => {
    const startNode: Node<DagNodeData> = {
      id: 'node-start',
      type: 'dagNode',
      position: { x: 50, y: 200 },
      data: { taskReferenceName: 'start', taskType: 'START_WORKFLOW', isStartNode: true },
    };
    const forkNode: Node<DagNodeData> = {
      id: 'node-fork',
      type: 'dagNode',
      position: { x: 250, y: 200 },
      data: {
        taskReferenceName: 'parallel_fork',
        taskType: 'FORK_JOIN',
        forkTasks: [['branch_1_task'], ['branch_2_task']],
      },
    };
    const b1Node: Node<DagNodeData> = {
      id: 'node-b1',
      type: 'dagNode',
      position: { x: 510, y: 150 },
      data: { taskReferenceName: 'branch_1_task', taskType: 'SIMPLE' },
    };
    const b2Node: Node<DagNodeData> = {
      id: 'node-b2',
      type: 'dagNode',
      position: { x: 510, y: 250 },
      data: { taskReferenceName: 'branch_2_task', taskType: 'SIMPLE' },
    };
    const joinNode: Node<DagNodeData> = {
      id: 'node-join',
      type: 'dagNode',
      position: { x: 770, y: 200 },
      data: {
        taskReferenceName: 'parallel_join',
        taskType: 'JOIN',
        joinOn: ['branch_1_task', 'branch_2_task'],
      },
    };
    const endNode: Node<DagNodeData> = {
      id: 'node-end',
      type: 'dagNode',
      position: { x: 1050, y: 200 },
      data: { taskReferenceName: 'end', taskType: 'END_WORKFLOW', isEndNode: true },
    };

    const forkEdges: Edge[] = [
      { id: 'e_st_fk', source: 'node-start', target: 'node-fork', sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e_fk_b1', source: 'node-fork', target: 'node-b1', sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e_fk_b2', source: 'node-fork', target: 'node-b2', sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e_b1_jn', source: 'node-b1', target: 'node-join', sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e_b2_jn', source: 'node-b2', target: 'node-join', sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e_jn_end', source: 'node-join', target: 'node-end', sourceHandle: 'source-right', targetHandle: 'target-left' },
    ];

    it('adds 3rd parallel branch to FORK_JOIN, updates JOIN barrier joinOn, and validates 0 errors', () => {
      const { result } = renderHook(() =>
        useDagStudioState({
          initialNodes: [startNode, forkNode, b1Node, b2Node, joinNode, endNode],
          initialEdges: forkEdges,
          screenToFlowPosition: (pos) => pos,
        })
      );

      expect(validateGraphTopology(result.current.nodes, result.current.edges)).toHaveLength(0);

      // Add 3rd branch
      act(() => {
        result.current.handleAddNodeBranch('node-fork');
      });

      const currentNodes = result.current.nodes;
      const currentEdges = result.current.edges;

      // 6 original + 1 new = 7 nodes
      expect(currentNodes).toHaveLength(7);
      // 6 original + 2 edges = 8 edges
      expect(currentEdges).toHaveLength(8);

      const updatedFork = currentNodes.find((n) => n.id === 'node-fork');
      expect(updatedFork!.data.forkTasks).toHaveLength(3);

      const b3Ref = updatedFork!.data.forkTasks![2][0];
      const b3Node = currentNodes.find((n) => n.data.taskReferenceName === b3Ref);
      expect(b3Node).toBeDefined();

      const updatedJoin = currentNodes.find((n) => n.id === 'node-join');
      expect(updatedJoin!.data.joinOn).toContain(b3Ref);

      const errors = validateGraphTopology(currentNodes, currentEdges);
      expect(errors).toHaveLength(0);
    });

    it('supports undo and redo for branch additions', () => {
      const { result } = renderHook(() =>
        useDagStudioState({
          initialNodes: [startNode, forkNode, b1Node, b2Node, joinNode, endNode],
          initialEdges: forkEdges,
          screenToFlowPosition: (pos) => pos,
        })
      );

      act(() => {
        result.current.handleAddNodeBranch('node-fork');
      });
      expect(result.current.nodes).toHaveLength(7);

      // Undo
      act(() => {
        result.current.handleUndo();
      });
      expect(result.current.nodes).toHaveLength(6);

      // Redo
      act(() => {
        result.current.handleRedo();
      });
      expect(result.current.nodes).toHaveLength(7);
    });
  });
});
