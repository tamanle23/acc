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

export interface UseDagStudioStateOptions {
  isReadOnly?: boolean;
  initialNodes?: Node<DagNodeData>[];
  initialEdges?: Edge[];
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
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
      if (connection.source === connection.target) return false;
      const targetNode = nodes.find((n) => n.id === connection.target);
      const sourceNode = nodes.find((n) => n.id === connection.source);
      // START node cannot have incoming edges (in-degree is strictly 0)
      if (targetNode?.data?.isStartNode) return false;
      // END node cannot have outgoing edges (out-degree is strictly 0)
      if (sourceNode?.data?.isEndNode) return false;
      return true;
    },
    [nodes]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (isReadOnly) return;
      const targetNode = nodes.find((n) => n.id === params.target);
      const sourceNode = nodes.find((n) => n.id === params.source);
      if (targetNode?.data?.isStartNode || sourceNode?.data?.isEndNode || params.source === params.target) {
        return;
      }
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'dagEdge',
            animated: true,
            data: {},
          },
          eds
        )
      );
    },
    [isReadOnly, nodes]
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
    (edgeId: string, newNodeType: DagNodeType = 'SIMPLE', customData?: Partial<DagNodeData>) => {
      if (isReadOnly) return;
      const targetEdge = edges.find((e) => e.id === edgeId);
      if (!targetEdge) return;

      pushUndoSnapshot();

      const sourceNode = nodes.find((n) => n.id === targetEdge.source);
      const targetNode = nodes.find((n) => n.id === targetEdge.target);

      const sourcePos = sourceNode?.position || { x: 100, y: 200 };
      const targetPos = targetNode?.position || { x: 500, y: 200 };

      const newX = Math.round((sourcePos.x + targetPos.x) / 2);
      const newY = Math.round((sourcePos.y + targetPos.y) / 2);

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

      const edgeIn: Edge = {
        id: `e_${targetEdge.source}_to_${newNodeId}`,
        type: 'dagEdge',
        source: targetEdge.source,
        target: newNodeId,
        animated: true,
        label: targetEdge.label,
        data: targetEdge.data ? { ...targetEdge.data } : {},
      };

      const edgeOut: Edge = {
        id: `e_${newNodeId}_to_${targetEdge.target}`,
        type: 'dagEdge',
        source: newNodeId,
        target: targetEdge.target,
        animated: true,
      };

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [...eds.filter((e) => e.id !== edgeId), edgeIn, edgeOut]);
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
    const deletedNodeIds = new Set(
      nodes.filter((n) => n.selected && !n.data.isPermanent).map((n) => n.id)
    );
    setNodes((nds) => nds.filter((n) => !n.selected || n.data.isPermanent));
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
    },
    [isReadOnly, screenToFlowPosition]
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
    handleUpdateNodeData,
    handleSaveEdgeCondition,
    handleNewBlank,
    handleResetInitial,
    handleClearSelected,
    handleApplyImportedJson,
  };
}
