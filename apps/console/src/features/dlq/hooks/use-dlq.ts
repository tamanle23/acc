import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth/api-client';
import type { TaskDlqRecordDto } from '@unipost/client';

export const DLQ_QUERY_KEY = ['system-dlq'] as const;

export function useDlqQuery(status?: string, tenantId?: string, refetchInterval: number = 10000) {
  return useQuery<TaskDlqRecordDto[]>({
    queryKey: [...DLQ_QUERY_KEY, status, tenantId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (tenantId && tenantId !== 'ALL') params.tenantId = tenantId;
      const res = await springApiClient.get<TaskDlqRecordDto[]>('/system/dlq', { params });
      return res.data;
    },
    refetchInterval,
  });
}

export function useReplayDlqMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dlqId, payloadOverrides }: { dlqId: string; payloadOverrides?: Record<string, unknown> }) => {
      const res = await springApiClient.post<TaskDlqRecordDto>(`/system/dlq/${dlqId}/replay`, payloadOverrides || {});
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
      const res = await springApiClient.delete(`/system/dlq/${dlqId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DLQ_QUERY_KEY });
    },
  });
}
