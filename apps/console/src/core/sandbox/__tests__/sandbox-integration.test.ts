import { describe, it, expect, beforeEach } from 'vitest';
import {
  sandboxManager,
  useSandboxStore,
  usersSandboxRepo,
  tasksSandboxRepo,
  mockMetadataStore,
} from '../index';
import { useSpringAuthStore } from '@/features/spring-auth/store';
import { springApiClient } from '@/features/spring-auth/api-client';

describe('Unified Sandbox Full Platform Integration (Phases 2-4)', () => {
  beforeEach(() => {
    useSandboxStore.getState().resetToDefaults();
    useSandboxStore.getState().setEnabled(true);
    mockMetadataStore.resetToInitialState();
    usersSandboxRepo.reset();
    tasksSandboxRepo.reset();
  });

  describe('Sandbox Bypass & SpringApiClient Integration', () => {
    it('should authenticate admin_bypass via springApiClient.post("/auth/token") with 200 OK', async () => {
      const res = await springApiClient.post('/auth/token', {
        username: 'admin_bypass',
        password: 'bypass',
      }, {
        headers: { 'X-Sandbox-Mock': 'true' },
      });

      expect(res.status).toBe(200);
      expect(res.data.accessToken).toContain('bW9ja19zaWduYXR1cmU');
      expect(res.data.refreshToken).toBe('mock_refresh_token_admin');
    });

    it('should authenticate creator_bypass via springApiClient.post("/auth/token") with 200 OK', async () => {
      const res = await springApiClient.post('/auth/token', {
        username: 'creator_bypass',
        password: 'bypass',
      }, {
        headers: { 'X-Sandbox-Mock': 'true' },
      });

      expect(res.status).toBe(200);
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.refreshToken).toBe('mock_refresh_token_creator');
    });

    it('should update spring auth tokens when persona is switched', () => {
      sandboxManager.switchPersona('creator');
      const authState = useSpringAuthStore.getState();

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.isSandbox).toBe(true);
      expect(authState.user?.sub).toBe('creator');
      expect(authState.user?.roles).toContain('ROLE_OPERATIONS_MANAGER');
      expect(useSandboxStore.getState().activeTenantId).toBe('tenant-eu-central-1');
    });
  });

  describe('Auth Sandbox Handler Direct Dispatch', () => {
    it('should authenticate admin_bypass and return signed JWT with roles', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/api/auth/token',
        method: 'POST',
        data: { username: 'admin_bypass', password: 'bypass' },
      });

      expect(res).not.toBeNull();
      expect(res?.status).toBe(200);
      expect(res?.data.accessToken).toContain('bW9ja19zaWduYXR1cmU');
      expect(res?.data.refreshToken).toBe('mock_refresh_token_admin');
    });

    it('should reject invalid credentials with 401', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/api/auth/token',
        method: 'POST',
        data: { username: 'admin_bypass', password: 'wrong_password' },
      });

      expect(res?.status).toBe(401);
      expect(res?.data.message).toBe('Bad credentials');
    });

    it('should refresh tokens via /api/auth/refresh', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/api/auth/refresh',
        method: 'POST',
        data: { refreshToken: 'mock_refresh_token_admin' },
      });

      expect(res?.status).toBe(200);
      expect(res?.data.accessToken).toBeDefined();
    });

    it('should authorize admin to /api/admin/dashboard and block unprivileged requests', async () => {
      // 1. Login as admin
      const loginRes = await sandboxManager.handleRequest({
        url: '/api/auth/token',
        method: 'POST',
        data: { username: 'admin_bypass', password: 'bypass' },
      });
      const adminToken = loginRes?.data.accessToken;

      const dashRes = await sandboxManager.handleRequest({
        url: '/api/admin/dashboard',
        method: 'GET',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(dashRes?.status).toBe(200);
      expect(dashRes?.data.message).toContain('Welcome to the Secure Admin Dashboard');

      // 2. Unauthenticated request
      const unauthRes = await sandboxManager.handleRequest({
        url: '/api/admin/dashboard',
        method: 'GET',
      });
      expect(unauthRes?.status).toBe(401);
    });
  });

  describe('Metadata Sandbox Adapter (Expanded Route Coverage)', () => {
    it('should route /api/metadata/entity-types and return mock entity types', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/api/metadata/entity-types',
        method: 'GET',
      });

      expect(res?.status).toBe(200);
      expect(res?.data.content.length).toBeGreaterThan(0);
      expect(res?.data.content.some((et: any) => et.name === 'Customer Account')).toBe(true);
    });

    it('should route /v1/metadata/relationship-types and return relationship types', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/v1/metadata/relationship-types',
        method: 'GET',
      });

      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data.content)).toBe(true);
    });

    it('should route /v1/metadata/entity-types/1/attributes and return attribute definitions', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/v1/metadata/entity-types/1/attributes',
        method: 'GET',
      });

      expect(res?.status).toBe(200);
      expect(res?.data.content.length).toBeGreaterThan(0);
    });

    it('should route /v1/metadata/entity-types/1/facets', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/v1/metadata/entity-types/1/facets',
        method: 'GET',
      });

      expect(res?.status).toBe(200);
      expect(res?.data.entityTypeId).toBe('1');
    });

    it('should query entity records filtered by active tenant and facets', async () => {
      useSandboxStore.getState().setActiveTenant('tenant-us-east-1');

      const res = await sandboxManager.handleRequest({
        url: '/api/metadata/entity-types/1/records?is_multi_region_ha=true',
        method: 'GET',
      });

      expect(res?.status).toBe(200);
      expect(res?.data.content.length).toBeGreaterThan(0);
      res?.data.content.forEach((record: any) => {
        expect(record.tenantId).toBe('tenant-us-east-1');
        expect(record.attributes.is_multi_region_ha).toBe(true);
      });
    });
  });

  describe('Fetch Interceptor Integration', () => {
    it('should intercept native window.fetch requests when sandbox is enabled', async () => {
      const res = await window.fetch('/api/users');
      expect(res.status).toBe(200);

      const users = await res.json();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });
  });

  describe('Users & Tasks In-Memory Repositories', () => {
    it('should list, create, update, and delete users in memory', async () => {
      const initialUsers = usersSandboxRepo.getAll();
      expect(initialUsers.length).toBeGreaterThan(0);

      // Create
      const created = usersSandboxRepo.create({
        id: 'user-test-999',
        firstName: 'Test',
        lastName: 'Agent',
        username: 'test_agent',
        email: 'agent@test.internal',
        phoneNumber: '+100000000',
        status: 'active',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(created.id).toBe('user-test-999');
      expect(usersSandboxRepo.getById('user-test-999')).toBeDefined();

      // Update
      const updated = usersSandboxRepo.update('user-test-999', { status: 'suspended' });
      expect(updated?.status).toBe('suspended');

      // Delete
      const deleted = usersSandboxRepo.delete('user-test-999');
      expect(deleted).toBe(true);
      expect(usersSandboxRepo.getById('user-test-999')).toBeUndefined();
    });

    it('should list, create, update, and delete tasks in memory', async () => {
      const initialTasks = tasksSandboxRepo.getAll();
      expect(initialTasks.length).toBeGreaterThan(0);

      // Create
      const newTask = tasksSandboxRepo.create({
        id: 'TASK-9999',
        title: 'Unified Sandbox Verification',
        status: 'in progress',
        label: 'feature',
        priority: 'high',
      });
      expect(newTask.id).toBe('TASK-9999');
      expect(tasksSandboxRepo.getById('TASK-9999')).toBeDefined();

      // Delete
      const deleted = tasksSandboxRepo.delete('TASK-9999');
      expect(deleted).toBe(true);
      expect(tasksSandboxRepo.getById('TASK-9999')).toBeUndefined();
    });
  });

  describe('Global State Reset', () => {
    it('should restore all mutated records back to pristine initial state', async () => {
      // Mutate task
      tasksSandboxRepo.create({
        id: 'TASK-TO-PURGE',
        title: 'Ephemeral Task',
        status: 'todo',
        label: 'bug',
        priority: 'low',
      });
      expect(tasksSandboxRepo.getById('TASK-TO-PURGE')).toBeDefined();

      // Reset
      mockMetadataStore.resetToInitialState();
      tasksSandboxRepo.reset();
      usersSandboxRepo.reset();

      expect(tasksSandboxRepo.getById('TASK-TO-PURGE')).toBeUndefined();
    });
  });
});
