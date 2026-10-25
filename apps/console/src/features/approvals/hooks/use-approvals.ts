import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth/api-client';
import type { ApprovalTask, ApprovalDecisionRequest } from '@acc/client';

export const APPROVALS_QUERY_KEY = ['workflow-approvals'] as const;

export function useApprovalsQuery(refetchInterval: number = 8000) {
  return useQuery<ApprovalTask[]>({
    queryKey: APPROVALS_QUERY_KEY,
    queryFn: async () => {
      const res = await springApiClient.get<ApprovalTask[]>('/workflow/tasks/approvals');
      return res.data;
    },
    refetchInterval,
  });
}

export function useClaimApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId?: string }) => {
      const res = await springApiClient.post(`/workflow/tasks/${taskId}/claim`, { userId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}

export function useUnclaimApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await springApiClient.post(`/workflow/tasks/${taskId}/unclaim`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}

export function useResolveApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, payload }: { taskId: string; payload: ApprovalDecisionRequest }) => {
      const res = await springApiClient.post(`/workflow/tasks/${taskId}/resolve`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}
