import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDagStudioState } from '../hooks/use-dag-studio-state';
import { validateGraphTopology } from '../utils/workflow-ir-converter';
import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData } from './dag-node';

describe('Compound Canvas Integration & Fast-Start Workflows', () => {
  const blankStartNode: Node<DagNodeData> = {
    id: 'start-node',
    type: 'dagNode',
    position: { x: 50, y: 200 },
    data: {
      taskReferenceName: 'workflow_start',
      taskType: 'START_WORKFLOW',
      label: 'Start Workflow',
      isStartNode: true,
      isPermanent: true,
    },
  };

  const blankEndNode: Node<DagNodeData> = {
    id: 'end-node',
    type: 'dagNode',
    position: { x: 800, y: 200 },
    data: {
      taskReferenceName: 'workflow_end',
      taskType: 'END_WORKFLOW',
      label: 'End Workflow',
      isEndNode: true,
      isPermanent: true,
    },
  };

  const directBlankEdge: Edge = {
    id: 'e_start_to_end',
    source: 'start-node',
    target: 'end-node',
    sourceHandle: 'source',
    targetHandle: 'target',
  };

  it('splits blank direct edge with FORK_JOIN and yields 0 validation errors', () => {
    const { result } = renderHook(() =>
      useDagStudioState({
        initialNodes: [blankStartNode, blankEndNode],
        initialEdges: [directBlankEdge],
        screenToFlowPosition: (pos) => pos,
      })
    );

    act(() => {
      result.current.handleSplitEdge('e_start_to_end', 'FORK_JOIN');
    });

    const currentNodes = result.current.nodes;
    const currentEdges = result.current.edges;

    // 2 boundary nodes + 4 fork/join template nodes = 6 nodes
    expect(currentNodes).toHaveLength(6);
    // Inbound edge + 4 template edges + Outbound edge = 6 edges
    expect(currentEdges).toHaveLength(6);

    const forkNode = currentNodes.find((n) => n.data.taskType === 'FORK_JOIN');
    const joinNode = currentNodes.find((n) => n.data.taskType === 'JOIN');
    expect(forkNode).toBeDefined();
    expect(joinNode).toBeDefined();

    // Inbound edge connects start-node to forkNode with exact handle IDs
    const inbound = currentEdges.find((e) => e.source === 'start-node');
    expect(inbound?.target).toBe(forkNode!.id);
    expect(inbound?.sourceHandle).toBe('source-right');
    expect(inbound?.targetHandle).toBe('target-left');

    // Outbound edge connects joinNode to end-node with exact handle IDs
    const outbound = currentEdges.find((e) => e.target === 'end-node');
    expect(outbound?.source).toBe(joinNode!.id);
    expect(outbound?.sourceHandle).toBe('source-right');
    expect(outbound?.targetHandle).toBe('target-left');

    // Full graph topology validation
    const errors = validateGraphTopology(currentNodes, currentEdges);
    expect(errors).toHaveLength(0);
  });

  it('splits blank direct edge with SWITCH and yields 0 validation errors', () => {
    const { result } = renderHook(() =>
      useDagStudioState({
        initialNodes: [blankStartNode, blankEndNode],
        initialEdges: [directBlankEdge],
        screenToFlowPosition: (pos) => pos,
      })
    );

    act(() => {
      result.current.handleSplitEdge('e_start_to_end', 'SWITCH');
    });

    const currentNodes = result.current.nodes;
    const currentEdges = result.current.edges;

    // 2 boundary nodes + 5 switch template nodes = 7 nodes
    expect(currentNodes).toHaveLength(7);
    // Inbound + 6 template edges + Outbound = 8 edges
    expect(currentEdges).toHaveLength(8);

    const switchNode = currentNodes.find((n) => n.data.taskType === 'SWITCH');
    const ejNode = currentNodes.find((n) => n.data.taskType === 'EXCLUSIVE_JOIN');
    expect(switchNode).toBeDefined();
    expect(ejNode).toBeDefined();

    const inbound = currentEdges.find((e) => e.source === 'start-node');
    expect(inbound?.target).toBe(switchNode!.id);
    expect(inbound?.sourceHandle).toBe('source-right');
    expect(inbound?.targetHandle).toBe('target-left');

    const outbound = currentEdges.find((e) => e.target === 'end-node');
    expect(outbound?.source).toBe(ejNode!.id);
    expect(outbound?.sourceHandle).toBe('source-right');
    expect(outbound?.targetHandle).toBe('target-left');

    const errors = validateGraphTopology(currentNodes, currentEdges);
    expect(errors).toHaveLength(0);
  });

  it('splits blank direct edge with DO_WHILE and wires loop-exit to target', () => {
    const { result } = renderHook(() =>
      useDagStudioState({
        initialNodes: [blankStartNode, blankEndNode],
        initialEdges: [directBlankEdge],
        screenToFlowPosition: (pos) => pos,
      })
    );

    act(() => {
      result.current.handleSplitEdge('e_start_to_end', 'DO_WHILE');
    });

    const currentNodes = result.current.nodes;
    const currentEdges = result.current.edges;

    // 2 boundary nodes + 2 loop template nodes = 4 nodes
    expect(currentNodes).toHaveLength(4);
    // Inbound + 2 loop edges + Outbound = 4 edges
    expect(currentEdges).toHaveLength(4);

    const loopNode = currentNodes.find((n) => n.data.taskType === 'DO_WHILE');
    expect(loopNode).toBeDefined();

    const outbound = currentEdges.find((e) => e.target === 'end-node');
    expect(outbound?.source).toBe(loopNode!.id);
    expect(outbound?.sourceHandle).toBe('loop-exit');

    const errors = validateGraphTopology(currentNodes, currentEdges);
    expect(errors).toHaveLength(0);
  });

  it('pushes downstream nodes when inserting a wide compound template in tight clearance', () => {
    // Set end-node close to start-node: distance 200px
    const closeEndNode: Node<DagNodeData> = {
      ...blankEndNode,
      position: { x: 250, y: 200 },
    };
    const closeEdge: Edge = {
      id: 'e_close',
      source: 'start-node',
      target: 'end-node',
    };

    const { result } = renderHook(() =>
      useDagStudioState({
        initialNodes: [blankStartNode, closeEndNode],
        initialEdges: [closeEdge],
        screenToFlowPosition: (pos) => pos,
      })
    );

    act(() => {
      result.current.handleSplitEdge('e_close', 'FORK_JOIN');
    });

    const endNodeAfter = result.current.nodes.find((n) => n.id === 'end-node');
    expect(endNodeAfter).toBeDefined();
    // End node was at x = 250, it should be shifted to the right to accommodate 480px + clearance
    expect(endNodeAfter!.position.x).toBeGreaterThan(600);
  });

  it('adds full compound node structure on canvas drop', () => {
    const { result } = renderHook(() =>
      useDagStudioState({
        initialNodes: [blankStartNode, blankEndNode],
        initialEdges: [directBlankEdge],
        screenToFlowPosition: (pos) => pos,
      })
    );

    const mockDropEvent = {
      preventDefault: () => {},
      clientX: 400,
      clientY: 300,
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/dag-node-type') return 'FORK_JOIN';
          if (key === 'application/dag-node-data') return JSON.stringify({ label: 'Parallel Fork' });
          return '';
        },
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.onDrop(mockDropEvent);
    });

    // Initial 2 nodes + 4 dropped nodes = 6 nodes
    expect(result.current.nodes).toHaveLength(6);
    // Inbound edge + 4 template edges + Outbound edge = 6 edges (fully connected on both sides!)
    expect(result.current.edges).toHaveLength(6);

    const forkNode = result.current.nodes.find((n) => n.data.taskType === 'FORK_JOIN');
    const joinNode = result.current.nodes.find((n) => n.data.taskType === 'JOIN');
    expect(forkNode).toBeDefined();
    expect(joinNode).toBeDefined();

    // Verify connections to both sides with correct handles
    const inbound = result.current.edges.find((e) => e.source === 'start-node');
    expect(inbound?.target).toBe(forkNode!.id);
    expect(inbound?.sourceHandle).toBe('source-right');
    expect(inbound?.targetHandle).toBe('target-left');

    const outbound = result.current.edges.find((e) => e.target === 'end-node');
    expect(outbound?.source).toBe(joinNode!.id);
    expect(outbound?.sourceHandle).toBe('source-right');
    expect(outbound?.targetHandle).toBe('target-left');

    // Complete graph topology passes validation without orphans
    const errors = validateGraphTopology(result.current.nodes, result.current.edges);
    expect(errors).toHaveLength(0);
  });

  it('inserts node via handleInsertNode into active flow and connects to both sides', () => {
    const { result } = renderHook(() =>
      useDagStudioState({
        initialNodes: [blankStartNode, blankEndNode],
        initialEdges: [directBlankEdge],
        screenToFlowPosition: (pos) => pos,
      })
    );

    // 1-click insert from palette without explicit selection targets direct flow edge
    act(() => {
      result.current.handleInsertNode('HTTP', { label: 'Fetch Order API' });
    });

    // 2 boundaries + 1 HTTP task = 3 nodes
    expect(result.current.nodes).toHaveLength(3);
    // Inbound + Outbound = 2 edges
    expect(result.current.edges).toHaveLength(2);

    const httpNode = result.current.nodes.find((n) => n.data.taskType === 'HTTP');
    expect(httpNode).toBeDefined();

    const inEdge = result.current.edges.find((e) => e.source === 'start-node');
    expect(inEdge?.target).toBe(httpNode!.id);
    expect(inEdge?.sourceHandle).toBe('source-right');
    expect(inEdge?.targetHandle).toBe('target-left');

    const outEdge = result.current.edges.find((e) => e.target === 'end-node');
    expect(outEdge?.source).toBe(httpNode!.id);
    expect(outEdge?.sourceHandle).toBe('source-right');
    expect(outEdge?.targetHandle).toBe('target-left');

    const errors = validateGraphTopology(result.current.nodes, result.current.edges);
    expect(errors).toHaveLength(0);
  });

  it('splits edge when dropping a simple node in between with correct handle IDs', () => {
    const { result } = renderHook(() =>
      useDagStudioState({
        initialNodes: [blankStartNode, blankEndNode],
        initialEdges: [directBlankEdge],
        screenToFlowPosition: (pos) => pos,
      })
    );

    act(() => {
      result.current.handleSplitEdge('e_start_to_end', 'SIMPLE', { label: 'Process Payment' });
    });

    expect(result.current.nodes).toHaveLength(3);
    expect(result.current.edges).toHaveLength(2);

    const simpleNode = result.current.nodes.find((n) => n.data.taskType === 'SIMPLE');
    expect(simpleNode).toBeDefined();

    const inEdge = result.current.edges.find((e) => e.source === 'start-node');
    expect(inEdge?.target).toBe(simpleNode!.id);
    expect(inEdge?.sourceHandle).toBe('source-right');
    expect(inEdge?.targetHandle).toBe('target-left');

    const outEdge = result.current.edges.find((e) => e.target === 'end-node');
    expect(outEdge?.source).toBe(simpleNode!.id);
    expect(outEdge?.sourceHandle).toBe('source-right');
    expect(outEdge?.targetHandle).toBe('target-left');

    const errors = validateGraphTopology(result.current.nodes, result.current.edges);
    expect(errors).toHaveLength(0);
  });
});
