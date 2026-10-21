import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExecutionState } from '@/features/workflows/components/studio';
import { useWorkflowExecutionStatus } from '../api/workflow-api';

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
    timestamp?: number;
    [key: string]: unknown;
  };
}

export interface WorkflowExecutionStreamState {
  nodeStates: Record<string, ExecutionState>;
  workflowStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TERMINATED';
  logs: Array<{
    id: string;
    time: string;
    level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
    message: string;
    raw?: unknown;
  }>;
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
}

export function useWorkflowExecutionStream(executionId: string | null) {
  const [streamState, setStreamState] = useState<WorkflowExecutionStreamState>({
    nodeStates: {},
    workflowStatus: 'PENDING',
    logs: [],
    isConnected: false,
    isStreaming: false,
    error: null,
  });

  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Polling query fallback
  const pollingQuery = useWorkflowExecutionStatus(executionId, usePollingFallback);

  const addLog = useCallback((level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR', message: string, raw?: unknown) => {
    const time = new Date().toLocaleTimeString();
    setStreamState((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          time,
          level,
          message,
          raw,
        },
      ],
    }));
  }, []);

  const handleTaskTransition = useCallback((taskRef: string, status: string, _output?: unknown, _error?: string) => {
    let executionState: ExecutionState = 'PENDING';
    if (status === 'IN_PROGRESS') executionState = 'IN_PROGRESS';
    else if (status === 'WAITING_FOR_APPROVAL') executionState = 'WAITING_FOR_APPROVAL';
    else if (status === 'COMPLETED') executionState = 'COMPLETED';
    else if (status === 'FAILED') executionState = 'FAILED';
    else if (status === 'TIMED_OUT') executionState = 'TIMED_OUT';

    setStreamState((prev) => ({
      ...prev,
      nodeStates: {
        ...prev.nodeStates,
        [taskRef]: executionState,
      },
    }));
  }, []);

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
        else mappedStates[ref] = 'PENDING';
      });
    }

    setStreamState((prev) => ({
      ...prev,
      nodeStates: { ...prev.nodeStates, ...mappedStates },
      workflowStatus: (snap.status as any) || 'RUNNING',
    }));
  }, [usePollingFallback, pollingQuery.data]);

  useEffect(() => {
    if (!executionId) {
      setStreamState({
        nodeStates: {},
        workflowStatus: 'PENDING',
        logs: [],
        isConnected: false,
        isStreaming: false,
        error: null,
      });
      setUsePollingFallback(false);
      return;
    }

    // Try EventSource connection
    let sseUrl = `/api/v1/workflow/executions/${executionId}/events`;
    let isCancelled = false;

    addLog('INFO', `Connecting real-time telemetry stream for ${executionId}...`);

    try {
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (isCancelled) return;
        setStreamState((prev) => ({
          ...prev,
          isConnected: true,
          isStreaming: true,
          error: null,
        }));
        addLog('SUCCESS', 'Real-time SSE telemetry channel established.');
      };

      const handleEvent = (event: MessageEvent, eventType: string) => {
        if (isCancelled) return;
        try {
          const payload = JSON.parse(event.data);
          addLog('INFO', `[${eventType}] ${payload.taskReferenceName || payload.workflowId || ''}`, payload);

          if (payload.taskReferenceName && payload.status) {
            handleTaskTransition(payload.taskReferenceName, payload.status, payload.output, payload.error);
          }

          if (eventType === 'WORKFLOW_COMPLETED') {
            setStreamState((prev) => ({ ...prev, workflowStatus: 'COMPLETED' }));
            addLog('SUCCESS', 'Workflow execution successfully completed!');
          } else if (eventType === 'WORKFLOW_FAILED' || eventType === 'WORKFLOW_TERMINATED') {
            setStreamState((prev) => ({ ...prev, workflowStatus: 'FAILED' }));
            addLog('ERROR', `Workflow failed/terminated: ${payload.reason || 'Unspecified error'}`);
          }
        } catch (e) {
          // ignore parsing error
        }
      };

      es.addEventListener('CONNECTED', (e) => handleEvent(e, 'CONNECTED'));
      es.addEventListener('TASK_IN_PROGRESS', (e) => handleEvent(e, 'TASK_IN_PROGRESS'));
      es.addEventListener('TASK_COMPLETED', (e) => handleEvent(e, 'TASK_COMPLETED'));
      es.addEventListener('TASK_FAILED', (e) => handleEvent(e, 'TASK_FAILED'));
      es.addEventListener('WORKFLOW_STARTED', (e) => handleEvent(e, 'WORKFLOW_STARTED'));
      es.addEventListener('WORKFLOW_COMPLETED', (e) => handleEvent(e, 'WORKFLOW_COMPLETED'));
      es.addEventListener('WORKFLOW_TERMINATED', (e) => handleEvent(e, 'WORKFLOW_TERMINATED'));

      es.onerror = (err) => {
        if (isCancelled) return;
        console.warn('SSE connection interrupted or not supported, switching to adaptive polling fallback:', err);
        addLog('WARN', 'SSE stream interrupted. Engaging adaptive polling fallback...');
        setUsePollingFallback(true);
        setStreamState((prev) => ({
          ...prev,
          isConnected: false,
          isStreaming: true,
          error: 'SSE disconnected; fallback active',
        }));
        es.close();
      };
    } catch (e: any) {
      console.warn('EventSource initialization failed, activating polling fallback:', e);
      addLog('WARN', 'Direct SSE initialization failed. Running via adaptive polling fallback.');
      setUsePollingFallback(true);
      setStreamState((prev) => ({
        ...prev,
        isConnected: false,
        isStreaming: true,
        error: e.message,
      }));
    }

    return () => {
      isCancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [executionId, addLog, handleTaskTransition]);

  return {
    ...streamState,
    usePollingFallback,
    snapshot: pollingQuery.data,
    refetchSnapshot: pollingQuery.refetch,
  };
}
