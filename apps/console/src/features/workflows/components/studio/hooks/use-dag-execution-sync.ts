import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import type { DagNodeData, ExecutionState } from '../canvas/dag-node';
import type {
  WorkflowStreamEvent,
  WorkflowStreamLogItem,
} from '@/features/workflows/hooks/use-workflow-execution-stream';

export interface UseDagExecutionSyncOptions {
  isReadOnly?: boolean;
  executionId?: string | null;
  initialEvents?: WorkflowStreamEvent[];
  stream: {
    nodeStates?: Record<string, ExecutionState>;
    snapshot?: any;
    workflowStatus?: string;
    logs?: WorkflowStreamLogItem[];
  };
  setNodes: React.Dispatch<React.SetStateAction<Node<DagNodeData>[]>>;
  diffTargetVersion: number | null;
  workflowVersions: Array<{ version: number; status: string; definition?: unknown }>;
}

export function useDagExecutionSync({
  isReadOnly,
  initialEvents,
  stream,
  setNodes,
  diffTargetVersion,
  workflowVersions,
}: UseDagExecutionSyncOptions) {
  const [timelineEvents, setTimelineEvents] = useState<WorkflowStreamEvent[]>(initialEvents || []);
  const [currentScrubberIndex, setCurrentScrubberIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLiveHead, setIsLiveHead] = useState(true);

  // Historical reconstructed state at step tk
  const [replayedVariables, setReplayedVariables] = useState<Record<string, unknown> | null>(null);

  // Seed events from snapshot or logs if timelineEvents is empty
  useEffect(() => {
    if (timelineEvents.length === 0 && stream.snapshot?.tasksByRef) {
      const syntheticEvents: WorkflowStreamEvent[] = [];
      Object.entries(stream.snapshot.tasksByRef).forEach(([ref, t]: [string, any], idx) => {
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
    if (isReadOnly && isLiveHead && stream.nodeStates && Object.keys(stream.nodeStates).length > 0) {
      setNodes((nds) => {
        let hasChanges = false;
        const updated = nds.map((n) => {
          const taskRef = n.data.taskReferenceName;
          const liveState = stream.nodeStates?.[taskRef];
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
  }, [isReadOnly, isLiveHead, stream.nodeStates, setNodes]);

  // Compute visual graph diff overlay when comparison target is selected
  useEffect(() => {
    if (!diffTargetVersion) {
      setNodes((nds) => {
        if (!nds.some((n) => n.data.diffStatus !== undefined)) return nds;
        return nds.map((n) =>
          n.data.diffStatus ? { ...n, data: { ...n.data, diffStatus: undefined } } : n
        );
      });
      return;
    }

    const targetVer = workflowVersions.find((v) => v.version === diffTargetVersion);
    if (!targetVer || !targetVer.definition) return;

    const targetTasks = ((targetVer.definition as any).tasks || []) as Array<{
      taskReferenceName: string;
      taskType: string;
    }>;
    const targetRefMap = new Map(targetTasks.map((t) => [t.taskReferenceName, t]));

    setNodes((nds) => {
      const currentRefMap = new Map(nds.map((n) => [n.data.taskReferenceName, n]));

      // 1. Tag existing nodes
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
  }, [diffTargetVersion, workflowVersions, setNodes]);

  // Apply node states and reconstruct variables based on timeline scrubber position
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

      const cumulativeVars: Record<string, unknown> = {
        ...(stream.snapshot?.variables || stream.snapshot?.input || {}),
      };

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

          // Accumulate output into historical variables snapshot
          if (ev.data.output && typeof ev.data.output === 'object') {
            cumulativeVars[ref] = ev.data.output;
            Object.assign(cumulativeVars, ev.data.output);
          }
        }
      }

      setReplayedVariables(cumulativeVars);

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
    [timelineEvents, setNodes, stream.snapshot]
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

  // Time-travel handler callbacks
  const handleSeek = useCallback(
    (index: number) => {
      const isHead = index >= timelineEvents.length - 1;
      setIsLiveHead(isHead);
      setIsPlaying(false);
      setCurrentScrubberIndex(index);
      applyEventsUpToIndex(index);
    },
    [applyEventsUpToIndex, timelineEvents.length]
  );

  const handleStepForward = useCallback(() => {
    if (currentScrubberIndex < timelineEvents.length - 1) {
      handleSeek(currentScrubberIndex + 1);
    }
  }, [currentScrubberIndex, timelineEvents.length, handleSeek]);

  const handleStepBackward = useCallback(() => {
    if (currentScrubberIndex > 0) {
      handleSeek(currentScrubberIndex - 1);
    }
  }, [currentScrubberIndex, handleSeek]);

  const handleResumeLive = useCallback(() => {
    setIsLiveHead(true);
    setIsPlaying(false);
    setReplayedVariables(null);
    if (timelineEvents.length > 0) {
      const lastIdx = timelineEvents.length - 1;
      setCurrentScrubberIndex(lastIdx);
      applyEventsUpToIndex(lastIdx);
    }
  }, [timelineEvents.length, applyEventsUpToIndex]);

  // Replay timestamp at current scrubber position
  const currentStepTimestamp = useMemo(() => {
    if (timelineEvents.length === 0) return null;
    const ev = timelineEvents[currentScrubberIndex];
    return (ev?.data?.timestamp as number) || null;
  }, [timelineEvents, currentScrubberIndex]);

  // Filtered telemetry logs according to current historical time window
  const historicalLogs = useMemo(() => {
    if (isLiveHead || !currentStepTimestamp || !stream.logs) {
      return stream.logs || [];
    }
    return stream.logs.filter((log) => log.timestamp <= currentStepTimestamp);
  }, [isLiveHead, currentStepTimestamp, stream.logs]);

  return {
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
    replayedVariables,
    currentStepTimestamp,
    historicalLogs,
  };
}
