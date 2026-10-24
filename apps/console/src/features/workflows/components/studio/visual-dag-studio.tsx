import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Subgroup imports
import {
  DagWorkflowNodeComponent,
  type DagNodeData,
  type DagNodeType,
  type ExecutionState,
} from './canvas/dag-node';
import { DagConditionEdge, type DagConditionEdgeData } from './canvas/dag-condition-edge';
import { DagCanvasEmptyState } from './canvas/dag-canvas-empty-state';
import { DagQuickInsertPopover } from './canvas/dag-quick-insert-popover';
import { DagSelectionToolbar } from './canvas/dag-selection-toolbar';

import { DagHeaderCommandBar } from './toolbar/dag-header-command-bar';
import { DagDebuggerSubpill } from './toolbar/dag-debugger-subpill';
import { DagValidationBanner } from './toolbar/dag-validation-banner';

import { DagPalette } from './palette/dag-palette';
import { DagPropertyInspector } from './inspectors/dag-property-inspector';
import { TaskTelemetryInspector } from './inspectors/task-telemetry-inspector';
import { TimeTravelScrubber } from './timeline/time-travel-scrubber';
import { WorkflowExecutionFlamegraph } from './timeline/workflow-execution-flamegraph';

import { DagEdgeConditionModal, type EdgeConditionModalData } from './modals/dag-edge-condition-modal';
import { WorkflowIrDialog } from './modals/workflow-ir-dialog';
import { WorkflowDryRunModal } from './modals/workflow-dry-run-modal';
import { WorkflowVariableWatchDrawer } from './modals/workflow-variable-watch-drawer';
import { HotMigrationModal } from '@/features/workflows/components/migration/hot-migration-modal';

import { useDagStudioState } from './hooks/use-dag-studio-state';
import { useDagExecutionSync } from './hooks/use-dag-execution-sync';
import { useDagFollowLive } from './hooks/use-dag-follow-live';
import {
  exportToWorkflowIR,
  importFromWorkflowIR,
  validateGraphTopology,
  type WorkflowIR,
} from './utils/workflow-ir-converter';
import {
  BLANK_WORKFLOW_NODES,
  BLANK_WORKFLOW_EDGES,
  INITIAL_NODES,
  INITIAL_EDGES,
} from './utils/dag-sample-data';

import { cn } from '@/lib/utils';
import {
  useWorkflowExecutionStream,
  type WorkflowStreamEvent,
} from '@/features/workflows/hooks/use-workflow-execution-stream';
import * as workflowApi from '@/features/workflows/api/workflow-api';
import {
  useSaveWorkflowDefinition,
  useWorkflowDefinition,
  useUpdateWorkflowBreakpoints,
  usePauseWorkflowExecution,
  useResumeWorkflowExecution,
  useStepOverWorkflowExecution,
} from '@/features/workflows/api/workflow-api';

// Export sample constants for backward-compatibility
export {
  BLANK_WORKFLOW_NODES,
  BLANK_WORKFLOW_EDGES,
  INITIAL_NODES,
  INITIAL_EDGES,
};

export interface VisualDagStudioProps {
  mode?: 'full' | 'readonly' | 'designer' | 'execution';
  workflowKey?: string;
  executionId?: string | null;
  initialEvents?: WorkflowStreamEvent[];
  initialNodes?: Node<DagNodeData>[];
  initialEdges?: Edge[];
  onCloseExecution?: () => void;
  onSaveSuccess?: () => void;
  className?: string;
}

const nodeTypes = {
  dagNode: DagWorkflowNodeComponent,
};

const edgeTypes = {
  dagEdge: DagConditionEdge,
};

function DagStudioCanvas({
  mode = 'full',
  workflowKey,
  executionId,
  initialEvents,
  initialNodes,
  initialEdges,
  onCloseExecution,
  onSaveSuccess,
  className,
}: VisualDagStudioProps) {
  const isReadOnly = mode === 'readonly' || mode === 'execution';
  const isExecutionMode = Boolean(isReadOnly && executionId);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const headerToolbarRef = useRef<HTMLDivElement>(null);
  const [headerToolbarHeight, setHeaderToolbarHeight] = useState<number>(44);
  const [containerHeight, setContainerHeight] = useState<number>(650);
  const [containerWidth, setContainerWidth] = useState<number>(1200);

  const { screenToFlowPosition } = useReactFlow();

  // Core DAG state management hook
  const {
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
  } = useDagStudioState({
    isReadOnly,
    initialNodes,
    initialEdges,
    screenToFlowPosition,
  });

  // UI Drawer & Modal display states
  const [showPalette, setShowPalette] = useState(!isReadOnly);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'graph' | 'timeline'>('graph');
  const [activeHoveredTaskRef, setActiveHoveredTaskRef] = useState<string | null>(null);
  const [isHotMigrationOpen, setIsHotMigrationOpen] = useState(false);
  const [diffTargetVersion, setDiffTargetVersion] = useState<number | null>(null);
  const [isIrDialogOpen, setIsIrDialogOpen] = useState(false);
  const [irDialogMode, setIrDialogMode] = useState<'export' | 'import'>('export');
  const [irDialogContent, setIrDialogContent] = useState('');
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);
  const [selectedEdgeData, setSelectedEdgeData] = useState<EdgeConditionModalData | null>(null);
  const [isEdgeConditionOpen, setIsEdgeConditionOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVariableWatchOpen, setIsVariableWatchOpen] = useState(false);
  const [breakpoints, setBreakpoints] = useState<string[]>([]);

  // Workflow API & Execution stream integrations
  const stream = useWorkflowExecutionStream(executionId || null);
  const versionsQuery = workflowApi.useWorkflowVersions
    ? workflowApi.useWorkflowVersions(workflowKey || null)
    : { data: [] };
  const workflowVersions = useMemo(() => versionsQuery?.data || [], [versionsQuery?.data]);
  const workflowDefQuery = useWorkflowDefinition(workflowKey || null);
  const saveWorkflowMutation = useSaveWorkflowDefinition();
  const updateBreakpointsMutation = useUpdateWorkflowBreakpoints();
  const pauseExecutionMutation = usePauseWorkflowExecution();
  const resumeExecutionMutation = useResumeWorkflowExecution();
  const stepOverExecutionMutation = useStepOverWorkflowExecution();

  // Execution sync & time travel hook
  const {
    timelineEvents,
    currentScrubberIndex,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    isLiveHead,
    handleSeek,
    handleStepForward,
    handleStepBackward,
    handleResumeLive,
  } = useDagExecutionSync({
    isReadOnly,
    executionId,
    initialEvents,
    stream,
    setNodes,
    diffTargetVersion,
    workflowVersions,
  });

  // Track container dimensions via ResizeObserver
  useEffect(() => {
    if (!reactFlowWrapper.current) return;
    const updateDimensions = () => {
      if (headerToolbarRef.current) {
        setHeaderToolbarHeight(headerToolbarRef.current.offsetHeight);
      }
      if (reactFlowWrapper.current) {
        setContainerHeight(reactFlowWrapper.current.offsetHeight);
        setContainerWidth(reactFlowWrapper.current.offsetWidth);
      }
    };
    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    if (headerToolbarRef.current) resizeObserver.observe(headerToolbarRef.current);
    if (reactFlowWrapper.current) resizeObserver.observe(reactFlowWrapper.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Load existing workflow definition from backend catalog
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
  }, [workflowDefQuery.data, setNodes, setEdges]);

  // Edge condition modal opening
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

  // Open telemetry inspector for a specific task node (used by hover popover CTA)
  const handleInspectTask = useCallback(
    (taskReferenceName: string) => {
      const node = nodes.find((n) => n.data.taskReferenceName === taskReferenceName);
      if (node) {
        setSelectedNodeId(node.id);
        setIsTelemetryOpen(true);
      }
    },
    [nodes, setSelectedNodeId]
  );

  // Follow-Live auto-pan (execution mode only)
  const { followLive, handleMoveStart, handleResumeFollow, handleToggleFollowLive } =
    useDagFollowLive({ nodes, isExecutionMode });

  // Debugger Execution Controls
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

  const handleSimulationSuccess = useCallback(
    (simResult: any) => {
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
    },
    [setNodes]
  );

  const availableTaskRefs = useMemo(
    () => nodes.map((n) => n.data.taskReferenceName),
    [nodes]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  // Decorate nodes with in/out degree flags and breakpoint bindings
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
          // Wire hover-popover "Inspect I/O & Logs" button to open telemetry drawer
          onInspectTask: isExecutionMode ? handleInspectTask : undefined,
        },
      };
    });
  }, [nodes, edges, breakpoints, handleToggleBreakpoint, handleInspectTask, isExecutionMode]);

  // Decorate edges with EdgeExecutionFlowState semantics.
  // DagConditionEdge reads data.executionFlowState and owns all execution-time styling —
  // we no longer set raw inline style overrides here (prevents double-styling conflicts).
  const decoratedEdges = useMemo(() => {
    if (!isExecutionMode) {
      return edges.map((e) => {
        const baseEdgeData = (e.data as object) || {};
        return {
          ...e,
          type: 'dagEdge',
          data: {
            ...baseEdgeData,
            routingMode: edgeRoutingMode,
            onEditEdge: isReadOnly ? undefined : handleOpenEdgeEditor,
            onSplitEdge: isReadOnly ? undefined : handleRequestSplitEdge,
          },
        };
      });
    }

    const nodeMap = new Map<string, Node<DagNodeData>>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    return edges.map((e) => {
      const baseEdgeData = (e.data as object) || {};

      const sourceNode = nodeMap.get(e.source);
      const targetNode = nodeMap.get(e.target);
      const sourceState = sourceNode?.data?.executionState;
      const targetState = targetNode?.data?.executionState;

      // Determine the semantic flow state for this edge
      const isSourceCompleted = sourceState === 'COMPLETED';
      const isSourceFailed =
        sourceState === 'FAILED' || sourceState === 'TIMED_OUT';
      const isTargetActive = targetState === 'IN_PROGRESS' || targetState === 'PAUSED_AT_BREAKPOINT';
      const isTargetDone = targetState === 'COMPLETED';
      const isTargetPending = targetState === 'PENDING' || targetState === 'SCHEDULED';
      const isTargetSkipped = targetState === 'SKIPPED';

      let executionFlowState: 'IDLE' | 'ACTIVE_FLOW' | 'COMPLETED_PATH' | 'BYPASSED_PATH' | 'FAILED_PATH' = 'IDLE';

      if (isSourceFailed) {
        executionFlowState = 'FAILED_PATH';
      } else if (isSourceCompleted && isTargetActive) {
        // Edge currently being traversed — glowing particle stream
        executionFlowState = 'ACTIVE_FLOW';
      } else if (isSourceCompleted && isTargetDone) {
        // Fully completed path
        executionFlowState = 'COMPLETED_PATH';
      } else if (isSourceCompleted && (isTargetPending || isTargetSkipped)) {
        // Source completed but target was not visited — bypassed branch
        executionFlowState = 'BYPASSED_PATH';
      }

      return {
        ...e,
        type: 'dagEdge',
        // Let DagConditionEdge own all visual styling — no inline style overrides
        style: e.style,
        className: e.className,
        animated: false,
        data: {
          ...baseEdgeData,
          routingMode: edgeRoutingMode,
          onEditEdge: isReadOnly ? undefined : handleOpenEdgeEditor,
          onSplitEdge: isReadOnly ? undefined : handleRequestSplitEdge,
          executionFlowState,
        },
      };
    });
  }, [edges, nodes, isExecutionMode, isReadOnly, edgeRoutingMode, handleOpenEdgeEditor, handleRequestSplitEdge]);

  // Aggregated Variable Watch state
  const variableWatchSnapshot = useMemo(() => {
    const taskOutputs: Record<string, unknown> = {};
    nodes.forEach((n) => {
      if (n.data.outputParameters && Object.keys(n.data.outputParameters).length > 0) {
        taskOutputs[n.data.taskReferenceName] = n.data.outputParameters;
      }
    });
    return {
      workflowStatus:
        stream.workflowStatus || (breakpoints.length > 0 ? 'PAUSED_AT_BREAKPOINT' : 'RUNNING'),
      breakpoints,
      workflowVariables: (stream.snapshot as any)?.variables || {
        orderId: 'ORD-2026-991',
        tier: 'EXPRESS',
      },
      taskOutputs,
    };
  }, [nodes, stream.workflowStatus, stream.snapshot, breakpoints]);

  return (
    <div
      ref={reactFlowWrapper}
      className={cn(
        'relative w-full rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-xl bg-card/60 transition-all duration-300',
        isFullscreen ? 'fixed inset-0 z-50 rounded-none w-screen h-screen border-none' : 'h-[650px]',
        className
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* 1. Floating Header Command Dock */}
      <DagHeaderCommandBar
        containerRef={headerToolbarRef}
        isReadOnly={isReadOnly}
        workflowKey={workflowKey}
        workflowVersions={workflowVersions}
        diffTargetVersion={diffTargetVersion}
        onDiffVersionChange={setDiffTargetVersion}
        isExecutionMode={isExecutionMode}
        executionId={executionId}
        connectionState={stream.connectionState}
        retryAttempt={stream.retryAttempt}
        nextRetryDelayMs={stream.nextRetryDelayMs}
        onOpenHotMigration={() => setIsHotMigrationOpen(true)}
        undoDisabled={undoStack.length === 0}
        redoDisabled={redoStack.length === 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAutoLayout={handleAutoLayout}
        isSnapToGrid={isSnapToGrid}
        onToggleSnapToGrid={() => setIsSnapToGrid((prev) => !prev)}
        edgeRoutingMode={edgeRoutingMode}
        onToggleEdgeRouting={() =>
          setEdgeRoutingMode((prev) => (prev === 'bezier' ? 'smoothstep' : 'bezier'))
        }
        activeViewTab={activeViewTab}
        onChangeViewTab={setActiveViewTab}
        showPalette={showPalette}
        onTogglePalette={() => setShowPalette((prev) => !prev)}
        onNewBlank={handleNewBlank}
        onValidateDag={handleValidateDag}
        validationErrorsCount={validationErrors.length}
        onDryRun={() => setIsDryRunOpen(true)}
        onExportJson={handleExportJson}
        onOpenImportDialog={handleOpenImportDialog}
        onResetInitial={handleResetInitial}
        onClearSelected={handleClearSelected}
        hasSelectedNodes={selectedNodes.length > 0}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        onSave={() => {
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
        isSaving={saveWorkflowMutation.isPending}
        onCloseExecution={onCloseExecution}
        followLive={followLive}
        onToggleFollowLive={handleToggleFollowLive}
      />

      {/* 2. Floating Debugger Sub-Pill */}
      {isExecutionMode && (
        <DagDebuggerSubpill
          top={12 + headerToolbarHeight + 8}
          breakpointsCount={breakpoints.length}
          onPause={handleDebuggerPause}
          onStepOver={handleDebuggerStepOver}
          onResume={handleDebuggerResume}
          isVariableWatchOpen={isVariableWatchOpen}
          onToggleVariableWatch={() => setIsVariableWatchOpen((prev) => !prev)}
        />
      )}

      {/* 3. Validation Banner */}
      {!isReadOnly && (
        <DagValidationBanner
          visible={validationBannerVisible}
          errors={validationErrors}
          onDismiss={() => setValidationBannerVisible(false)}
        />
      )}

      {/* 4. Floating Drag-and-Drop Task Palette */}
      {!isReadOnly && showPalette && (() => {
        const paletteTop = 12 + headerToolbarHeight + 8;
        const computedMaxHeight = Math.max(180, containerHeight - paletteTop - 180);
        return (
          <div
            className="absolute left-3 z-10 transition-all duration-150 ease-out"
            style={{ top: `${paletteTop}px` }}
          >
            <DagPalette
              defaultCollapsed={containerWidth < 900}
              style={{
                maxHeight: `${computedMaxHeight}px`,
              }}
            />
          </div>
        );
      })()}

      {/* 5. Blank Workflow Empty State Helper */}
      {isWorkflowBlank && (
        <DagCanvasEmptyState
          onInsertNode={handleInsertStarterTask}
          onOpenPalette={() => setShowPalette(true)}
          onDismiss={() => setIsDismissedEmptyState(true)}
        />
      )}

      {/* 6. Main Viewport: Concurrency Flamegraph or React Flow Canvas */}
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
          onNodeClick={(_: React.MouseEvent, node: Node) => {
            setSelectedNodeId(node.id);
            if (isReadOnly) {
              setIsTelemetryOpen(true);
            } else {
              setIsInspectorOpen(true);
            }
          }}
          onEdgeClick={(_: React.MouseEvent, edge: Edge) => {
            handleOpenEdgeEditor(edge.id);
          }}
          nodesDraggable={!isReadOnly}
          nodesConnectable={!isReadOnly}
          elementsSelectable={true}
          selectionOnDrag={!isReadOnly}
          selectionMode={SelectionMode?.Partial || ('partial' as SelectionMode)}
          panOnDrag={[1, 2]}
          snapToGrid={isSnapToGrid}
          snapGrid={[16, 16]}
          fitView
          onMoveStart={isExecutionMode ? handleMoveStart : undefined}
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
          {/* Resume Follow pill — appears when user has disabled follow-live in execution mode */}
          {isExecutionMode && !followLive && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
              <button
                type="button"
                onClick={handleResumeFollow}
                aria-label="Resume camera follow for active tasks"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 border border-white/30 dark:border-white/15 shadow-xl shadow-black/10 hover:bg-white/95 dark:hover:bg-slate-800/95 transition-all duration-150 text-foreground"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Resume Follow
              </button>
            </div>
          )}
        </ReactFlow>
      )}

      {/* 7. Multi-Node Selection & Alignment Floating Toolbar */}
      {!isReadOnly && selectedNodes.length >= 2 && (
        <DagSelectionToolbar
          selectedNodes={selectedNodes}
          onAlignLeft={handleAlignLeft}
          onAlignCenterX={handleAlignCenterX}
          onAlignTop={handleAlignTop}
          onAlignMiddleY={handleAlignMiddleY}
          onDistributeHorizontal={handleDistributeHorizontal}
          onDistributeVertical={handleDistributeVertical}
          onDuplicate={handleDuplicateSelected}
          onBulkDelete={handleBulkDelete}
        />
      )}

      {/* 8. Quick Insert Popover */}
      {!isReadOnly && edgeSplitTarget && (
        <DagQuickInsertPopover
          position={edgeSplitTarget.position}
          onSelectNodeType={(taskType: DagNodeType, defaultData?: Partial<DagNodeData>) => {
            handleSplitEdge(edgeSplitTarget.edgeId, taskType, defaultData);
            setEdgeSplitTarget(null);
          }}
          onSelect={(taskType: DagNodeType, label?: string, extraData?: Partial<DagNodeData>) => {
            handleSplitEdge(edgeSplitTarget.edgeId, taskType, { label, ...extraData });
            setEdgeSplitTarget(null);
          }}
          onClose={() => setEdgeSplitTarget(null)}
        />
      )}

      {/* 9. Full Mode Property Inspector Drawer */}
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

      {/* 10. Read-Only Task Telemetry Inspector Sheet */}
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

      {/* 11. Time-Travel History Scrubber */}
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

      {/* 12. Modals & Drawers */}
      {!isReadOnly && (
        <>
          <DagEdgeConditionModal
            open={isEdgeConditionOpen}
            onOpenChange={setIsEdgeConditionOpen}
            edgeData={selectedEdgeData}
            availableTaskRefs={availableTaskRefs}
            onSaveEdgeCondition={handleSaveEdgeCondition}
          />
          <WorkflowIrDialog
            open={isIrDialogOpen}
            onOpenChange={setIsIrDialogOpen}
            mode={irDialogMode}
            initialJson={irDialogContent}
            onImportJson={handleApplyImportedJson}
          />
          <WorkflowDryRunModal
            open={isDryRunOpen}
            onOpenChange={setIsDryRunOpen}
            workflowIR={exportToWorkflowIR(nodes, edges)}
            onSimulationSuccess={handleSimulationSuccess}
          />
        </>
      )}

      {isExecutionMode && (
        <WorkflowVariableWatchDrawer
          open={isVariableWatchOpen}
          onOpenChange={setIsVariableWatchOpen}
          executionId={executionId}
          workflowStatus={
            stream.workflowStatus ||
            (breakpoints.length > 0 ? 'PAUSED_AT_BREAKPOINT' : 'RUNNING')
          }
          pausedAtNode={(stream.snapshot?.outputPayload?.pausedAtNode as string) || null}
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

      {executionId && (
        <HotMigrationModal
          isOpen={isHotMigrationOpen}
          onClose={() => setIsHotMigrationOpen(false)}
          workflowKey={workflowKey || 'order-fulfillment-v1'}
          executionId={executionId}
          currentVersion={1}
          onMigrationSuccess={() => setIsHotMigrationOpen(false)}
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
