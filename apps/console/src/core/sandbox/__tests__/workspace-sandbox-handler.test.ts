import { describe, it, expect, beforeEach } from 'vitest';
import { workspaceSandboxHandler, sandboxWorkspaceRepository } from '../handlers/workspace-sandbox-handler';
import { useSandboxStore } from '../store/sandbox-store';

describe('workspaceSandboxHandler (Phase 3 Backend Alignment)', () => {
  beforeEach(() => {
    sandboxWorkspaceRepository.reset();
    useSandboxStore.getState().setActiveTenant('tenant-acme');
  });

  it('matches all /api/v1/workspaces paths', () => {
    expect(workspaceSandboxHandler.matcher({ url: '/api/v1/workspaces', method: 'GET' })).toBe(true);
    expect(workspaceSandboxHandler.matcher({ url: '/api/v1/workspaces/ws-1/default', method: 'PUT' })).toBe(true);
    expect(workspaceSandboxHandler.matcher({ url: '/api/v1/billing', method: 'GET' })).toBe(false);
  });

  it('returns active tenant workspaces on GET /api/v1/workspaces', async () => {
    const res = await workspaceSandboxHandler.handler({
      url: '/api/v1/workspaces',
      method: 'GET',
    });

    expect(res).not.toBeNull();
    expect(res?.status).toBe(200);
    expect(res?.data.data.length).toBeGreaterThanOrEqual(2);
    expect(res?.data.data.every((w: any) => w.tenantId === 'tenant-acme')).toBe(true);
  });

  it('prohibits deleting default or immutable workspace', async () => {
    const res = await workspaceSandboxHandler.handler({
      url: '/api/v1/workspaces/ws-acme-prod',
      method: 'DELETE',
    });

    expect(res?.status).toBe(409);
    expect(res?.data.code).toBe('METADATA_CONFLICT');
  });

  it('creates new workspace and prevents duplicate code within tenant', async () => {
    const createRes = await workspaceSandboxHandler.handler({
      url: '/api/v1/workspaces',
      method: 'POST',
      body: {
        code: 'ANALYTICS',
        name: 'Analytics Hub',
        planTier: 'PRO',
      },
    });

    expect(createRes?.status).toBe(201);
    expect(createRes?.data.data.code).toBe('ANALYTICS');

    // Duplicate code should trigger 409 METADATA_CONFLICT
    const dupRes = await workspaceSandboxHandler.handler({
      url: '/api/v1/workspaces',
      method: 'POST',
      body: {
        code: 'ANALYTICS',
        name: 'Another Hub',
      },
    });

    expect(dupRes?.status).toBe(409);
    expect(dupRes?.data.code).toBe('METADATA_CONFLICT');
  });

  it('switches default workspace correctly', async () => {
    const switchRes = await workspaceSandboxHandler.handler({
      url: '/api/v1/workspaces/ws-acme-staging/default',
      method: 'PUT',
    });

    expect(switchRes?.status).toBe(200);
    expect(switchRes?.data.data.isDefault).toBe(true);
  });
});
