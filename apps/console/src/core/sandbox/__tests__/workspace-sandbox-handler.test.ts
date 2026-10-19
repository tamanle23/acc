import { describe, it, expect, beforeEach } from 'vitest';
import { workspaceSandboxHandler, sandboxWorkspaceRepository } from '../handlers/workspace-sandbox-handler';
import { useSandboxStore } from '../store/sandbox-store';

describe('workspaceSandboxHandler (Phase 3 Backend Alignment)', () => {
  beforeEach(() => {
    sandboxWorkspaceRepository.reset();
    useSandboxStore.getState().setActiveTenant('tenant-acme');
  });

  const makeCtx = (url: string, method: string) => ({
    url,
    method,
    headers: {},
    pathname: url,
    searchParams: new URLSearchParams(),
  });

  it('matches all /api/v1/workspaces paths', () => {
    expect(workspaceSandboxHandler.matcher(makeCtx('/api/v1/workspaces', 'GET'))).toBe(true);
    expect(workspaceSandboxHandler.matcher(makeCtx('/api/v1/workspaces/ws-1/default', 'PUT'))).toBe(true);
    expect(workspaceSandboxHandler.matcher(makeCtx('/api/v1/billing', 'GET'))).toBe(false);
  });

  it('returns active tenant workspaces on GET /api/v1/workspaces', async () => {
    const url = '/api/v1/workspaces';
    const res = await workspaceSandboxHandler.handler(
      { url, method: 'GET' },
      makeCtx(url, 'GET')
    );

    expect(res).not.toBeNull();
    expect(res?.status).toBe(200);
    expect(res?.data.data.length).toBeGreaterThanOrEqual(2);
    expect(res?.data.data.every((w: any) => w.tenantId === 'tenant-acme')).toBe(true);
  });

  it('prohibits deleting default or immutable workspace', async () => {
    const url = '/api/v1/workspaces/ws-acme-prod';
    const res = await workspaceSandboxHandler.handler(
      { url, method: 'DELETE' },
      makeCtx(url, 'DELETE')
    );

    expect(res?.status).toBe(409);
    expect(res?.data.code).toBe('METADATA_CONFLICT');
  });

  it('creates new workspace and prevents duplicate code within tenant', async () => {
    const url = '/api/v1/workspaces';
    const createRes = await workspaceSandboxHandler.handler(
      {
        url,
        method: 'POST',
        data: {
          code: 'ANALYTICS',
          name: 'Analytics Hub',
          planTier: 'PRO',
        },
      },
      makeCtx(url, 'POST')
    );

    expect(createRes?.status).toBe(201);
    expect(createRes?.data.data.code).toBe('ANALYTICS');

    // Duplicate code should trigger 409 METADATA_CONFLICT
    const dupRes = await workspaceSandboxHandler.handler(
      {
        url,
        method: 'POST',
        data: {
          code: 'ANALYTICS',
          name: 'Another Hub',
        },
      },
      makeCtx(url, 'POST')
    );

    expect(dupRes?.status).toBe(409);
    expect(dupRes?.data.code).toBe('METADATA_CONFLICT');
  });

  it('switches default workspace correctly', async () => {
    const url = '/api/v1/workspaces/ws-acme-staging/default';
    const switchRes = await workspaceSandboxHandler.handler(
      { url, method: 'PUT' },
      makeCtx(url, 'PUT')
    );

    expect(switchRes?.status).toBe(200);
    expect(switchRes?.data.data.isDefault).toBe(true);
  });
});
