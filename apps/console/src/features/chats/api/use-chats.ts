import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth';
import { type ChatUser } from '../data/chat-types';
import { toast } from 'sonner';

export const CHATS_QUERY_KEY = ['chats'] as const;

export function useChatsQuery() {
  return useQuery({
    queryKey: CHATS_QUERY_KEY,
    queryFn: async (): Promise<ChatUser[]> => {
      const response = await springApiClient.get<ChatUser[]>('/api/chats');
      return response.data;
    },
  });
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      convoId,
      message,
    }: {
      convoId: string;
      message: string;
    }): Promise<ChatUser> => {
      const response = await springApiClient.post<ChatUser>(`/api/chats/${convoId}`, {
        sender: 'You',
        message,
        timestamp: new Date().toISOString(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to send message');
    },
  });
}

export function useCreateConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newConvo: Partial<ChatUser>): Promise<ChatUser> => {
      const response = await springApiClient.post<ChatUser>('/api/chats', newConvo);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY });
      toast.success('Conversation created');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to create conversation');
    },
  });
}
