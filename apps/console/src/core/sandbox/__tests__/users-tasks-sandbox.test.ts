import { describe, it, expect, beforeEach } from 'vitest';
import {
  sandboxManager,
  useSandboxStore,
  sandboxRegistry,
  usersSandboxHandler,
  tasksSandboxHandler,
  usersSandboxRepo,
  tasksSandboxRepo,
} from '../index';

describe('Users & Tasks Sandbox Endpoints via SandboxManager', () => {
  beforeEach(() => {
    sandboxRegistry.clear();
    sandboxRegistry.register(usersSandboxHandler);
    sandboxRegistry.register(tasksSandboxHandler);
    useSandboxStore.getState().resetToDefaults();
    useSandboxStore.getState().setEnabled(true);
    usersSandboxRepo.reset();
    tasksSandboxRepo.reset();
  });

  describe('Users Endpoints (/api/users)', () => {
    it('should list users via GET /api/users', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/api/users',
        method: 'GET',
      });

      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);
      expect(res?.data.length).toBeGreaterThan(0);
    });

    it('should create user via POST /api/users', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/api/users',
        method: 'POST',
        data: {
          id: 'user-http-100',
          firstName: 'Alice',
          lastName: 'Smith',
          username: 'asmith',
          email: 'alice@example.com',
          status: 'active',
          role: 'user',
        },
      });

      expect(res?.status).toBe(201);
      expect(res?.data.id).toBe('user-http-100');

      // Verify GET /api/users/user-http-100
      const getRes = await sandboxManager.handleRequest({
        url: '/api/users/user-http-100',
        method: 'GET',
      });
      expect(getRes?.status).toBe(200);
      expect(getRes?.data.firstName).toBe('Alice');
    });

    it('should patch and delete user via /api/users/:id', async () => {
      const allUsers = usersSandboxRepo.getAll();
      const targetId = allUsers[0].id;

      // Patch
      const patchRes = await sandboxManager.handleRequest({
        url: `/api/users/${targetId}`,
        method: 'PATCH',
        data: { status: 'suspended' },
      });
      expect(patchRes?.status).toBe(200);
      expect(patchRes?.data.status).toBe('suspended');

      // Delete
      const delRes = await sandboxManager.handleRequest({
        url: `/api/users/${targetId}`,
        method: 'DELETE',
      });
      expect(delRes?.status).toBe(200);

      // Verify 404
      const getRes = await sandboxManager.handleRequest({
        url: `/api/users/${targetId}`,
        method: 'GET',
      });
      expect(getRes?.status).toBe(404);
    });
  });

  describe('Tasks Endpoints (/api/workflow-executions)', () => {
    it('should list tasks via GET /api/workflow-executions', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/api/workflow-executions',
        method: 'GET',
      });

      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);
      expect(res?.data.length).toBeGreaterThan(0);
    });

    it('should create task via POST /api/workflow-executions', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/api/workflow-executions',
        method: 'POST',
        data: {
          id: 'TASK-1111',
          title: 'Implement Unit Tests',
          status: 'in progress',
          label: 'feature',
          priority: 'high',
        },
      });

      expect(res?.status).toBe(201);
      expect(res?.data.id).toBe('TASK-1111');
    });

    it('should patch and delete task via /api/workflow-executions/:id', async () => {
      const all = tasksSandboxRepo.getAll();
      const firstId = all[0].id;

      // Patch
      const patchRes = await sandboxManager.handleRequest({
        url: `/api/workflow-executions/${firstId}`,
        method: 'PATCH',
        data: { priority: 'low' },
      });
      expect(patchRes?.status).toBe(200);
      expect(patchRes?.data.priority).toBe('low');

      // Delete
      const delRes = await sandboxManager.handleRequest({
        url: `/api/workflow-executions/${firstId}`,
        method: 'DELETE',
      });
      expect(delRes?.status).toBe(200);
    });
  });
});
