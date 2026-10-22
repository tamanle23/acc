import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExecutionState } from '@/features/workflows/components/studio';
import { useWorkflowExecutionStatus } from '../api/workflow-api';

export type SseConnectionState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LIVE'
  | 'RECONNECTING'
  | 'POLLING_FALLBACK'
  | 'DISCONNECTED';

export interface WorkflowStreamLogItem {
  id: string;
  time: string;
  timestamp: number;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  message: string;
  workerId?: string;
  taskReferenceName?: string;
  taskId?: string;
  raw?: unknown;
}

export interface WorkflowStreamEvent {
  event: string;
  data: {
    workflowId?: string;
    executionId?: string;
    taskId?: string;
    taskReferenceName?: string;
    taskType?: string;
    status?: string;
    output?: Record<string, unknown>;
    error?: string;
    reason?: string;
    level?: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
    message?: string;
    workerId?: string;
    raw?: unknown;
    timestamp?: number;
    ping?: boolean;
    [key: string]: unknown;
  };
}

export interface WorkflowExecutionStreamState {
  nodeStates: Record<string, ExecutionState>;
  workflowStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TERMINATED';
  logs: WorkflowStreamLogItem[];
  connectionState: SseConnectionState;
  isConnected: boolean;
  isStreaming: boolean;
  retryAttempt: number;
  nextRetryDelayMs: number | null;
  lastHeartbeatTimestamp: number | null;
  error: string | null;
}

const MAX_LOG_BUFFER_SIZE = 1000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 16000;
const MAX_RETRY_ATTEMPTS = 5;

export function useWorkflowExecutionStream(executionId: string | null) {
  const [streamState, setStreamState] = useState<WorkflowExecutionStreamState>({
    nodeStates: {},
    workflowStatus: 'PENDING',
    logs: [],
    connectionState: executionId ? 'CONNECTING' : 'IDLE',
    isConnected: false,
    isStreaming: false,
    retryAttempt: 0,
    nextRetryDelayMs: null,
    lastHeartbeatTimestamp: null,
    error: null,
  });

  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafBatchRef = useRef<number | null>(null);
  const pendingUpdatesRef = useRef<{
    nodeStates: Record<string, ExecutionState>;
    logs: WorkflowStreamLogItem[];
    workflowStatus?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TERMINATED';
  }>({
    nodeStates: {},
    logs: [],
  });

  const executionIdRef = useRef(executionId);
  executionIdRef.current = executionId;

  // Polling query fallback
  const pollingQuery = useWorkflowExecutionStatus(executionId, usePollingFallback);

  // Flushes batched state updates inside a requestAnimationFrame window to prevent UI thrashing
  const flushBatch = useCallback(() => {
    if (rafBatchRef.current) {
      cancelAnimationFrame(rafBatchRef.current);
      rafBatchRef.current = null;
    }

    const { nodeStates, logs, workflowStatus } = pendingUpdatesRef.current;
    const hasNodeUpdates = Object.keys(nodeStates).length > 0;
    const hasLogUpdates = logs.length > 0;
    const hasStatusUpdate = Boolean(workflowStatus);

    if (!hasNodeUpdates && !hasLogUpdates && !hasStatusUpdate) return;

    // Reset pending batch buffers immediately
    pendingUpdatesRef.current = { nodeStates: {}, logs: [] };

    setStreamState((prev) => {
      let nextLogs = prev.logs;
      if (hasLogUpdates) {
        // Enforce FIFO ring buffer cap
        nextLogs = [...prev.logs, ...logs];
        if (nextLogs.length > MAX_LOG_BUFFER_SIZE) {
          nextLogs = nextLogs.slice(nextLogs.length - MAX_LOG_BUFFER_SIZE);
        }
        // Asynchronously spool to sessionStorage to maintain history without blocking main thread
        try {
          if (typeof window !== 'undefined' && window.sessionStorage && executionIdRef.current) {
            const key = `wf_exec_logs_${executionIdRef.current}`;
            window.sessionStorage.setItem(key, JSON.stringify(nextLogs.slice(-200)));
          }
        } catch {
          // ignore storage quota issues
        }
      }

      return {
        ...prev,
        nodeStates: hasNodeUpdates ? { ...prev.nodeStates, ...nodeStates } : prev.nodeStates,
        logs: nextLogs,
        workflowStatus: workflowStatus || prev.workflowStatus,
      };
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      flushBatch();
      return;
    }
    if (!rafBatchRef.current) {
      rafBatchRef.current = requestAnimationFrame(() => {
        rafBatchRef.current = null;
        flushBatch();
      });
    }
  }, [flushBatch]);

  const addLog = useCallback(
    (
      level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR',
      message: string,
      meta?: {
        raw?: unknown;
        workerId?: string;
        taskReferenceName?: string;
        taskId?: string;
        timestamp?: number;
      }
    ) => {
      const now = meta?.timestamp || Date.now();
      const time = new Date(now).toLocaleTimeString();
      const newLog: WorkflowStreamLogItem = {
        id: `log_${now}_${Math.random().toString(36).substring(2, 7)}`,
        time,
        timestamp: now,
        level,
        message,
        workerId: meta?.workerId,
        taskReferenceName: meta?.taskReferenceName,
        taskId: meta?.taskId,
        raw: meta?.raw,
      };

      pendingUpdatesRef.current.logs.push(newLog);
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const handleTaskTransition = useCallback(
    (taskRef: string, status: string, _output?: unknown, _error?: string) => {
      let executionState: ExecutionState = 'PENDING';
      if (status === 'IN_PROGRESS') executionState = 'IN_PROGRESS';
      else if (status === 'WAITING_FOR_APPROVAL') executionState = 'WAITING_FOR_APPROVAL';
      else if (status === 'COMPLETED') executionState = 'COMPLETED';
      else if (status === 'FAILED') executionState = 'FAILED';
      else if (status === 'TIMED_OUT') executionState = 'TIMED_OUT';
      else if (status === 'SKIPPED') executionState = 'SKIPPED';
      else if (status === 'PAUSED_AT_BREAKPOINT') executionState = 'PAUSED_AT_BREAKPOINT';

      pendingUpdatesRef.current.nodeStates[taskRef] = executionState;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  // Sync polling query data into stream state if fallback is active
  useEffect(() => {
    if (!usePollingFallback || !pollingQuery.data) return;
    const snap = pollingQuery.data;

    const mappedStates: Record<string, ExecutionState> = {};
    if (snap.tasksByRef) {
      Object.entries(snap.tasksByRef).forEach(([ref, t]) => {
        if (t.status === 'IN_PROGRESS') mappedStates[ref] = 'IN_PROGRESS';
        else if (t.status === 'WAITING_FOR_APPROVAL') mappedStates[ref] = 'WAITING_FOR_APPROVAL';
        else if (t.status === 'COMPLETED') mappedStates[ref] = 'COMPLETED';
        else if (t.status === 'FAILED') mappedStates[ref] = 'FAILED';
        else if (t.status === 'TIMED_OUT') mappedStates[ref] = 'TIMED_OUT';
        else mappedStates[ref] = 'PENDING';
      });
    }

    setStreamState((prev) => ({
      ...prev,
      nodeStates: { ...prev.nodeStates, ...mappedStates },
      workflowStatus: (snap.status as any) || prev.workflowStatus,
    }));
  }, [usePollingFallback, pollingQuery.data]);

  useEffect(() => {
    if (!executionId) {
      setStreamState({
        nodeStates: {},
        workflowStatus: 'PENDING',
        logs: [],
        connectionState: 'IDLE',
        isConnected: false,
        isStreaming: false,
        retryAttempt: 0,
        nextRetryDelayMs: null,
        lastHeartbeatTimestamp: null,
        error: null,
      });
      setUsePollingFallback(false);
      return;
    }

    let isCancelled = false;
    let attempt = 0;

    const connectSse = () => {
      if (isCancelled) return;

      const sseUrl = `/api/v1/workflow/executions/${executionId}/events`;

      setStreamState((prev) => ({
        ...prev,
        connectionState: attempt > 0 ? 'RECONNECTING' : 'CONNECTING',
        isStreaming: true,
      }));

      addLog(
        'INFO',
        attempt > 0
          ? `Attempting reconnection (${attempt}/${MAX_RETRY_ATTEMPTS}) for ${executionId}...`
          : `Connecting real-time telemetry stream for ${executionId}...`
      );

      try {
        if (typeof EventSource === 'undefined') {
          throw new Error('EventSource is not supported');
        }

        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (isCancelled) return;
          attempt = 0;
          setStreamState((prev) => ({
            ...prev,
            connectionState: 'LIVE',
            isConnected: true,
            isStreaming: true,
            retryAttempt: 0,
            nextRetryDelayMs: null,
            error: null,
          }));
          addLog('SUCCESS', 'Real-time SSE telemetry channel established.');
        };

        const handleEvent = (event: MessageEvent, eventType: string) => {
          if (isCancelled) return;
          try {
            const payload = JSON.parse(event.data);

            if (eventType === 'HEARTBEAT') {
              setStreamState((prev) => ({
                ...prev,
                lastHeartbeatTimestamp: payload.timestamp || Date.now(),
              }));
              return;
            }

            if (eventType === 'TASK_LOG') {
              addLog(payload.level || 'INFO', payload.message || '', {
                workerId: payload.workerId,
                taskReferenceName: payload.taskReferenceName,
                taskId: payload.taskId,
                raw: payload.raw,
                timestamp: payload.timestamp,
              });
              return;
            }

            addLog('INFO', `[${eventType}] ${payload.taskReferenceName || payload.workflowId || ''}`, {
              raw: payload,
              taskReferenceName: payload.taskReferenceName,
              taskId: payload.taskId,
              timestamp: payload.timestamp,
            });

            if (payload.taskReferenceName && payload.status) {
              handleTaskTransition(payload.taskReferenceName, payload.status, payload.output, payload.error);
            }

            if (eventType === 'WORKFLOW_COMPLETED') {
              pendingUpdatesRef.current.workflowStatus = 'COMPLETED';
              scheduleFlush();
              addLog('SUCCESS', 'Workflow execution successfully completed!');
            } else if (eventType === 'WORKFLOW_FAILED' || eventType === 'WORKFLOW_TERMINATED') {
              pendingUpdatesRef.current.workflowStatus = 'FAILED';
              scheduleFlush();
              addLog('ERROR', `Workflow terminated/failed: ${payload.reason || 'Unspecified error'}`);
            }
          } catch {
            // ignore parsing error
          }
        };

        es.addEventListener('CONNECTED', (e) => handleEvent(e, 'CONNECTED'));
        es.addEventListener('HEARTBEAT', (e) => handleEvent(e, 'HEARTBEAT'));
        es.addEventListener('TASK_IN_PROGRESS', (e) => handleEvent(e, 'TASK_IN_PROGRESS'));
        es.addEventListener('TASK_LOG', (e) => handleEvent(e, 'TASK_LOG'));
        es.addEventListener('TASK_COMPLETED', (e) => handleEvent(e, 'TASK_COMPLETED'));
        es.addEventListener('TASK_FAILED', (e) => handleEvent(e, 'TASK_FAILED'));
        es.addEventListener('WORKFLOW_STARTED', (e) => handleEvent(e, 'WORKFLOW_STARTED'));
        es.addEventListener('WORKFLOW_PAUSED', (e) => handleEvent(e, 'WORKFLOW_PAUSED'));
        es.addEventListener('WORKFLOW_RESUMED', (e) => handleEvent(e, 'WORKFLOW_RESUMED'));
        es.addEventListener('WORKFLOW_COMPLETED', (e) => handleEvent(e, 'WORKFLOW_COMPLETED'));
        es.addEventListener('WORKFLOW_TERMINATED', (e) => handleEvent(e, 'WORKFLOW_TERMINATED'));

        es.onerror = (err) => {
          if (isCancelled) return;
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          if (attempt < MAX_RETRY_ATTEMPTS) {
            attempt += 1;
            const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);

            setStreamState((prev) => ({
              ...prev,
              connectionState: 'RECONNECTING',
              isConnected: false,
              retryAttempt: attempt,
              nextRetryDelayMs: delay,
              error: `SSE interrupted; retrying in ${Math.round(delay / 1000)}s`,
            }));

            addLog('WARN', `SSE connection dropped. Retrying in ${Math.round(delay / 1000)}s (Attempt ${attempt}/${MAX_RETRY_ATTEMPTS})...`);

            reconnectTimeoutRef.current = setTimeout(() => {
              connectSse();
            }, delay);
          } else {
            console.warn('SSE max retry attempts reached, falling back to adaptive polling:', err);
            addLog('WARN', 'SSE maximum retry threshold reached. Engaging adaptive polling fallback.');
            setUsePollingFallback(true);
            setStreamState((prev) => ({
              ...prev,
              connectionState: 'POLLING_FALLBACK',
              isConnected: false,
              isStreaming: true,
              retryAttempt: attempt,
              nextRetryDelayMs: null,
              error: 'SSE disconnected; adaptive polling active',
            }));
          }
        };
      } catch (e: any) {
        console.warn('EventSource initialization failed, activating polling fallback:', e);
        addLog('WARN', 'Direct SSE initialization unavailable. Running via adaptive polling fallback.');
        setUsePollingFallback(true);
        setStreamState((prev) => ({
          ...prev,
          connectionState: 'POLLING_FALLBACK',
          isConnected: false,
          isStreaming: true,
          retryAttempt: 0,
          nextRetryDelayMs: null,
          error: e.message,
        }));
      }
    };

    connectSse();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (rafBatchRef.current) {
        cancelAnimationFrame(rafBatchRef.current);
        rafBatchRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [executionId, addLog, handleTaskTransition, scheduleFlush]);

  return {
    ...streamState,
    usePollingFallback,
    snapshot: pollingQuery.data,
    refetchSnapshot: pollingQuery.refetch,
  };
}

