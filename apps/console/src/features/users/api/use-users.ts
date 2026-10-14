import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth';
import { type User, type UserStatus } from '../data/schema';
import { toast } from 'sonner';

export const USERS_QUERY_KEY = ['users'] as const;

export function useUsersQuery() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async (): Promise<User[]> => {
      const response = await springApiClient.get<User[]>('/api/users');
      return response.data;
    },
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUser: Partial<User> & { password?: string }): Promise<User> => {
      const payload = {
        id: newUser.id || `usr-${Math.random().toString(36).substring(2, 9)}`,
        firstName: newUser.firstName || '',
        lastName: newUser.lastName || '',
        username: newUser.username || '',
        email: newUser.email || '',
        phoneNumber: newUser.phoneNumber || '',
        status: newUser.status || 'active',
        role: newUser.role || 'manager',
        password: newUser.password,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const response = await springApiClient.post<User>('/api/users', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success('User created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to create user');
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<User>): Promise<User> => {
      const response = await springApiClient.patch<User>(`/api/users/${id}`, patch);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success('User updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to update user');
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      const response = await springApiClient.delete<{ success: boolean }>(`/api/users/${id}`);
      return response.data?.success ?? true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success('User deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete user');
    },
  });
}

export function useBulkDeleteUsersMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]): Promise<void> => {
      await Promise.all(ids.map((id) => springApiClient.delete(`/api/users/${id}`)));
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success(`Deleted ${ids.length} user${ids.length > 1 ? 's' : ''}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to bulk delete users');
    },
  });
}

export function useBulkUpdateUsersStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: UserStatus }): Promise<void> => {
      await Promise.all(ids.map((id) => springApiClient.patch(`/api/users/${id}`, { status })));
    },
    onSuccess: (_, { ids, status }) => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success(`Status updated to "${status}" for ${ids.length} user${ids.length > 1 ? 's' : ''}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to update users status');
    },
  });
}

export function useInviteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { email: string; role: string; desc?: string }): Promise<User> => {
      const newUser = {
        id: `usr-inv-${Math.random().toString(36).substring(2, 8)}`,
        firstName: 'Invited',
        lastName: 'Member',
        username: payload.email.split('@')[0],
        email: payload.email,
        phoneNumber: '',
        status: 'invited' as UserStatus,
        role: payload.role as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const response = await springApiClient.post<User>('/api/users', newUser);
      return response.data;
    },
    onSuccess: (_, { email }) => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success(`Invitation dispatched to ${email}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to invite user');
    },
  });
}
