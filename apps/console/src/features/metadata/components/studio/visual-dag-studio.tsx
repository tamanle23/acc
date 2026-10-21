import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DagWorkflowNodeComponent, type DagNodeData, type DagNodeType, type ExecutionState } from './dag-node';
import { DagPalette } from './dag-palette';
import { DagPropertyInspector } from './dag-property-inspector';
import { TaskTelemetryInspector } from './task-telemetry-inspector';
import { TimeTravelScrubber } from './time-travel-scrubber';
import { WorkflowExecutionFlamegraph } from './workflow-execution-flamegraph';
import { WorkflowDryRunModal } from './workflow-dry-run-modal';
import { WorkflowIrDialog } from './workflow-ir-dialog';
import { DagConditionEdge, type DagConditionEdgeData } from './dag-condition-edge';
import { DagEdgeConditionModal, type EdgeConditionModalData } from './dag-edge-condition-modal';
import { WorkflowVariableWatchDrawer } from './workflow-variable-watch-drawer';
import {
  exportToWorkflowIR,
  importFromWorkflowIR,
  validateGraphTopology,
  type WorkflowIR,
  type GraphValidationError,
} from './workflow-ir-converter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Activity,
  Plus,
  Trash2,
  FileCode,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Save,
  Eye,
  Lock,
  GitCompare,
  Undo2,
  Redo2,
  LayoutGrid,
  Bug,
  Braces,
  BarChart2,
  Sparkles,
} from 'lucide-react';
import {
  useWorkflowExecutionStream,
  type WorkflowStreamEvent,
} from '@/features/workflows/hooks/use-workflow-execution-stream';
import * as workflowApi from '@/features/workflows/api/workflow-api';
import { HotMigrationModal } from '@/features/workflows/components/hot-migration-modal';
import {
  useSaveWorkflowDefinition,
  useWorkflowDefinition,
  useUpdateWorkflowBreakpoints,
  usePauseWorkflowExecution,
  useResumeWorkflowExecution,
  useStepOverWorkflowExecution,
} from '@/features/workflows/api/workflow-api';
import { VisualJsonEditor } from '@/components/ui/json-editor';

export interface VisualDagStudioProps {
  mode?: 'full' | 'readonly' | 'designer' | 'execution';
  workflowKey?: string;
  executionId?: string | null;
  initialEvents?: WorkflowStreamEvent[];
  initialNodes?: Node<DagNodeData>[];
  initialEdges?: Edge[];
  onCloseExecution?: () => void;
  onSaveSuccess?: () => void;
}

const nodeTypes = {
  dagNode: DagWorkflowNodeComponent,
};

const edgeTypes = {
  dagEdge: DagConditionEdge,
};

export const BLANK_WORKFLOW_NODES: Node<DagNodeData>[] = [
  {
    id: 'node-start',
    type: 'dagNode',
    position: { x: 100, y: 200 },
    data: {
      taskReferenceName: 'workflow_start',
      taskType: 'NOOP',
      label: 'Workflow Start',
      executionState: 'PENDING',
      isPermanent: true,
      isStartNode: true,
      inputParameters: {},
    },
  },
  {
    id: 'node-end',
    type: 'dagNode',
    position: { x: 500, y: 200 },
    data: {
      taskReferenceName: 'workflow_end',
      taskType: 'NOOP',
      label: 'Workflow End',
      executionState: 'PENDING',
      isPermanent: true,
      isEndNode: true,
      inputParameters: {},
    },
  },
];

export const BLANK_WORKFLOW_EDGES: Edge[] = [
  {
    id: 'e_start_to_end',
    type: 'dagEdge',
    source: 'node-start',
    target: 'node-end',
    animated: true,
  },
];

export const INITIAL_NODES: Node<DagNodeData>[] = [
  {
    id: 'node-start',
    type: 'dagNode',
    position: { x: 40, y: 150 },
    data: {
      taskReferenceName: 'workflow_start',
      taskType: 'NOOP',
      label: 'Workflow Start',
      executionState: 'COMPLETED',
      isPermanent: true,
      isStartNode: true,
      inputParameters: {
        orderId: 'ORD-9821',
        speed: 'EXPRESS',
        postalCode: '94107',
      },
    },
  },
  {
    id: 'node-inventory',
    type: 'dagNode',
    position: { x: 280, y: 150 },
    data: {
      taskReferenceName: 'checkInventory',
      taskType: 'SIMPLE',
      label: 'Check Inventory',
      domain: 'inventory',
      timeoutSeconds: 15,
      retryCount: 3,
      retryDelaySeconds: 2,
      backoffRate: 2.0,
      executionState: 'COMPLETED',
      inputParameters: {
        orderId: '${workflow.input.orderId}',
      },
      compensateHandlerRef: 'cancelInventoryReservation',
    },
  },
  {
    id: 'node-route',
    type: 'dagNode',
    position: { x: 520, y: 150 },
    data: {
      taskReferenceName: 'routeShipping',
      taskType: 'SWITCH',
      label: 'Route Shipping',
      condition: '${workflow.input.speed}',
      executionState: 'COMPLETED',
      decisionCases: {
        EXPRESS: ['expressCourier'],
        STANDARD: ['groundPostal'],
      },
      defaultCase: ['groundPostal'],
    },
  },
  {
    id: 'node-courier',
    type: 'dagNode',
    position: { x: 760, y: 70 },
    data: {
      taskReferenceName: 'expressCourier',
      taskType: 'SIMPLE',
      label: 'Express Courier',
      domain: 'shipping',
      timeoutSeconds: 30,
      retryCount: 3,
      executionState: 'IN_PROGRESS',
      inputParameters: {
        trackingNumber: '${checkInventory.output.trackingNumber}',
      },
      compensateHandlerRef: 'cancelCourierBooking',
    },
  },
  {
    id: 'node-ground',
    type: 'dagNode',
    position: { x: 760, y: 230 },
    data: {
      taskReferenceName: 'groundPostal',
      taskType: 'SIMPLE',
      label: 'Ground Postal',
      domain: 'shipping',
      timeoutSeconds: 30,
      retryCount: 2,
      executionState: 'PENDING',
      inputParameters: {
        postalCode: '${workflow.input.postalCode}',
      },
    },
  },
  {
    id: 'node-end',
    type: 'dagNode',
    position: { x: 1020, y: 150 },
    data: {
      taskReferenceName: 'workflow_end',
      taskType: 'NOOP',
      label: 'Workflow End',
      executionState: 'PENDING',
      isPermanent: true,
      isEndNode: true,
      inputParameters: {
        orderId: '${workflow.input.orderId}',
        trackingNumber: '${expressCourier.output.trackingNumber}',
        status: 'FULFILLED',
      },
    },
  },
];

export const INITIAL_EDGES: Edge[] = [
  { id: 'e0', type: 'dagEdge', source: 'node-start', target: 'node-inventory', animated: true },
  { id: 'e1', type: 'dagEdge', source: 'node-inventory', target: 'node-route', animated: true },
  { id: 'e2', type: 'dagEdge', source: 'node-route', target: 'node-courier', label: 'EXPRESS', animated: true, data: { decisionCase: 'EXPRESS' } },
  { id: 'e3', type: 'dagEdge', source: 'node-route', target: 'node-ground', label: 'STANDARD', data: { decisionCase: 'STANDARD', isDefaultCase: true } },
  { id: 'e4', type: 'dagEdge', source: 'node-courier', target: 'node-end', animated: true },
  { id: 'e5', type: 'dagEdge', source: 'node-ground', target: 'node-end' },
];

function DagStudioCanvas({
  mode = 'full',
  workflowKey,
  executionId,
  initialEvents,
  initialNodes,
  initialEdges,
  onCloseExecution,
  onSaveSuccess,
}: VisualDagStudioProps) {
  const isReadOnly = mode === 'readonly' || mode === 'execution';
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const isExecutionOrLoaded = Boolean(executionId || workflowKey);
  const defaultNodes = initialNodes || (isExecutionOrLoaded ? INITIAL_NODES : BLANK_WORKFLOW_NODES);
  const defaultEdges = initialEdges || (isExecutionOrLoaded ? INITIAL_EDGES : BLANK_WORKFLOW_EDGES);

  const [nodes, setNodes] = useState<Node<DagNodeData>[]>(defaultNodes);
  const [edges, setEdges] = useState<Edge[]>(defaultEdges);
  const [showPalette, setShowPalette] = useState(!isReadOnly);

  // Real-time execution stream integration
  const stream = useWorkflowExecutionStream(executionId || null);

  // Time-travel history & scrubber state
  const [timelineEvents, setTimelineEvents] = useState<WorkflowStreamEvent[]>(initialEvents || []);
  const [currentScrubberIndex, setCurrentScrubberIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLiveHead, setIsLiveHead] = useState(true);

  // Property Inspector & Telemetry Sheet States
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);

  // Iteration 14: Execution View Tabs & Hover Cross-Highlighting
  const [activeViewTab, setActiveViewTab] = useState<'graph' | 'timeline'>('graph');
  const [activeHoveredTaskRef, setActiveHoveredTaskRef] = useState<string | null>(null);

  // Phase 39: Visual Graph Diff & Hot Migration States
  const [isHotMigrationOpen, setIsHotMigrationOpen] = useState(false);
  const [diffTargetVersion, setDiffTargetVersion] = useState<number | null>(null);
  const versionsQuery = workflowApi.useWorkflowVersions ? workflowApi.useWorkflowVersions(workflowKey || null) : { data: [] };
  const workflowVersions = useMemo(() => versionsQuery?.data || [], [versionsQuery?.data]);

  // IR Dialog State
  const [irDialogMode, setIrDialogMode] = useState<'export' | 'import'>('export');
  const [isIrDialogOpen, setIsIrDialogOpen] = useState(false);
  const [irDialogContent, setIrDialogContent] = useState('');

  // Dry-Run Simulation Modal State
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);

  // Validation State
  const [validationErrors, setValidationErrors] = useState<GraphValidationError[]>([]);
  const [validationBannerVisible, setValidationBannerVisible] = useState(false);

  // Seed events from snapshot or logs if timelineEvents is empty
  useEffect(() => {
    if (timelineEvents.length === 0 && stream.snapshot?.tasksByRef) {
      const syntheticEvents: WorkflowStreamEvent[] = [];
      Object.entries(stream.snapshot.tasksByRef).forEach(([ref, t], idx) => {
        syntheticEvents.push({
          event: `TASK_${t.status}`,
          data: {
            taskReferenceName: ref,
            taskId: t.taskId,
            taskType: t.taskType,
            status: t.status,
            output: t.output,
            error: t.error,
            timestamp: Date.now() - (10 - idx) * 1000,
          },
        });
      });
      if (syntheticEvents.length > 0) {
        setTimelineEvents(syntheticEvents);
        setCurrentScrubberIndex(syntheticEvents.length - 1);
      }
    }
  }, [stream.snapshot, timelineEvents.length]);

  // Sync live execution stream states onto canvas nodes when at live HEAD
  useEffect(() => {
    if (isReadOnly && isLiveHead && Object.keys(stream.nodeStates).length > 0) {
      setNodes((nds) => {
        let hasChanges = false;
        const updated = nds.map((n) => {
          const taskRef = n.data.taskReferenceName;
          const liveState = stream.nodeStates[taskRef];
          if (liveState && liveState !== n.data.executionState) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...n.data,
                executionState: liveState,
              },
            };
          }
          return n;
        });
        return hasChanges ? updated : nds;
      });
    }
  }, [isReadOnly, isLiveHead, stream.nodeStates]);

  // Phase 39: Compute visual graph diff overlay when comparison target is selected
  useEffect(() => {
    if (!diffTargetVersion) {
      setNodes((nds) => {
        if (!nds.some((n) => n.data.diffStatus !== undefined)) return nds;
        return nds.map((n) => (n.data.diffStatus ? { ...n, data: { ...n.data, diffStatus: undefined } } : n));
      });
      return;
    }

    const targetVer = workflowVersions.find((v) => v.version === diffTargetVersion);
    if (!targetVer || !targetVer.definition) return;

    const targetTasks = ((targetVer.definition as any).tasks || []) as Array<{ taskReferenceName: string; taskType: string }>;
    const targetRefMap = new Map(targetTasks.map((t) => [t.taskReferenceName, t]));

    setNodes((nds) => {
      const currentRefMap = new Map(nds.map((n) => [n.data.taskReferenceName, n]));

      // 1. Tag existing nodes (modified or removed)
      const updatedNodes = nds.map((n) => {
        const targetTask = targetRefMap.get(n.data.taskReferenceName);
        let diffStatus: 'added' | 'removed' | 'modified' | undefined = undefined;
        if (!targetTask) {
          diffStatus = 'removed';
        } else if (targetTask.taskType !== n.data.taskType) {
          diffStatus = 'modified';
        }
        return {
          ...n,
          data: {
            ...n.data,
            diffStatus,
          },
        };
      });

      // 2. Add placeholder nodes for tasks added in target definition
      const addedTasks = targetTasks.filter((t) => !currentRefMap.has(t.taskReferenceName));
      const newlyAddedNodes: Node<DagNodeData>[] = addedTasks.map((t, idx) => ({
        id: `node-diff-added-${t.taskReferenceName}`,
        type: 'dagNode',
        position: { x: 300 + idx * 220, y: 320 },
        data: {
          taskReferenceName: t.taskReferenceName,
          taskType: (t.taskType as any) || 'SIMPLE',
          label: `${t.taskReferenceName} (v${diffTargetVersion})`,
          diffStatus: 'added',
          executionState: 'PENDING',
        },
      }));

      return [...updatedNodes, ...newlyAddedNodes];
    });
  }, [diffTargetVersion, workflowVersions]);

  // Apply node states based on timeline scrubber position
  const applyEventsUpToIndex = useCallback(
    (targetIndex: number) => {
      const activeEvents = timelineEvents.slice(0, targetIndex + 1);
      const stateMap: Record<
        string,
        {
          state: ExecutionState;
          output?: any;
          error?: string;
          durationMs?: number;
          attemptNumber?: number;
        }
      > = {};

      for (const ev of activeEvents) {
        const ref = ev.data?.taskReferenceName;
        if (ref) {
          let state: ExecutionState = 'PENDING';
          const status = ev.data.status;
          if (status === 'IN_PROGRESS' || status === 'RUNNING') state = 'IN_PROGRESS';
          else if (status === 'COMPLETED') state = 'COMPLETED';
          else if (status === 'FAILED') state = 'FAILED';
          else if (status === 'TIMED_OUT') state = 'TIMED_OUT';
          else if (status === 'WAITING_FOR_APPROVAL') state = 'WAITING_FOR_APPROVAL';

          stateMap[ref] = {
            state,
            output: ev.data.output as any,
            error: ev.data.error,
            durationMs: (ev.data.durationMs as number) || undefined,
            attemptNumber: (ev.data.attemptNumber as number) || 1,
          };
        }
      }

      setNodes((nds) =>
        nds.map((n) => {
          const taskRef = n.data.taskReferenceName;
          const computed = stateMap[taskRef];
          if (computed) {
            return {
              ...n,
              data: {
                ...n.data,
                executionState: computed.state,
                outputParameters: computed.output ?? n.data.outputParameters,
                error: computed.error ?? n.data.error,
                durationMs: computed.durationMs ?? n.data.durationMs,
                attemptNumber: computed.attemptNumber ?? n.data.attemptNumber,
              },
            };
          }
          return {
            ...n,
            data: {
              ...n.data,
              executionState: 'PENDING',
            },
          };
        })
      );
    },
    [timelineEvents]
  );

  // Playback timer for time-travel scrubber
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentScrubberIndex((prev) => {
        if (prev >= timelineEvents.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        const next = prev + 1;
        applyEventsUpToIndex(next);
        return next;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timelineEvents.length, applyEventsUpToIndex]);

  // Load existing workflow definition if workflowKey is provided
  const workflowDefQuery = useWorkflowDefinition(workflowKey || null);
  const saveWorkflowMutation = useSaveWorkflowDefinition();

  useEffect(() => {
    if (workflowDefQuery.data) {
      try {
        const { nodes: loadedNodes, edges: loadedEdges } = importFromWorkflowIR(
          workflowDefQuery.data as any
        );
        setNodes(loadedNodes);
        setEdges(loadedEdges);
      } catch (e) {
        console.warn('Failed to parse imported workflow definition:', e);
      }
    }
  }, [workflowDefQuery.data]);

  const availableTaskRefs = useMemo(
    () => nodes.map((n) => n.data.taskReferenceName),
    [nodes]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  // Edge Condition Modal State (Iteration 15)
  const [selectedEdgeData, setSelectedEdgeData] = useState<EdgeConditionModalData | null>(null);
  const [isEdgeConditionOpen, setIsEdgeConditionOpen] = useState(false);

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

  const handleOpenEdgeEditor = useCallback(
    (edgeId: string) => {
      if (isReadOnly) return;
      const targetEdge = edges.find((e) => e.id === edgeId);
      if (!targetEdge) return;
      const sourceNode = nodes.find((n) => n.id === targetEdge.source);
      const targetNode = nodes.find((n) => n.id === targetEdge.target);

      setSelectedEdgeData({
        edgeId: targetEdge.id,
        sourceTaskRef: sourceNode?.data?.taskReferenceName || targetEdge.source,
        targetTaskRef: targetNode?.data?.taskReferenceName || targetEdge.target,
        sourceTaskType: sourceNode?.data?.taskType,
        label: typeof targetEdge.label === 'string' ? targetEdge.label : undefined,
        condition: (targetEdge.data as DagConditionEdgeData)?.condition,
        decisionCase: (targetEdge.data as DagConditionEdgeData)?.decisionCase,
        isDefaultCase: (targetEdge.data as DagConditionEdgeData)?.isDefaultCase,
      });
      setIsEdgeConditionOpen(true);
    },
    [edges, nodes, isReadOnly]
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
              label: updates.label || updates.decisionCase || (updates.isDefaultCase ? 'DEFAULT' : updates.condition),
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

      // If source is a SWITCH node, sync decisionCases and defaultCase
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

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      handleOpenEdgeEditor(edge.id);
    },
    [handleOpenEdgeEditor]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      if (isReadOnly) {
        setIsTelemetryOpen(true);
      } else {
        setIsInspectorOpen(true);
      }
    },
    [isReadOnly]
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

  // Phase 5 & 7: Undo/Redo history, Auto-Layout, Breakpoints & Debugger Controls
  const [undoStack, setUndoStack] = useState<Array<{ nodes: Node<DagNodeData>[]; edges: Edge[] }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ nodes: Node<DagNodeData>[]; edges: Edge[] }>>([]);
  const [breakpoints, setBreakpoints] = useState<string[]>([]);
  const [isVariableWatchOpen, setIsVariableWatchOpen] = useState<boolean>(false);

  const updateBreakpointsMutation = useUpdateWorkflowBreakpoints();
  const pauseExecutionMutation = usePauseWorkflowExecution();
  const resumeExecutionMutation = useResumeWorkflowExecution();
  const stepOverExecutionMutation = useStepOverWorkflowExecution();

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

  const handleSplitEdge = useCallback(
    (edgeId: string, newNodeType: DagNodeType = 'SIMPLE') => {
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
          label: `${newNodeType} Task`,
          executionState: 'PENDING',
          domain: 'default',
          timeoutSeconds: 30,
          retryCount: 3,
          retryDelaySeconds: 2,
          backoffRate: 2.0,
          inputParameters: {},
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

  // Keyboard shortcuts Cmd+Z / Cmd+Y
  useEffect(() => {
    if (isReadOnly) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isReadOnly, handleUndo, handleRedo]);

  // Topological Auto-Layout (LR or TB)
  const handleAutoLayout = useCallback(
    (direction: 'LR' | 'TB' = 'LR') => {
      pushUndoSnapshot();
      const inDegree = new Map<string, number>();
      const adj = new Map<string, string[]>();
      nodes.forEach((n) => {
        inDegree.set(n.id, 0);
        adj.set(n.id, []);
      });
      edges.forEach((e) => {
        if (adj.has(e.source) && inDegree.has(e.target)) {
          adj.get(e.source)!.push(e.target);
          inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
        }
      });

      const layerMap = new Map<string, number>();
      const queue: string[] = [];
      inDegree.forEach((deg, id) => {
        if (deg === 0) {
          queue.push(id);
          layerMap.set(id, 0);
        }
      });

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const currLayer = layerMap.get(curr) || 0;
        for (const nxt of adj.get(curr) || []) {
          layerMap.set(nxt, Math.max(layerMap.get(nxt) || 0, currLayer + 1));
          inDegree.set(nxt, (inDegree.get(nxt) || 1) - 1);
          if (inDegree.get(nxt) === 0) {
            queue.push(nxt);
          }
        }
      }

      const layers = new Map<number, string[]>();
      nodes.forEach((n) => {
        const l = layerMap.get(n.id) ?? 0;
        if (!layers.has(l)) layers.set(l, []);
        layers.get(l)!.push(n.id);
      });

      setNodes((nds) =>
        nds.map((n) => {
          const l = layerMap.get(n.id) ?? 0;
          const siblings = layers.get(l) || [n.id];
          const idx = siblings.indexOf(n.id);
          const position =
            direction === 'LR'
              ? { x: 60 + l * 280, y: 100 + idx * 150 }
              : { x: 120 + idx * 250, y: 70 + l * 160 };
          return { ...n, position };
        })
      );
    },
    [nodes, edges, pushUndoSnapshot]
  );

  // Toggle node breakpoint
  const handleToggleBreakpoint = useCallback(
    (taskReferenceName: string) => {
      setBreakpoints((prev) => {
        const exists = prev.includes(taskReferenceName);
        const next = exists ? prev.filter((b) => b !== taskReferenceName) : [...prev, taskReferenceName];
        if (executionId) {
          updateBreakpointsMutation.mutate({ executionId, breakpoints: next });
        }
        return next;
      });
    },
    [executionId, updateBreakpointsMutation]
  );

  // Decorate nodes with boundary badges, permanent status, and breakpoint handler
  const isExecutionMode = Boolean(isReadOnly && executionId);
  const decoratedNodes = useMemo(() => {
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    nodes.forEach((n) => {
      inDegree.set(n.id, 0);
      outDegree.set(n.id, 0);
    });
    edges.forEach((e) => {
      if (inDegree.has(e.target)) inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
      if (outDegree.has(e.source)) outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1);
    });

    return nodes.map((n) => {
      const degIn = inDegree.get(n.id) ?? 0;
      const degOut = outDegree.get(n.id) ?? 0;
      return {
        ...n,
        data: {
          ...n.data,
          isStartNode: degIn === 0,
          isEndNode: degOut === 0,
          hasBreakpoint: isExecutionMode ? breakpoints.includes(n.data.taskReferenceName) : false,
          onToggleBreakpoint: isExecutionMode ? handleToggleBreakpoint : undefined,
        },
      };
    });
  }, [nodes, edges, breakpoints, handleToggleBreakpoint, isExecutionMode]);

  // Traversed Path & Dead Branch Contrast Highlighting + Condition Edge edit triggers
  const decoratedEdges = useMemo(() => {
    if (!isExecutionMode) {
      return edges.map((e) => {
        const baseEdgeData = (e.data as object) || {};
        return {
          ...e,
          type: 'dagEdge',
          data: {
            ...baseEdgeData,
            onEditEdge: isReadOnly ? undefined : handleOpenEdgeEditor,
            onSplitEdge: isReadOnly ? undefined : handleSplitEdge,
          },
        };
      });
    }

    const nodeMap = new Map<string, Node<DagNodeData>>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    return edges.map((e) => {
      const baseEdgeData = (e.data as object) || {};
      const withHandler = {
        ...baseEdgeData,
        onEditEdge: isReadOnly ? undefined : handleOpenEdgeEditor,
        onSplitEdge: isReadOnly ? undefined : handleSplitEdge,
      };

      const sourceNode = nodeMap.get(e.source);
      const targetNode = nodeMap.get(e.target);

      const sourceState = sourceNode?.data?.executionState;
      const targetState = targetNode?.data?.executionState;

      const isSourceCompleted = sourceState === 'COMPLETED';
      const isTargetActiveOrDone =
        targetState === 'COMPLETED' ||
        targetState === 'IN_PROGRESS' ||
        targetState === 'PAUSED_AT_BREAKPOINT';

      const isTraversed = isSourceCompleted && isTargetActiveOrDone;

      // Dead branch if upstream node finished, but this downstream branch was bypassed/skipped (remains PENDING)
      const isBypassedBranch =
        isSourceCompleted && targetState === 'PENDING' && !isTargetActiveOrDone;

      let edgeStyle: React.CSSProperties = { ...e.style };
      let className = e.className || '';

      if (isTraversed) {
        edgeStyle = {
          ...edgeStyle,
          stroke: '#10b981', // Emerald glow
          strokeWidth: 3,
          filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))',
        };
        className = cn(className, 'stroke-emerald-500 animate-pulse');
      } else if (isBypassedBranch) {
        edgeStyle = {
          ...edgeStyle,
          stroke: '#94a3b8',
          strokeWidth: 1.5,
          strokeDasharray: '4 4',
          opacity: 0.35,
        };
        className = cn(className, 'opacity-35');
      }

      return {
        ...e,
        type: 'dagEdge',
        data: withHandler,
        animated: isTraversed ? true : e.animated,
        style: edgeStyle,
        className,
      };
    });
  }, [edges, nodes, isExecutionMode, isReadOnly, handleOpenEdgeEditor, handleSplitEdge]);

  // Compute aggregated Variable Watch state from workflow snapshot or current node states
  const variableWatchSnapshot = useMemo(() => {
    const taskOutputs: Record<string, unknown> = {};
    nodes.forEach((n) => {
      if (n.data.outputParameters && Object.keys(n.data.outputParameters).length > 0) {
        taskOutputs[n.data.taskReferenceName] = n.data.outputParameters;
      }
    });
    return {
      workflowStatus: stream.workflowStatus || (breakpoints.length > 0 ? 'PAUSED_AT_BREAKPOINT' : 'RUNNING'),
      breakpoints,
      workflowVariables: (stream.snapshot as any)?.variables || {
        orderId: 'ORD-2026-991',
        tier: 'EXPRESS',
      },
      taskOutputs,
    };
  }, [nodes, stream.workflowStatus, stream.snapshot, breakpoints]);

  const handleExportJson = useCallback(() => {
    const ir = exportToWorkflowIR(nodes, edges);
    setIrDialogContent(JSON.stringify(ir, null, 2));
    setIrDialogMode('export');
    setIsIrDialogOpen(true);
  }, [nodes, edges]);

  const handleOpenImportDialog = useCallback(() => {
    setIrDialogContent('');
    setIrDialogMode('import');
    setIsIrDialogOpen(true);
  }, []);

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

  const handleSimulationSuccess = useCallback((simResult: any) => {
    if (!simResult) return;
    const tasksByRef = simResult.tasksByRef || {};
    setNodes((nds) =>
      nds.map((n) => {
        const ref = n.data.taskReferenceName;
        const taskSim = tasksByRef[ref];
        if (taskSim) {
          return {
            ...n,
            data: {
              ...n.data,
              executionState: taskSim.status || 'COMPLETED',
              outputParameters: taskSim.output || n.data.outputParameters,
              durationMs: taskSim.durationMs ?? 15,
            },
          };
        }
        return {
          ...n,
          data: {
            ...n.data,
            executionState: 'PENDING',
          },
        };
      })
    );
  }, []);

  const handleDebuggerPause = () => {
    if (executionId) {
      pauseExecutionMutation.mutate(executionId);
    }
    setNodes((nds) =>
      nds.map((n) =>
        n.data.executionState === 'IN_PROGRESS'
          ? { ...n, data: { ...n.data, executionState: 'PAUSED_AT_BREAKPOINT' } }
          : n
      )
    );
  };

  const handleDebuggerStepOver = () => {
    if (executionId) {
      stepOverExecutionMutation.mutate(executionId);
    }
    setNodes((nds) => {
      let stepped = false;
      return nds.map((n) => {
        if (
          !stepped &&
          (n.data.executionState === 'PAUSED_AT_BREAKPOINT' ||
            n.data.executionState === 'IN_PROGRESS' ||
            n.data.executionState === 'PENDING')
        ) {
          stepped = true;
          return {
            ...n,
            data: {
              ...n.data,
              executionState: 'COMPLETED',
              durationMs: 42,
              outputParameters: { stepped: true, timestamp: Date.now() },
            },
          };
        }
        return n;
      });
    });
  };

  const handleDebuggerResume = () => {
    if (executionId) {
      resumeExecutionMutation.mutate(executionId);
    }
    setNodes((nds) =>
      nds.map((n) =>
        n.data.executionState === 'PAUSED_AT_BREAKPOINT'
          ? { ...n, data: { ...n.data, executionState: 'COMPLETED' } }
          : n
      )
    );
  };

  const handleReset = () => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setSelectedNodeId(null);
    setIsInspectorOpen(false);
    setIsTelemetryOpen(false);
    setValidationErrors([]);
    setValidationBannerVisible(false);
    setIsLiveHead(true);
  };

  const handleClearSelected = () => {
    if (isReadOnly) return;
    pushUndoSnapshot();
    // Do not allow deleting permanent boundary nodes (Start/End)
    setNodes((nds) => nds.filter((n) => !n.selected || n.data.isPermanent));
    setEdges((eds) => eds.filter((e) => !e.selected));
  };

  // Time-travel handler callbacks
  const handleSeek = (index: number) => {
    setIsLiveHead(false);
    setIsPlaying(false);
    setCurrentScrubberIndex(index);
    applyEventsUpToIndex(index);
  };

  const handleStepForward = () => {
    if (currentScrubberIndex < timelineEvents.length - 1) {
      handleSeek(currentScrubberIndex + 1);
    }
  };

  const handleStepBackward = () => {
    if (currentScrubberIndex > 0) {
      handleSeek(currentScrubberIndex - 1);
    }
  };

  const handleResumeLive = () => {
    setIsLiveHead(true);
    setIsPlaying(false);
    if (timelineEvents.length > 0) {
      const lastIdx = timelineEvents.length - 1;
      setCurrentScrubberIndex(lastIdx);
      applyEventsUpToIndex(lastIdx);
    }
  };

  return (
    <div
      ref={reactFlowWrapper}
      className="relative w-full h-[650px] rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-xl bg-card/60"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Studio Header Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 p-2 rounded-xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/30 dark:border-white/10 shadow-lg flex-wrap">
        <div className="flex items-center gap-2 mr-1">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-bold text-foreground">Visual DAG Studio 2.0</span>
          {isReadOnly ? (
            <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Read-Only
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              Full Authoring
            </Badge>
          )}
        </div>

        <div className="h-4 w-[1px] bg-border/50" />

        {/* Full Mode Actions */}
        {!isReadOnly && (
          <>
            <Button
              size="sm"
              variant={showPalette ? 'default' : 'outline'}
              className="h-7 text-xs gap-1"
              onClick={() => setShowPalette((prev) => !prev)}
            >
              <Plus className="w-3 h-3" />
              Palette
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => {
                pushUndoSnapshot();
                setNodes(BLANK_WORKFLOW_NODES);
                setEdges(BLANK_WORKFLOW_EDGES);
                setSelectedNodeId(null);
              }}
              title="Reset canvas to blank workflow (START and END only)"
              data-testid="dag-new-blank-btn"
            >
              <RotateCcw className="w-3 h-3 text-muted-foreground" />
              Blank
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => handleAutoLayout('LR')}
              title="Topological Auto-Layout (Left-to-Right)"
              data-testid="dag-auto-layout-btn"
            >
              <LayoutGrid className="w-3 h-3 text-indigo-500" />
              Auto-Layout
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Undo (Cmd+Z)"
              aria-label="Undo"
            >
              <Undo2 className="w-3 h-3" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo (Cmd+Y)"
              aria-label="Redo"
            >
              <Redo2 className="w-3 h-3" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={handleValidateDag}
              title="Run Kahn & Tarjan cycle checks and binding validation"
            >
              {validationErrors.length > 0 ? (
                <AlertTriangle className="w-3 h-3 text-rose-500" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              )}
              Validate DAG
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={handleExportJson}
              title="Export graph to canonical workflow-ir-schema-v1.json"
            >
              <FileCode className="w-3 h-3 text-sky-500" />
              Export IR
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={handleOpenImportDialog}
              title="Import canonical JSON IR onto canvas"
            >
              <Upload className="w-3 h-3 text-indigo-500" />
              Import IR
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => setIsDryRunOpen(true)}
              title="Dry-run simulate workflow execution with mock inputs"
              data-testid="dag-dry-run-btn"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              Dry Run
            </Button>

            <div className="h-4 w-[1px] bg-border/50" />

            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1 bg-primary text-primary-foreground shadow-sm disabled:opacity-50"
              onClick={() => {
                const errors = validateGraphTopology(nodes, edges);
                if (errors.length > 0) {
                  setValidationErrors(errors);
                  setValidationBannerVisible(true);
                  return;
                }
                const ir = exportToWorkflowIR(nodes, edges);
                saveWorkflowMutation.mutate(ir, {
                  onSuccess: () => {
                    if (onSaveSuccess) onSaveSuccess();
                  },
                });
              }}
              disabled={saveWorkflowMutation.isPending || validationErrors.length > 0}
              title={
                validationErrors.length > 0
                  ? `Cannot save: ${validationErrors.length} DAG topology issue(s)`
                  : 'Save workflow definition to backend catalog'
              }
              data-testid="dag-save-btn"
            >
              <Save className="w-3 h-3" />
              {saveWorkflowMutation.isPending ? 'Saving...' : 'Save DAG'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
              onClick={handleClearSelected}
              title="Delete selected nodes/edges"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </Button>
          </>
        )}

        {/* Read-Only Mode Actions & View Switcher */}
        {isReadOnly && (
          <div className="flex items-center gap-2">
            <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20 text-[10px]">
              <Eye className="w-3 h-3 mr-1" />
              Execution & Back-Test View
            </Badge>

            {/* View Switcher: Graph vs Timeline */}
            <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/40">
              <Button
                size="sm"
                variant={activeViewTab === 'graph' ? 'default' : 'ghost'}
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => setActiveViewTab('graph')}
                data-testid="dag-view-graph-tab"
              >
                <LayoutGrid className="w-3 h-3" />
                Graph
              </Button>
              <Button
                size="sm"
                variant={activeViewTab === 'timeline' ? 'default' : 'ghost'}
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => setActiveViewTab('timeline')}
                data-testid="dag-view-timeline-tab"
              >
                <BarChart2 className="w-3 h-3" />
                Timeline
              </Button>
            </div>

            {onCloseExecution && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCloseExecution}>
                Exit View
              </Button>
            )}
          </div>
        )}

        {/* Phase 7: Visual Debugger Control Bar (Only active in execution inspection mode) */}
        {isExecutionMode && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Bug className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mr-0.5" />
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">
              Debugger {breakpoints.length > 0 ? `(${breakpoints.length} BP)` : ''}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDebuggerPause}
              className="h-6 px-1.5 text-[10px] gap-1"
              title="Pause execution before next task"
              data-testid="debugger-pause-btn"
            >
              <Pause className="w-3 h-3 text-amber-500" />
              Pause
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDebuggerStepOver}
              className="h-6 px-1.5 text-[10px] gap-1"
              title="Step Over single frontier task"
              data-testid="debugger-step-btn"
            >
              <StepForward className="w-3 h-3 text-sky-500" />
              Step Over
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDebuggerResume}
              className="h-6 px-1.5 text-[10px] gap-1"
              title="Resume workflow execution"
              data-testid="debugger-resume-btn"
            >
              <Play className="w-3 h-3 text-emerald-500" />
              Resume
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isVariableWatchOpen ? 'default' : 'ghost'}
              onClick={() => setIsVariableWatchOpen((prev) => !prev)}
              className="h-6 px-1.5 text-[10px] gap-1"
              title="Toggle Live Variable Watch & State Diff Drawer"
              data-testid="debugger-variable-watch-btn"
            >
              <Braces className="w-3 h-3" />
              Watch
            </Button>
          </div>
        )}

        {/* Phase 39: Visual Graph Diff Version Selector */}
        {workflowVersions.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-muted/40 border border-border/50">
            <GitCompare className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Diff:</span>
            <select
              aria-label="Diff comparison version"
              value={diffTargetVersion ?? ''}
              onChange={(e) => setDiffTargetVersion(e.target.value ? Number(e.target.value) : null)}
              className="text-[11px] bg-transparent border-none focus:outline-none cursor-pointer font-medium text-foreground"
            >
              <option value="">None (Current)</option>
              {workflowVersions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} ({v.status})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Phase 39: Hot Migration Operator Modal Button */}
        {executionId && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 shadow-sm"
            onClick={() => setIsHotMigrationOpen(true)}
            title="Open Hot Migration compatibility checker & execution rewiring"
          >
            <GitCompare className="w-3 h-3" />
            Hot Migrate
          </Button>
        )}

        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleReset}>
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>

      {/* Phase 7 / Iteration 15: Execution Variable Watch Drawer */}
      {isExecutionMode && (
        <WorkflowVariableWatchDrawer
          open={isVariableWatchOpen}
          onOpenChange={setIsVariableWatchOpen}
          executionId={executionId}
          workflowStatus={stream.workflowStatus || (breakpoints.length > 0 ? 'PAUSED_AT_BREAKPOINT' : 'RUNNING')}
          pausedAtNode={stream.snapshot?.outputPayload?.pausedAtNode as string || null}
          breakpoints={breakpoints}
          onRemoveBreakpoint={handleToggleBreakpoint}
          variablesSnapshot={
            (stream.snapshot as any)?.variables ||
            (stream.snapshot as any)?.inputPayload || {
              orderId: 'ORD-2026-991',
              tier: 'EXPRESS',
            }
          }
          taskOutputs={variableWatchSnapshot.taskOutputs}
          onStepOver={handleDebuggerStepOver}
          onPause={handleDebuggerPause}
          onResume={handleDebuggerResume}
          isStepping={stepOverExecutionMutation.isPending}
        />
      )}

      {/* Iteration 15: Visual Edge Condition Modal */}
      {!isReadOnly && (
        <DagEdgeConditionModal
          open={isEdgeConditionOpen}
          onOpenChange={setIsEdgeConditionOpen}
          edgeData={selectedEdgeData}
          availableTaskRefs={availableTaskRefs}
          onSaveEdgeCondition={handleSaveEdgeCondition}
        />
      )}

      {/* Validation Status Notification Banner */}
      {!isReadOnly && validationBannerVisible && (
        <div className="absolute top-16 right-4 z-20 max-w-sm p-3 rounded-xl backdrop-blur-xl shadow-2xl border transition-all animate-in fade-in slide-in-from-top-2">
          {validationErrors.length === 0 ? (
            <div className="flex items-center justify-between gap-3 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-semibold">DAG is acyclic & all bindings valid!</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[10px] px-1"
                onClick={() => setValidationBannerVisible(false)}
              >
                Dismiss
              </Button>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{validationErrors.length} DAG Issue(s) Found</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 text-[10px] px-1"
                  onClick={() => setValidationBannerVisible(false)}
                >
                  Dismiss
                </Button>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-1 max-h-32 overflow-y-auto">
                {validationErrors.map((err, i) => (
                  <li key={i} className="truncate">
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Floating Drag-and-Drop Task Palette (Full mode only) */}
      {!isReadOnly && showPalette && (
        <div className="absolute top-16 left-4 z-10">
          <DagPalette />
        </div>
      )}

      {/* Viewport: Either React Flow Canvas or Concurrency Flamegraph */}
      {activeViewTab === 'timeline' && isReadOnly ? (
        <div className="absolute inset-0 pt-16 p-6 overflow-y-auto">
          <WorkflowExecutionFlamegraph
            events={timelineEvents}
            activeTaskRef={activeHoveredTaskRef}
            onHoverTask={setActiveHoveredTaskRef}
            onClickTask={(ref) => {
              const node = nodes.find((n) => n.data.taskReferenceName === ref);
              if (node) {
                setSelectedNodeId(node.id);
                setIsTelemetryOpen(true);
              }
            }}
          />
        </div>
      ) : (
        <ReactFlow
          nodes={decoratedNodes}
          edges={decoratedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={isReadOnly ? undefined : onNodesChange}
          onEdgesChange={isReadOnly ? undefined : onEdgesChange}
          onConnect={isReadOnly ? undefined : onConnect}
          isValidConnection={isValidConnection}
          onNodeClick={onNodeClick}
          onEdgeClick={isReadOnly ? undefined : onEdgeClick}
          nodesDraggable={!isReadOnly}
          nodesConnectable={!isReadOnly}
          elementsSelectable={true}
          fitView
        >
          <Background gap={16} size={1} />
          <Controls className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl !shadow-lg" />
          <MiniMap
            className="!bg-white/80 dark:!bg-slate-900/80 !border-white/20 !rounded-xl"
            nodeColor={(n) => {
              const data = n.data as DagNodeData;
              if (data?.validationError) return '#ef4444';
              if (data?.executionState === 'COMPLETED') return '#10b981';
              if (data?.executionState === 'PAUSED_AT_BREAKPOINT') return '#f59e0b';
              if (data?.executionState === 'IN_PROGRESS') return '#0284c7';
              if (data?.executionState === 'FAILED') return '#ef4444';
              return '#94a3b8';
            }}
          />
        </ReactFlow>
      )}

      {/* Full Mode Property Inspector Drawer */}
      {!isReadOnly && (
        <DagPropertyInspector
          nodeId={selectedNodeId}
          nodeData={selectedNode?.data || null}
          open={isInspectorOpen}
          onOpenChange={setIsInspectorOpen}
          onUpdateNodeData={handleUpdateNodeData}
          availableTaskRefs={availableTaskRefs}
        />
      )}

      {/* Read-Only Mode Task Telemetry Inspector */}
      {isReadOnly && (
        <TaskTelemetryInspector
          nodeId={selectedNodeId}
          nodeData={selectedNode?.data || null}
          open={isTelemetryOpen}
          onOpenChange={setIsTelemetryOpen}
          executionId={executionId}
          onRerunTask={(taskRef, overrideInput) => {
            setNodes((nds) =>
              nds.map((n) =>
                n.data.taskReferenceName === taskRef
                  ? {
                      ...n,
                      data: {
                        ...n.data,
                        inputParameters: overrideInput,
                        executionState: 'IN_PROGRESS',
                        error: undefined,
                      },
                    }
                  : n
              )
            );
          }}
          logs={stream.logs}
        />
      )}

      {/* Read-Only Mode Time-Travel Replay & Back-Test Scrubber (Only in Graph view) */}
      {isReadOnly && activeViewTab === 'graph' && (
        <TimeTravelScrubber
          events={timelineEvents}
          currentIndex={currentScrubberIndex}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          isLiveHead={isLiveHead}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onStepForward={handleStepForward}
          onStepBackward={handleStepBackward}
          onSeek={handleSeek}
          onChangeSpeed={setPlaybackSpeed}
          onResumeLive={handleResumeLive}
          workflowStatus={stream.workflowStatus}
        />
      )}

      {/* Workflow IR Dialog (Export / Import - Full mode only) */}
      {!isReadOnly && (
        <WorkflowIrDialog
          open={isIrDialogOpen}
          onOpenChange={setIsIrDialogOpen}
          mode={irDialogMode}
          initialJson={irDialogContent}
          onImportJson={handleApplyImportedJson}
        />
      )}

      {/* Iteration 14: Designer Dry-Run Simulation Harness */}
      {!isReadOnly && (
        <WorkflowDryRunModal
          open={isDryRunOpen}
          onOpenChange={setIsDryRunOpen}
          workflowIR={exportToWorkflowIR(nodes, edges)}
          onSimulationSuccess={handleSimulationSuccess}
        />
      )}

      {/* Phase 39: Hot Migration Operator Modal */}
      {executionId && (
        <HotMigrationModal
          isOpen={isHotMigrationOpen}
          onClose={() => setIsHotMigrationOpen(false)}
          workflowKey={workflowKey || 'order-fulfillment-v1'}
          executionId={executionId}
          currentVersion={1}
          onMigrationSuccess={() => {
            setIsHotMigrationOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function VisualDagStudio(props: VisualDagStudioProps) {
  return (
    <ReactFlowProvider>
      <DagStudioCanvas {...props} />
    </ReactFlowProvider>
  );
}

export const ConductorWorkflowStudio = VisualDagStudio;
