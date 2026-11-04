import type { SandboxRequest, SandboxResponse } from './types';
import { decodeJwt } from './jwt';
import { defaultSandboxStore, DEFAULT_SANDBOX_PERSONAS } from './store';

/**
 * Result of resolving tenant context from a SandboxRequest.
 */
export type TenantAuthResult =
  | { success: true; tenantId: string; userId?: string; roles?: string[] }
  | { success: false; response: SandboxResponse };

/**
 * Strictly derive tenant identity from verified credentials or active sandbox context.
 * If a Bearer JWT token is present, tenant identity and roles are decoded directly from claims.
 * If no Bearer token is passed, falls back to the active persona and tenant scope from defaultSandboxStore.
 */
export function extractTenantFromAuth(req: SandboxRequest): TenantAuthResult {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const decoded = decodeJwt(token);

    if (decoded && decoded.tenantId) {
      return {
        success: true,
        tenantId: decoded.tenantId,
        userId: decoded.sub,
        roles: decoded.roles,
      };
    }

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

  // Fallback to active sandbox store context when dispatched without explicit token (e.g. internal handler tests / unauthenticated mocks)
  const storeState = defaultSandboxStore.getState();
  const persona = DEFAULT_SANDBOX_PERSONAS[storeState.activePersonaId] || DEFAULT_SANDBOX_PERSONAS.admin;
  const activeTenantId = storeState.activeTenantId || persona.defaultTenantId;

  return {
    success: true,
    tenantId: activeTenantId,
    userId: persona.uid || persona.username,
    roles: persona.roles,
  };
}
