import type { AuthenticationProfile, LoginResponse, TokenRefreshResponse as RefreshResponse } from '@acc/client';

export type { AuthenticationProfile, LoginResponse, RefreshResponse };

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthenticationProfile | null;
  currentTenantId: string | null;
  isAuthenticated: boolean;
  isSandbox: boolean;
  isHydrating: boolean;
  setHydrating: (val: boolean) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: AuthenticationProfile | null) => void;
  clearTokens: () => void;
  expireAccessToken: () => void;
  expireRefreshToken: () => void;
}
