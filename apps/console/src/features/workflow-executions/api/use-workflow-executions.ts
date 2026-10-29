import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth';
import { type WorkflowExecution } from '../schema';
import { toast } from 'sonner';
import { type AxiosError } from 'axios';
import { getErrorMessage, type ApiErrorResponse } from '@/core/utils/error-extractor';

export const WORKFLOW_EXECUTIONS_QUERY_KEY = ['workflow-executions'] as const;

export function useWorkflowExecutionsQuery() {
  return useQuery<WorkflowExecution[], AxiosError<ApiErrorResponse>>({
    queryKey: WORKFLOW_EXECUTIONS_QUERY_KEY,
    queryFn: async (): Promise<WorkflowExecution[]> => {
      try {
        const response = await springApiClient.get<WorkflowExecution[]>('/v1/workflow/executions');
        const raw = response.data;
        if (Array.isArray(raw)) return raw;
        if (raw && Array.isArray((raw as any).content)) return (raw as any).content;
        return [];
      } catch (err) {
        console.warn('Failed to fetch workflow executions:', err);
        return [];
      }
    },
  });
}

export function useCreateWorkflowExecutionMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    WorkflowExecution,
    AxiosError<ApiErrorResponse>,
    Partial<WorkflowExecution> & { title: string; status: WorkflowExecution['status']; label?: string; priority?: string }
  >({
    mutationFn: async (
      newWorkflowExecution: Partial<WorkflowExecution> & { title: string; status: WorkflowExecution['status']; label?: string; priority?: string }
    ): Promise<WorkflowExecution> => {
      const payload: WorkflowExecution = {
        id: newWorkflowExecution.id || `TASK-${Math.floor(1000 + Math.random() * 9000)}`,
        title: newWorkflowExecution.title,
        status: newWorkflowExecution.status,
        label: newWorkflowExecution.label || 'workflow',
        priority: newWorkflowExecution.priority || 'medium',
        taskType: newWorkflowExecution.taskType || 'MANUAL',
        attempt: newWorkflowExecution.attempt ?? 1,
        maxRetries: newWorkflowExecution.maxRetries ?? 3,
        pollDomain: newWorkflowExecution.pollDomain || 'default',
        workflowId: newWorkflowExecution.workflowId,
        workflowName: newWorkflowExecution.workflowName,
        taskReferenceName: newWorkflowExecution.taskReferenceName,
        leaseOwner: newWorkflowExecution.leaseOwner,
        durationMs: newWorkflowExecution.durationMs,
        inputData: newWorkflowExecution.inputData,
        outputData: newWorkflowExecution.outputData,
      };
      const response = await springApiClient.post<WorkflowExecution>('/v1/workflow/executions', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_EXECUTIONS_QUERY_KEY });
      toast.success('Workflow execution created successfully');
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to create workflow execution'));
    },
  });
}

export function useUpdateWorkflowExecutionMutation() {
  const queryClient = useQueryClient();

  return useMutation<WorkflowExecution, AxiosError<ApiErrorResponse>, { id: string } & Partial<WorkflowExecution>>({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<WorkflowExecution>): Promise<WorkflowExecution> => {
      const response = await springApiClient.patch<WorkflowExecution>(`/v1/workflow/executions/${id}`, patch);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_EXECUTIONS_QUERY_KEY });
      toast.success('Workflow execution updated successfully');
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to update workflow execution'));
    },
  });
}

export function useDeleteWorkflowExecutionMutation() {
  const queryClient = useQueryClient();

  return useMutation<boolean, AxiosError<ApiErrorResponse>, string>({
    mutationFn: async (id: string): Promise<boolean> => {
      const response = await springApiClient.delete<{ success: boolean }>(`/v1/workflow/executions/${id}`);
      return response.data?.success ?? true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_EXECUTIONS_QUERY_KEY });
      toast.success('Workflow execution deleted successfully');
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to delete workflow execution'));
    },
  });
}

export function useBulkDeleteWorkflowExecutionsMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError<ApiErrorResponse>, string[]>({
    mutationFn: async (ids: string[]): Promise<void> => {
      await Promise.all(ids.map((id) => springApiClient.delete(`/v1/workflow/executions/${id}`)));
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_EXECUTIONS_QUERY_KEY });
      toast.success(`Deleted ${ids.length} workflow execution${ids.length > 1 ? 's' : ''}`);
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to bulk delete workflow executions'));
    },
  });
}

export function useBulkUpdateWorkflowExecutionsStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError<ApiErrorResponse>, { ids: string[]; status: string }>({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }): Promise<void> => {
      await Promise.all(ids.map((id) => springApiClient.patch(`/v1/workflow/executions/${id}`, { status })));
    },
    onSuccess: (_, { ids, status }) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_EXECUTIONS_QUERY_KEY });
      toast.success(`Updated status to "${status}" for ${ids.length} workflow execution${ids.length > 1 ? 's' : ''}`);
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to bulk update workflow execution status'));
    },
  });
}

export function useBulkUpdateWorkflowExecutionsPriorityMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError<ApiErrorResponse>, { ids: string[]; priority: string }>({
    mutationFn: async ({ ids, priority }: { ids: string[]; priority: string }): Promise<void> => {
      await Promise.all(ids.map((id) => springApiClient.patch(`/v1/workflow/executions/${id}`, { priority })));
    },
    onSuccess: (_, { ids, priority }) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_EXECUTIONS_QUERY_KEY });
      toast.success(`Updated priority to "${priority}" for ${ids.length} workflow execution${ids.length > 1 ? 's' : ''}`);
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to bulk update workflowExecutions priority'));
    },
  });
}
