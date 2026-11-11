import { springApiClient } from '@/features/spring-auth';
import { type User, type UserStatus } from '../../data/schema';
import type { UserGatewayPort, RequestOptions, InviteUserPayload, CreateUserPayload } from '../../application/ports/user-gateway.port';

/**
 * Production HTTP Adapter implementing UserGatewayPort.
 * Conforms to WinterTC (ECMA-429) cancellation via AbortSignal.
 */
export class HttpUserGatewayAdapter implements UserGatewayPort {
  async listUsers(options?: RequestOptions): Promise<User[]> {
    const response = await springApiClient.get<User[]>('/api/users', {
      signal: options?.signal,
    });
    return response.data;
  }

  async createUser(user: CreateUserPayload, options?: RequestOptions): Promise<User> {
    const response = await springApiClient.post<User>('/api/users', user, {
      signal: options?.signal,
    });
    return response.data;
  }

  async updateUser(id: string, patch: Partial<User>, options?: RequestOptions): Promise<User> {
    const response = await springApiClient.patch<User>(`/api/users/${id}`, patch, {
      signal: options?.signal,
    });
    return response.data;
  }

  async deleteUser(userId: string, options?: RequestOptions): Promise<boolean> {
    const response = await springApiClient.delete<{ success: boolean }>(`/api/users/${userId}`, {
      signal: options?.signal,
    });
    return response.data?.success ?? true;
  }

  async bulkDeleteUsers(ids: string[], options?: RequestOptions): Promise<void> {
    await Promise.all(
      ids.map((id) =>
        springApiClient.delete(`/api/users/${id}`, {
          signal: options?.signal,
        })
      )
    );
  }

  async bulkUpdateStatus(ids: string[], status: UserStatus, options?: RequestOptions): Promise<void> {
    await Promise.all(
      ids.map((id) =>
        springApiClient.patch(`/api/users/${id}`, { status }, {
          signal: options?.signal,
        })
      )
    );
  }

  async inviteUser(payload: InviteUserPayload, options?: RequestOptions): Promise<User> {
    const newUser = {
      id: `usr-inv-${crypto.randomUUID()}`,
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
    const response = await springApiClient.post<User>('/api/users', newUser, {
      signal: options?.signal,
    });
    return response.data;
  }
}

export const userGateway = new HttpUserGatewayAdapter();
