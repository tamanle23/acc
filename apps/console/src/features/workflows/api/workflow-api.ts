import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth/api-client';
import type { WorkflowIR } from '@/features/metadata/components/studio/workflow-ir-converter';
import type { WorkflowDefinitionSummary, WorkflowExecutionSnapshot } from '@unipost/client';
import { toast } from 'sonner';

export type { WorkflowDefinitionSummary, WorkflowExecutionSnapshot };

// 1. Fetch Workflow Definitions
export const useWorkflowDefinitions = () => {
  return useQuery({
    queryKey: ['workflows', 'definitions'],
    queryFn: async (): Promise<WorkflowDefinitionSummary[]> => {
      try {
        const res = await springApiClient.get('/v1/workflow/definitions');
        if (res.status === 200) {
          const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
          return list;
        }
        return [];
      } catch (err) {
        console.warn('Failed to fetch workflow definitions from backend:', err);
        return [];
      }
    },
    staleTime: 60 * 1000,
  });
};

// 2. Fetch Single Workflow Definition by Key
export const useWorkflowDefinition = (workflowKey: string | null) => {
  return useQuery({
    queryKey: ['workflows', 'definition', workflowKey],
    queryFn: async (): Promise<WorkflowDefinitionSummary | null> => {
      if (!workflowKey) return null;
      try {
        const res = await springApiClient.get(`/v1/workflow/definitions/${workflowKey}`);
        if (res.status === 200) {
          return res.data;
        }
        return null;
      } catch (err) {
        console.warn(`Failed to fetch workflow definition ${workflowKey}:`, err);
        return null;
      }
    },
    enabled: Boolean(workflowKey),
  });
};

// 3. Save / Upsert Workflow Definition
export const useSaveWorkflowDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ir: WorkflowIR) => {
      const res = await springApiClient.post('/v1/workflow/definitions', ir);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Workflow "${data.name || data.workflowKey}" saved successfully`);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
      if (data.workflowKey) {
        queryClient.invalidateQueries({ queryKey: ['workflows', 'definition', data.workflowKey] });
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || 'Failed to save workflow definition';
      toast.error(msg);
    },
  });
};

// 4. Toggle Workflow Definition Status
export const useToggleWorkflowStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowKey, status }: { workflowKey: string; status: 'ACTIVE' | 'DISABLED' }) => {
      const res = await springApiClient.put(`/v1/workflow/definitions/${workflowKey}`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Workflow status updated');
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to toggle status');
    },
  });
};

// 5. Delete Workflow Definition
export const useDeleteWorkflowDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workflowKey: string) => {
      const res = await springApiClient.delete(`/v1/workflow/definitions/${workflowKey}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Workflow definition deleted');
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete definition');
    },
  });
};

// 6. Start Live Workflow Execution
export const useStartWorkflowExecution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowKey, input }: { workflowKey: string; input?: Record<string, unknown> }) => {
      const res = await springApiClient.post('/v1/workflow/executions', {
        workflowKey,
        input: input || {},
      });
      return res.data as WorkflowExecutionSnapshot;
    },
    onSuccess: (data) => {
      toast.success(`Workflow execution started (${data.workflowId})`);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to start execution');
    },
  });
};

// 7. Execution Status Polling
export const useWorkflowExecutionStatus = (executionId: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['workflows', 'execution', executionId],
    queryFn: async (): Promise<WorkflowExecutionSnapshot | null> => {
      if (!executionId) return null;
      const res = await springApiClient.get(`/v1/workflow/executions/${executionId}`);
      return res.data;
    },
    enabled: Boolean(executionId) && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (['COMPLETED', 'FAILED', 'TERMINATED', 'TIMED_OUT'].includes(data.status)) {
        return false;
      }
      return 1500;
    },
  });
};
