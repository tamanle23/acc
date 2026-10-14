export interface JwtPayload {
  sub: string;
  roles: string[];
  tenantId?: string;
  tid?: string;
  actor_tid?: string;
  iat: number;
  exp: number;
  isSandbox?: boolean;
  [key: string]: unknown;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: JwtPayload | null;
  currentTenantId: string | null;
  isAuthenticated: boolean;
  isSandbox: boolean;
  isHydrating: boolean;

  setTokens: (access: string, refresh: string) => void;
  clearTokens: () => void;
  setHydrating: (hydrating: boolean) => void;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
}
