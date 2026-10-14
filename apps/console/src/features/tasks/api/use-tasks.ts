import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth';
import { type Task } from '../data/schema';
import { toast } from 'sonner';

export const TASKS_QUERY_KEY = ['tasks'] as const;

export function useTasksQuery() {
  return useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: async (): Promise<Task[]> => {
      const response = await springApiClient.get<Task[]>('/api/tasks');
      return response.data;
    },
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      newTask: Partial<Task> & { title: string; status: Task['status']; label?: string; priority?: string }
    ): Promise<Task> => {
      const payload: Task = {
        id: newTask.id || `TASK-${Math.floor(1000 + Math.random() * 9000)}`,
        title: newTask.title,
        status: newTask.status,
        label: newTask.label || 'workflow',
        priority: newTask.priority || 'medium',
        taskType: newTask.taskType || 'MANUAL',
        attempt: newTask.attempt ?? 1,
        maxRetries: newTask.maxRetries ?? 3,
        pollDomain: newTask.pollDomain || 'default',
        workflowId: newTask.workflowId,
        workflowName: newTask.workflowName,
        taskReferenceName: newTask.taskReferenceName,
        leaseOwner: newTask.leaseOwner,
        durationMs: newTask.durationMs,
        inputData: newTask.inputData,
        outputData: newTask.outputData,
      };
      const response = await springApiClient.post<Task>('/api/tasks', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      toast.success('Task created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to create task');
    },
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Task>): Promise<Task> => {
      const response = await springApiClient.patch<Task>(`/api/tasks/${id}`, patch);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      toast.success('Task updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to update task');
    },
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      const response = await springApiClient.delete<{ success: boolean }>(`/api/tasks/${id}`);
      return response.data?.success ?? true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      toast.success('Task deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete task');
    },
  });
}

export function useBulkDeleteTasksMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]): Promise<void> => {
      await Promise.all(ids.map((id) => springApiClient.delete(`/api/tasks/${id}`)));
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      toast.success(`Deleted ${ids.length} task${ids.length > 1 ? 's' : ''}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to bulk delete tasks');
    },
  });
}

export function useBulkUpdateTasksStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }): Promise<void> => {
      await Promise.all(ids.map((id) => springApiClient.patch(`/api/tasks/${id}`, { status })));
    },
    onSuccess: (_, { ids, status }) => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      toast.success(`Updated status to "${status}" for ${ids.length} task${ids.length > 1 ? 's' : ''}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to bulk update tasks status');
    },
  });
}

export function useBulkUpdateTasksPriorityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, priority }: { ids: string[]; priority: string }): Promise<void> => {
      await Promise.all(ids.map((id) => springApiClient.patch(`/api/tasks/${id}`, { priority })));
    },
    onSuccess: (_, { ids, priority }) => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      toast.success(`Updated priority to "${priority}" for ${ids.length} task${ids.length > 1 ? 's' : ''}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to bulk update tasks priority');
    },
  });
}
