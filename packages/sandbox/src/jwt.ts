export interface SandboxJwtPayload {
  sub?: string;
  roles?: string[];
  tenantId?: string;
  tid?: string;
  actor_tid?: string;
  is_ephemeral_delegation?: boolean;
  isSandbox?: boolean;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export function decodeJwt(token: string): SandboxJwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

    const jsonPayload = decodeURIComponent(
      (typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary'))
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload) as SandboxJwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, bufferSeconds = 10): boolean {
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now() + bufferSeconds * 1000;
}
