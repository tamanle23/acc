import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type User, type UserStatus } from '../data/schema';
import { userGateway } from '../infrastructure/adapters/http-user-gateway.adapter';
import { toast } from 'sonner';

export const USERS_QUERY_KEY = ['users'] as const;

export function useUsersQuery() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async ({ signal }): Promise<User[]> => {
      return userGateway.listUsers({ signal });
    },
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUser: Partial<User> & { password?: string }): Promise<User> => {
      const payload = {
        ...newUser,
        id: newUser.id || `usr-${crypto.randomUUID()}`,
        firstName: newUser.firstName || '',
        lastName: newUser.lastName || '',
        username: newUser.username || '',
        email: newUser.email || '',
        phoneNumber: newUser.phoneNumber || '',
        status: newUser.status || 'active',
        role: newUser.role || 'manager',
        password: newUser.password,
        createdAt: newUser.createdAt || new Date(),
        updatedAt: newUser.updatedAt || new Date(),
      };
      return userGateway.createUser(payload);
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
      return userGateway.updateUser(id, patch);
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
      return userGateway.deleteUser(id);
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
      return userGateway.bulkDeleteUsers(ids);
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
      return userGateway.bulkUpdateStatus(ids, status);
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
      return userGateway.inviteUser(payload);
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
