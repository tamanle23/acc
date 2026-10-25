// ==========================================
// Authentication, Tokens & JWT Contracts
// ==========================================

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

export interface AuthenticationToken {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  issuedAt?: number;
  [key: string]: unknown;
}

export interface LoginRequest {
  username?: string;
  email?: string;
  password?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface TokenRefreshRequest {
  refreshToken: string;
  [key: string]: unknown;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface LogoutRequest {
  refreshToken?: string;
  [key: string]: unknown;
}
