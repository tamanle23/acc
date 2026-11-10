import { type User, type UserStatus } from '../../data/schema';

export interface RequestOptions {
  signal?: AbortSignal; // WinterTC ECMA-429 standard cancellation
}

export interface InviteUserPayload {
  email: string;
  role: string;
  desc?: string;
}

export type CreateUserPayload = Partial<Omit<User, 'createdAt' | 'updatedAt'>> & {
  password?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

/**
 * Driven Gateway Port (SPI) for User management in Console.
 * Decoupled from transport libraries and frameworks.
 */
export interface UserGatewayPort {
  listUsers(options?: RequestOptions): Promise<User[]>;
  createUser(user: CreateUserPayload, options?: RequestOptions): Promise<User>;
  updateUser(id: string, patch: Partial<User>, options?: RequestOptions): Promise<User>;
  deleteUser(userId: string, options?: RequestOptions): Promise<boolean>;
  bulkDeleteUsers(ids: string[], options?: RequestOptions): Promise<void>;
  bulkUpdateStatus(ids: string[], status: UserStatus, options?: RequestOptions): Promise<void>;
  inviteUser(payload: InviteUserPayload, options?: RequestOptions): Promise<User>;
}
