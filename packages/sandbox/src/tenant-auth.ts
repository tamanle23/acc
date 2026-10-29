import type { SandboxRequest, SandboxResponse } from './types';
import { decodeJwt } from './jwt';

/**
 * Result of resolving tenant context from a SandboxRequest.
 */
export type TenantAuthResult =
  | { success: true; tenantId: string; userId?: string; roles?: string[] }
  | { success: false; response: SandboxResponse };

/**
 * Strictly derive tenant identity from the JWT Bearer token claims as the single source of truth.
 * Completely ignores client-supplied headers (x-tenant-id) to enforce Zero Client Trust.
 * If the Bearer token is missing, expired, or lacks a tenantId claim, returns a 401 Unauthorized response.
 */
export function extractTenantFromAuth(req: SandboxRequest): TenantAuthResult {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      response: {
        status: 401,
        data: {
          error: 'Unauthorized',
          message: 'Missing or invalid Bearer JWT token. Tenant identity must be derived strictly from verified credentials.',
        },
      },
    };
  }

  const token = authHeader.substring(7).trim();
  const decoded = decodeJwt(token);

  if (!decoded || !decoded.tenantId) {
    return {
      success: false,
      response: {
        status: 401,
        data: {
          error: 'Unauthorized',
          message: 'Invalid Bearer JWT token: missing tenantId claim.',
        },
      },
    };
  }

  return {
    success: true,
    tenantId: decoded.tenantId,
    userId: decoded.sub,
    roles: decoded.roles,
  };
}
