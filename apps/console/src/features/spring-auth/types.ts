import type { JwtPayload, LoginResponse, TokenRefreshResponse as RefreshResponse } from '@acc/client';

export type { JwtPayload, LoginResponse, RefreshResponse };

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: JwtPayload | null;
  currentTenantId: string | null;
  isAuthenticated: boolean;
  isSandbox: boolean;
  isHydrating: boolean;
  setHydrating: (val: boolean) => void;
  setTokens: (access: string, refresh: string) => void;
  clearTokens: () => void;
  expireAccessToken: () => void;
  expireRefreshToken: () => void;
}
