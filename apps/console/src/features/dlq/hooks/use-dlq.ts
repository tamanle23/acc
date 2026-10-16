import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth/api-client';
import type { TaskDlqRecordDto } from '@unipost/client';

export const DLQ_QUERY_KEY = ['workflow-dlq'] as const;

export function useDlqQuery(status?: string, refetchInterval: number = 10000) {
  return useQuery<TaskDlqRecordDto[]>({
    queryKey: [...DLQ_QUERY_KEY, status],
    queryFn: async () => {
      const params = status ? { status } : {};
      const res = await springApiClient.get<TaskDlqRecordDto[]>('/workflow/dlq', { params });
      return res.data;
    },
    refetchInterval,
  });
}

export function useReplayDlqMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dlqId, payloadOverrides }: { dlqId: string; payloadOverrides?: Record<string, unknown> }) => {
      const res = await springApiClient.post<TaskDlqRecordDto>(`/workflow/dlq/${dlqId}/replay`, payloadOverrides || {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DLQ_QUERY_KEY });
    },
  });
}

export function useDiscardDlqMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dlqId: string) => {
      const res = await springApiClient.delete(`/workflow/dlq/${dlqId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DLQ_QUERY_KEY });
    },
  });
}
