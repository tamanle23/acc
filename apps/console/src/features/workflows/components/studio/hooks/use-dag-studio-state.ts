import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import type { DagNodeData, DagNodeType } from '../canvas/dag-node';
import type { DagConditionEdgeData } from '../canvas/dag-condition-edge';
import {
  INITIAL_NODES,
  INITIAL_EDGES,
  BLANK_WORKFLOW_NODES,
  BLANK_WORKFLOW_EDGES,
} from '../utils/dag-sample-data';
import {
  validateGraphTopology,
  exportToWorkflowIR,
  importFromWorkflowIR,
  type WorkflowIR,
  type GraphValidationError,
} from '../utils/workflow-ir-converter';
import { getLayoutStrategy, type LayoutAlgorithm } from '../utils/layout';
import { compoundTemplateRegistry } from '../utils/compound-templates';

export interface UseDagStudioStateOptions {
  isReadOnly?: boolean;
  initialNodes?: Node<DagNodeData>[];
  initialEdges?: Edge[];
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
}

/**
 * Resolves the appropriate source handle ID for an edge originating from sourceNode.
 * Prevents invalid/undefined handle IDs from breaking ReactFlow connections.
 */
export function resolveSourceHandle(
  sourceNode?: Node<DagNodeData>,
  existingHandle?: string | null
): string {
  if (existingHandle && existingHandle !== 'source' && existingHandle !== 'default') {
    return existingHandle;
  }
  if (!sourceNode) return 'source-right';

  const taskType = sourceNode.data?.taskType;
  if (taskType === 'DO_WHILE') {
    return 'loop-exit';
  }
  if (taskType === 'HUMAN') {
    return 'approved';
  }
  if (taskType === 'SWITCH') {
    const cases = Object.keys(sourceNode.data?.decisionCases || {});
    return cases.length > 0 ? `case-${cases[0]}` : 'case-default';
  }
  return 'source-right';
}

/**
 * Resolves the appropriate target handle ID for an edge targeting targetNode.
 */
export function resolveTargetHandle(
  targetNode?: Node<DagNodeData>,
  existingHandle?: string | null
): string {
  if (existingHandle && existingHandle !== 'target' && existingHandle !== 'default') {
    return existingHandle;
  }
  if (targetNode?.data?.taskType === 'DO_WHILE' && existingHandle === 'loop-back') {
    return 'loop-back';
  }
  return 'target-left';
}

/**
 * Finds the nearest edge to the given drop position using point-to-line-segment distance math.
 * Returns null if the closest edge is farther than maxDistance (default 140px).
 */
export function findNearestEdge(
  pos: { x: number; y: number },
  nodes: Node<DagNodeData>[],
  edges: Edge[],
  maxDistance = 140
): Edge | null {
  const nodeMap = new Map<string, Node<DagNodeData>>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  let closestEdge: Edge | null = null;
  let minDistance = Infinity;

  for (const edge of edges) {
    if (edge.targetHandle === 'loop-back') continue;

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const ax = sourceNode.position.x + 220;
    const ay = sourceNode.position.y + 35;
    const bx = targetNode.position.x;
    const by = targetNode.position.y + 35;

    const vx = bx - ax;
    const vy = by - ay;
    const lenSq = vx * vx + vy * vy;

    let dist: number;
    if (lenSq === 0) {
      dist = Math.hypot(pos.x - ax, pos.y - ay);
    } else {
      const t = Math.max(0, Math.min(1, ((pos.x - ax) * vx + (pos.y - ay) * vy) / lenSq));
      const projX = ax + t * vx;
      const projY = ay + t * vy;
      dist = Math.hypot(pos.x - projX, pos.y - projY);
    }

    if (dist < minDistance && dist <= maxDistance) {
      minDistance = dist;
      closestEdge = edge;
    }
  }

  return closestEdge;
}

export function useDagStudioState({
  isReadOnly,
  initialNodes,
  initialEdges,
  screenToFlowPosition,
}: UseDagStudioStateOptions) {
  const [nodes, setNodes] = useState<Node<DagNodeData>[]>(initialNodes || INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(initialEdges || INITIAL_EDGES);

  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<Array<{ nodes: Node<DagNodeData>[]; edges: Edge[] }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ nodes: Node<DagNodeData>[]; edges: Edge[] }>>([]);

  // Selection & Inspector states
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Edge Quick Insert & Condition states
  const [edgeSplitTarget, setEdgeSplitTarget] = useState<{
    edgeId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Validation States
  const [validationErrors, setValidationErrors] = useState<GraphValidationError[]>([]);
  const [validationBannerVisible, setValidationBannerVisible] = useState(false);

  // Canvas ergonomics
  const [edgeRoutingMode, setEdgeRoutingMode] = useState<'bezier' | 'smoothstep'>('bezier');
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<LayoutAlgorithm>('dagre');
  const [isSnapToGrid, setIsSnapToGrid] = useState<boolean>(true);
  const [isDismissedEmptyState, setIsDismissedEmptyState] = useState(false);

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-24), { nodes, edges }]);
    setRedoStack([]);
  }, [nodes, edges]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, { nodes, edges }]);
    setUndoStack((u) => u.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [undoStack, nodes, edges]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, { nodes, edges }]);
    setRedoStack((r) => r.slice(0, -1));
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [redoStack, nodes, edges]);

  const onNodesChange: OnNodesChange<Node<DagNodeData>> = useCallback(
    (changes) => {
      if (isReadOnly) return;
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [isReadOnly]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (isReadOnly) return;
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [isReadOnly]
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return false;
      const targetNode = nodes.find((n) => n.id === connection.target);
      const sourceNode = nodes.find((n) => n.id === connection.source);
      if (!targetNode || !sourceNode) return false;

      // 1. Boundary Guards:
      // START node cannot have incoming edges (in-degree is strictly 0)
      if (targetNode.data?.isStartNode || targetNode.data?.taskType === 'START_WORKFLOW') return false;
      // END and TERMINATE nodes cannot have outgoing edges (out-degree is strictly 0)
      if (
        sourceNode.data?.isEndNode ||
        sourceNode.data?.taskType === 'END_WORKFLOW' ||
        sourceNode.data?.taskType === 'TERMINATE'
      ) {
        return false;
      }

      // 2. Loopback Target Gate on DO_WHILE:
      if (connection.targetHandle === 'loop-back') {
        if (targetNode.data?.taskType !== 'DO_WHILE') return false;

        // Check if sourceNode is reachable starting from targetNode (loop body descendant)
        const visited = new Set<string>();
        const q = [connection.target];
        visited.add(connection.target);
        let isDescendant = false;

        while (q.length > 0) {
          const curr = q.shift()!;
          for (const e of edges) {
            if (e.source === curr && e.targetHandle !== 'loop-back') {
              if (e.target === connection.source) {
                isDescendant = true;
                break;
              }
              if (!visited.has(e.target)) {
                visited.add(e.target);
                q.push(e.target);
              }
            }
          }
          if (isDescendant) break;
        }

        if (!isDescendant) return false;

        // Single inbound edge check on loop-back handle
        const hasExistingLoopback = edges.some(
          (e) => e.target === connection.target && e.targetHandle === 'loop-back'
        );
        if (hasExistingLoopback) return false;
      }

      return true;
    },
    [nodes, edges]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (isReadOnly) return;
      if (!isValidConnection(params)) return;
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'dagEdge',
            animated: true,
            data: params.targetHandle === 'loop-back' ? { isLoopbackEdge: true } : {},
          },
          eds
        )
      );
    },
    [isReadOnly, isValidConnection]
  );

  const handleUpdateNodeData = useCallback(
    (nodeId: string, updatedData: Partial<DagNodeData>) => {
      if (isReadOnly) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                ...updatedData,
              },
            };
          }
          return n;
        })
      );
    },
    [isReadOnly]
  );

  const handleSplitEdge = useCallback(
    (
      edgeId: string,
      newNodeType: DagNodeType = 'SIMPLE',
      customData?: Partial<DagNodeData>,
      overridePosition?: { x: number; y: number }
    ) => {
      if (isReadOnly) return;
      const targetEdge = edges.find((e) => e.id === edgeId);
      if (!targetEdge) return;

      pushUndoSnapshot();

      const sourceNode = nodes.find((n) => n.id === targetEdge.source);
      const targetNode = nodes.find((n) => n.id === targetEdge.target);

      const sourcePos = sourceNode?.position || { x: 100, y: 200 };
      const targetPos = targetNode?.position || { x: 500, y: 200 };

      const newX = overridePosition ? overridePosition.x : Math.round((sourcePos.x + targetPos.x) / 2);
      const newY = overridePosition ? overridePosition.y : Math.round((sourcePos.y + targetPos.y) / 2);

      const resolvedSourceHandle = resolveSourceHandle(sourceNode, targetEdge.sourceHandle);
      const resolvedTargetHandle = resolveTargetHandle(targetNode, targetEdge.targetHandle);

      // Check for compound templates (FORK_JOIN, DYNAMIC_FORK, SWITCH, DO_WHILE, HUMAN, etc.)
      if (compoundTemplateRegistry.isCompound(newNodeType, { customData })) {
        const template = compoundTemplateRegistry.create(newNodeType, { x: newX, y: newY }, { customData });
        if (template) {
          // Downstream Node Push Invariant: Avoid overlapping nodes by shifting downstream descendants
          const requiredClearance = newX + template.envelopeWidth + 120;
          const deltaX = targetPos.x < requiredClearance ? requiredClearance - targetPos.x : 0;

          let updatedNodes = nodes;
          if (deltaX > 0 && targetNode) {
            const descendants = new Set<string>();
            const q = [targetNode.id];
            descendants.add(targetNode.id);
            while (q.length > 0) {
              const curr = q.shift()!;
              for (const e of edges) {
                if (e.source === curr && !descendants.has(e.target) && e.targetHandle !== 'loop-back') {
                  descendants.add(e.target);
                  q.push(e.target);
                }
              }
            }
            updatedNodes = updatedNodes.map((n) =>
              descendants.has(n.id) ? { ...n, position: { ...n.position, x: n.position.x + deltaX } } : n
            );
          }

          const edgeIn: Edge = {
            id: `e_${targetEdge.source}_to_${template.primaryNodeId}`,
            type: 'dagEdge',
            source: targetEdge.source,
            target: template.primaryNodeId,
            sourceHandle: resolvedSourceHandle,
            targetHandle: 'target-left',
            animated: true,
            label: targetEdge.label,
            data: targetEdge.data ? { ...targetEdge.data } : {},
          };

          const edgeOut: Edge = {
            id: `e_${template.exitNodeId}_to_${targetEdge.target}`,
            type: 'dagEdge',
            source: template.exitNodeId,
            target: targetEdge.target,
            sourceHandle: template.exitHandle || 'source-right',
            targetHandle: resolvedTargetHandle,
            animated: true,
          };

          setNodes([...updatedNodes, ...template.nodes]);
          setEdges([...edges.filter((e) => e.id !== edgeId), edgeIn, ...template.edges, edgeOut]);
          setSelectedNodeId(template.primaryNodeId);
          return;
        }
      }

      const uniqueSuffix = Date.now().toString().slice(-4);
      const taskRef = `${newNodeType.toLowerCase()}_task_${uniqueSuffix}`;
      const newNodeId = `node-${taskRef}`;

      const newNode: Node<DagNodeData> = {
        id: newNodeId,
        type: 'dagNode',
        position: { x: newX, y: newY },
        data: {
          taskReferenceName: taskRef,
          taskType: newNodeType,
          label: customData?.label || `${newNodeType} Task`,
          executionState: 'PENDING',
          domain: 'default',
          timeoutSeconds: 30,
          retryCount: 3,
          retryDelaySeconds: 2,
          backoffRate: 2.0,
          inputParameters: {},
          ...customData,
        },
      };

      // Downstream clearance for single node too if targetPos.x <= newX
      const requiredClearance = newX + 220 + 80;
      const deltaX = targetPos.x < requiredClearance ? requiredClearance - targetPos.x : 0;
      let updatedNodes = nodes;
      if (deltaX > 0 && targetNode) {
        const descendants = new Set<string>();
        const q = [targetNode.id];
        descendants.add(targetNode.id);
        while (q.length > 0) {
          const curr = q.shift()!;
          for (const e of edges) {
            if (e.source === curr && !descendants.has(e.target) && e.targetHandle !== 'loop-back') {
              descendants.add(e.target);
              q.push(e.target);
            }
          }
        }
        updatedNodes = updatedNodes.map((n) =>
          descendants.has(n.id) ? { ...n, position: { ...n.position, x: n.position.x + deltaX } } : n
        );
      }

      const edgeIn: Edge = {
        id: `e_${targetEdge.source}_to_${newNodeId}`,
        type: 'dagEdge',
        source: targetEdge.source,
        target: newNodeId,
        sourceHandle: resolvedSourceHandle,
        targetHandle: 'target-left',
        animated: true,
        label: targetEdge.label,
        data: targetEdge.data ? { ...targetEdge.data } : {},
      };

      const edgeOut: Edge = {
        id: `e_${newNodeId}_to_${targetEdge.target}`,
        type: 'dagEdge',
        source: newNodeId,
        target: targetEdge.target,
        sourceHandle: resolveSourceHandle(newNode, 'source-right'),
        targetHandle: resolvedTargetHandle,
        animated: true,
      };

      setNodes([...updatedNodes, newNode]);
      setEdges([...edges.filter((e) => e.id !== edgeId), edgeIn, edgeOut]);
      setSelectedNodeId(newNodeId);
    },
    [isReadOnly, edges, nodes, pushUndoSnapshot]
  );

  const handleRequestSplitEdge = useCallback(
    (edgeId: string, position?: { x: number; y: number }) => {
      if (isReadOnly) return;
      setEdgeSplitTarget({
        edgeId,
        position: position || { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      });
    },
    [isReadOnly]
  );

  // Multi-Node Selection & Alignment Handlers
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);

  const handleAlignLeft = useCallback(() => {
    if (selectedNodes.length < 2) return;
    pushUndoSnapshot();
    const minX = Math.min(...selectedNodes.map((n) => n.position.x));
    setNodes((nds) =>
      nds.map((n) => (n.selected ? { ...n, position: { ...n.position, x: minX } } : n))
    );
  }, [selectedNodes, pushUndoSnapshot]);

  const handleAlignCenterX = useCallback(() => {
    if (selectedNodes.length < 2) return;
    pushUndoSnapshot();
    const avgX = Math.round(
      selectedNodes.reduce((acc, n) => acc + n.position.x, 0) / selectedNodes.length
    );
    setNodes((nds) =>
      nds.map((n) => (n.selected ? { ...n, position: { ...n.position, x: avgX } } : n))
    );
  }, [selectedNodes, pushUndoSnapshot]);

  const handleAlignTop = useCallback(() => {
    if (selectedNodes.length < 2) return;
    pushUndoSnapshot();
    const minY = Math.min(...selectedNodes.map((n) => n.position.y));
    setNodes((nds) =>
      nds.map((n) => (n.selected ? { ...n, position: { ...n.position, y: minY } } : n))
    );
  }, [selectedNodes, pushUndoSnapshot]);

  const handleAlignMiddleY = useCallback(() => {
    if (selectedNodes.length < 2) return;
    pushUndoSnapshot();
    const avgY = Math.round(
      selectedNodes.reduce((acc, n) => acc + n.position.y, 0) / selectedNodes.length
    );
    setNodes((nds) =>
      nds.map((n) => (n.selected ? { ...n, position: { ...n.position, y: avgY } } : n))
    );
  }, [selectedNodes, pushUndoSnapshot]);

  const handleDistributeHorizontal = useCallback(() => {
    if (selectedNodes.length < 3) return;
    pushUndoSnapshot();
    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const minX = sorted[0].position.x;
    const maxX = sorted[sorted.length - 1].position.x;
    const step = (maxX - minX) / (sorted.length - 1);
    const posMap = new Map<string, number>();
    sorted.forEach((n, idx) => {
      posMap.set(n.id, Math.round(minX + idx * step));
    });
    setNodes((nds) =>
      nds.map((n) =>
        posMap.has(n.id) ? { ...n, position: { ...n.position, x: posMap.get(n.id)! } } : n
      )
    );
  }, [selectedNodes, pushUndoSnapshot]);

  const handleDistributeVertical = useCallback(() => {
    if (selectedNodes.length < 3) return;
    pushUndoSnapshot();
    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const minY = sorted[0].position.y;
    const maxY = sorted[sorted.length - 1].position.y;
    const step = (maxY - minY) / (sorted.length - 1);
    const posMap = new Map<string, number>();
    sorted.forEach((n, idx) => {
      posMap.set(n.id, Math.round(minY + idx * step));
    });
    setNodes((nds) =>
      nds.map((n) =>
        posMap.has(n.id) ? { ...n, position: { ...n.position, y: posMap.get(n.id)! } } : n
      )
    );
  }, [selectedNodes, pushUndoSnapshot]);

  const handleDuplicateSelected = useCallback(() => {
    if (isReadOnly || selectedNodes.length === 0) return;
    pushUndoSnapshot();
    const clonableNodes = selectedNodes.filter((n) => !n.data.isPermanent);
    if (clonableNodes.length === 0) return;

    const newNodes: Node<DagNodeData>[] = clonableNodes.map((n) => {
      const uniqueSuffix = Date.now().toString().slice(-4) + Math.random().toString(36).slice(2, 5);
      const newRef = `${n.data.taskReferenceName}_copy_${uniqueSuffix}`;
      const newId = `node-${newRef}`;

      return {
        ...n,
        id: newId,
        selected: true,
        position: {
          x: n.position.x + 40,
          y: n.position.y + 40,
        },
        data: {
          ...n.data,
          taskReferenceName: newRef,
          label: `${n.data.label || n.data.taskType} (Copy)`,
          isStartNode: false,
          isEndNode: false,
          isPermanent: false,
        },
      };
    });

    setNodes((nds) =>
      nds.map((n) => (n.selected ? { ...n, selected: false } : n)).concat(newNodes)
    );
  }, [isReadOnly, selectedNodes, pushUndoSnapshot]);

  const handleBulkDelete = useCallback(() => {
    if (isReadOnly) return;
    pushUndoSnapshot();
    const isProtectedNode = (n: Node<DagNodeData>) =>
      Boolean(
        n.data.isPermanent ||
        n.data.isStartNode ||
        n.data.isEndNode ||
        n.data.taskType === 'START_WORKFLOW' ||
        n.data.taskType === 'END_WORKFLOW'
      );
    const deletedNodeIds = new Set(
      nodes.filter((n) => n.selected && !isProtectedNode(n)).map((n) => n.id)
    );
    setNodes((nds) => nds.filter((n) => !n.selected || isProtectedNode(n)));
    setEdges((eds) =>
      eds.filter((e) => !e.selected && !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target))
    );
  }, [isReadOnly, nodes, pushUndoSnapshot]);

  // Keyboard shortcuts Cmd+Z / Cmd+Y / Cmd+D / Delete
  useEffect(() => {
    if (isReadOnly) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodes.length > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isReadOnly, handleUndo, handleRedo, handleDuplicateSelected, handleBulkDelete, selectedNodes.length]);

  // Strategy-driven Auto-Layout (Dagre vs ELK)
  const handleAutoLayout = useCallback(
    (direction: 'LR' | 'TB' = 'LR', algorithm?: LayoutAlgorithm) => {
      pushUndoSnapshot();
      const activeAlgo = algorithm || layoutAlgorithm;
      const strategy = getLayoutStrategy(activeAlgo);
      const result = strategy.layout(nodes, edges, { direction });
      setNodes(result.nodes);
      setEdges(result.edges);
    },
    [nodes, edges, pushUndoSnapshot, layoutAlgorithm]
  );

  const handleValidateDag = useCallback(() => {
    const errors = validateGraphTopology(nodes, edges);
    setValidationErrors(errors);
    setValidationBannerVisible(true);

    const errorMap = new Map<string, string>();
    for (const err of errors) {
      if (err.nodeId) {
        errorMap.set(err.nodeId, err.message);
      }
    }

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          validationError: errorMap.get(n.id) || undefined,
        },
      }))
    );
  }, [nodes, edges]);

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (isReadOnly) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [isReadOnly]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (isReadOnly) return;
      event.preventDefault();

      const type = event.dataTransfer.getData('application/dag-node-type') as DagNodeType;
      const rawData = event.dataTransfer.getData('application/dag-node-data');

      if (!type || !rawData) return;

      const parsedData = JSON.parse(rawData);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // 1. Proximity-based Edge Split Check:
      // If dropped near an existing workflow edge, auto-split and insert connected to both sides!
      const nearestEdge = findNearestEdge(position, nodes, edges, 140);
      if (nearestEdge) {
        handleSplitEdge(nearestEdge.id, type, parsedData, position);
        return;
      }

      // 2. Flow-aware Fallback Insertion:
      // If dropped on canvas without direct edge proximity, connect into the active flow
      // rather than leaving a disconnected orphan node.
      let targetFlowEdge: Edge | undefined;

      if (selectedNodeId) {
        const selectedOutgoing = edges.find(
          (e) => e.source === selectedNodeId && e.targetHandle !== 'loop-back'
        );
        if (selectedOutgoing) {
          targetFlowEdge = selectedOutgoing;
        } else {
          const selectedIncoming = edges.find((e) => e.target === selectedNodeId);
          if (selectedIncoming) {
            targetFlowEdge = selectedIncoming;
          }
        }
      }

      if (!targetFlowEdge) {
        const endEdge = edges.find((e) => {
          const target = nodes.find((n) => n.id === e.target);
          return target?.data.isEndNode || target?.data.taskType === 'END_WORKFLOW';
        });
        if (endEdge) {
          targetFlowEdge = endEdge;
        } else if (edges.length > 0) {
          targetFlowEdge = edges[0];
        }
      }

      if (targetFlowEdge) {
        handleSplitEdge(targetFlowEdge.id, type, parsedData, position);
        return;
      }

      // 3. Fallback for completely empty/disconnected canvas (0 edges):
      pushUndoSnapshot();
      if (compoundTemplateRegistry.isCompound(type, { customData: parsedData })) {
        const template = compoundTemplateRegistry.create(type, position, { customData: parsedData });
        if (template) {
          setNodes((nds) => nds.concat(template.nodes));
          setEdges((eds) => eds.concat(template.edges));
          setSelectedNodeId(template.primaryNodeId);
          return;
        }
      }

      const uniqueSuffix = Date.now().toString().slice(-4);
      const taskRef = `${type.toLowerCase()}_task_${uniqueSuffix}`;
      const newNodeId = `node-${taskRef}`;

      const newNode: Node<DagNodeData> = {
        id: newNodeId,
        type: 'dagNode',
        position,
        data: {
          taskReferenceName: taskRef,
          taskType: type,
          executionState: 'PENDING',
          domain: 'default',
          timeoutSeconds: 30,
          retryCount: 3,
          retryDelaySeconds: 2,
          backoffRate: 2.0,
          inputParameters: {},
          ...parsedData,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(newNodeId);
    },
    [isReadOnly, screenToFlowPosition, nodes, edges, selectedNodeId, handleSplitEdge, pushUndoSnapshot]
  );

  const isWorkflowBlank = useMemo(() => {
    if (isReadOnly || isDismissedEmptyState) return false;
    return (
      nodes.length === 2 &&
      nodes.every((n) => n.data.isStartNode || n.data.isEndNode || n.data.isPermanent)
    );
  }, [isReadOnly, isDismissedEmptyState, nodes]);

  const handleInsertStarterTask = useCallback(
    (taskType: DagNodeType, customData?: Partial<DagNodeData>) => {
      const directEdge =
        edges.find(
          (e) =>
            nodes.find((n) => n.id === e.source)?.data.isStartNode &&
            nodes.find((n) => n.id === e.target)?.data.isEndNode
        ) || edges[0];

      if (directEdge) {
        handleSplitEdge(directEdge.id, taskType, customData);
      } else {
        pushUndoSnapshot();
        if (compoundTemplateRegistry.isCompound(taskType, { customData })) {
          const template = compoundTemplateRegistry.create(taskType, { x: 300, y: 200 }, { customData });
          if (template) {
            setNodes((nds) => [...nds, ...template.nodes]);
            setEdges((eds) => [...eds, ...template.edges]);
            setSelectedNodeId(template.primaryNodeId);
            setIsDismissedEmptyState(true);
            return;
          }
        }
        const uniqueSuffix = Date.now().toString().slice(-4);
        const taskRef = `${taskType.toLowerCase()}_task_${uniqueSuffix}`;
        const newNodeId = `node-${taskRef}`;
        const newNode: Node<DagNodeData> = {
          id: newNodeId,
          type: 'dagNode',
          position: { x: 300, y: 200 },
          data: {
            taskReferenceName: taskRef,
            taskType,
            label: customData?.label || `${taskType} Task`,
            executionState: 'PENDING',
            domain: 'default',
            timeoutSeconds: 30,
            retryCount: 3,
            retryDelaySeconds: 2,
            backoffRate: 2.0,
            inputParameters: {},
            ...customData,
          },
        };
        setNodes((nds) => [...nds, newNode]);
        setSelectedNodeId(newNodeId);
      }
      setIsDismissedEmptyState(true);
    },
    [edges, nodes, handleSplitEdge, pushUndoSnapshot]
  );

  const handleInsertNode = useCallback(
    (type: DagNodeType, customData?: Partial<DagNodeData>) => {
      if (isReadOnly) return;
      let targetFlowEdge: Edge | undefined;

      if (selectedNodeId) {
        const selectedOutgoing = edges.find(
          (e) => e.source === selectedNodeId && e.targetHandle !== 'loop-back'
        );
        if (selectedOutgoing) {
          targetFlowEdge = selectedOutgoing;
        } else {
          const selectedIncoming = edges.find((e) => e.target === selectedNodeId);
          if (selectedIncoming) {
            targetFlowEdge = selectedIncoming;
          }
        }
      }

      if (!targetFlowEdge) {
        const endEdge = edges.find((e) => {
          const target = nodes.find((n) => n.id === e.target);
          return target?.data.isEndNode || target?.data.taskType === 'END_WORKFLOW';
        });
        if (endEdge) {
          targetFlowEdge = endEdge;
        } else if (edges.length > 0) {
          targetFlowEdge = edges[0];
        }
      }

      if (targetFlowEdge) {
        handleSplitEdge(targetFlowEdge.id, type, customData);
      } else {
        handleInsertStarterTask(type, customData);
      }
    },
    [isReadOnly, selectedNodeId, edges, nodes, handleSplitEdge, handleInsertStarterTask]
  );

  const handleSaveEdgeCondition = useCallback(
    (
      edgeId: string,
      updates: {
        label?: string;
        condition?: string;
        decisionCase?: string;
        isDefaultCase?: boolean;
      }
    ) => {
      if (isReadOnly) return;
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id === edgeId) {
            return {
              ...e,
              label:
                updates.label ||
                updates.decisionCase ||
                (updates.isDefaultCase ? 'DEFAULT' : updates.condition),
              data: {
                ...((e.data as object) || {}),
                condition: updates.condition,
                decisionCase: updates.decisionCase,
                isDefaultCase: updates.isDefaultCase,
              },
            };
          }
          return e;
        })
      );

      const targetEdge = edges.find((e) => e.id === edgeId);
      if (targetEdge) {
        const sourceNode = nodes.find((n) => n.id === targetEdge.source);
        const targetNode = nodes.find((n) => n.id === targetEdge.target);
        if (sourceNode?.data.taskType === 'SWITCH' && targetNode) {
          const targetRef = targetNode.data.taskReferenceName;
          const currentCases = { ...(sourceNode.data.decisionCases || {}) };
          let currentDefaults = [...(sourceNode.data.defaultCase || [])];

          if (updates.isDefaultCase) {
            if (!currentDefaults.includes(targetRef)) {
              currentDefaults.push(targetRef);
            }
          } else if (updates.decisionCase) {
            currentCases[updates.decisionCase] = [targetRef];
          }

          setNodes((nds) =>
            nds.map((n) =>
              n.id === sourceNode.id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      decisionCases: currentCases,
                      defaultCase: currentDefaults,
                    },
                  }
                : n
            )
          );
        }
      }
    },
    [isReadOnly, edges, nodes]
  );

  const handleNewBlank = useCallback(() => {
    pushUndoSnapshot();
    setNodes(BLANK_WORKFLOW_NODES);
    setEdges(BLANK_WORKFLOW_EDGES);
    setSelectedNodeId(null);
    setIsDismissedEmptyState(false);
  }, [pushUndoSnapshot]);

  const handleResetInitial = useCallback(() => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setSelectedNodeId(null);
    setValidationErrors([]);
    setValidationBannerVisible(false);
  }, []);

  const handleClearSelected = useCallback(() => {
    if (isReadOnly) return;
    pushUndoSnapshot();
    setNodes((nds) => nds.filter((n) => !n.selected || n.data.isPermanent));
    setEdges((eds) => eds.filter((e) => !e.selected));
  }, [isReadOnly, pushUndoSnapshot]);

  const handleApplyImportedJson = useCallback((importedIr: WorkflowIR) => {
    try {
      const { nodes: newNodes, edges: newEdges } = importFromWorkflowIR(importedIr);
      setNodes(newNodes);
      setEdges(newEdges);
      setValidationErrors([]);
      setValidationBannerVisible(false);
    } catch (e: any) {
      alert(`Import error: ${e.message}`);
    }
  }, []);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    undoStack,
    redoStack,
    pushUndoSnapshot,
    handleUndo,
    handleRedo,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    selectedNodeId,
    setSelectedNodeId,
    selectedNodes,
    edgeSplitTarget,
    setEdgeSplitTarget,
    handleSplitEdge,
    handleRequestSplitEdge,
    handleAlignLeft,
    handleAlignCenterX,
    handleAlignTop,
    handleAlignMiddleY,
    handleDistributeHorizontal,
    handleDistributeVertical,
    handleDuplicateSelected,
    handleBulkDelete,
    handleAutoLayout,
    handleValidateDag,
    validationErrors,
    setValidationErrors,
    validationBannerVisible,
    setValidationBannerVisible,
    edgeRoutingMode,
    setEdgeRoutingMode,
    layoutAlgorithm,
    setLayoutAlgorithm,
    isSnapToGrid,
    setIsSnapToGrid,
    onDragOver,
    onDrop,
    isWorkflowBlank,
    setIsDismissedEmptyState,
    handleInsertStarterTask,
    handleInsertNode,
    handleUpdateNodeData,
    handleSaveEdgeCondition,
    handleNewBlank,
    handleResetInitial,
    handleClearSelected,
    handleApplyImportedJson,
  };
}
