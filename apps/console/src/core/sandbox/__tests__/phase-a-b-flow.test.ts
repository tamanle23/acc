import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSandboxStore,
  sandboxRegistry,
  tasksSandboxHandler,
  usersSandboxHandler,
  chatsSandboxHandler,
  appsSandboxHandler,
  tasksSandboxRepo,
  usersSandboxRepo,
  chatsSandboxRepo,
  appsSandboxRepo,
} from '@/core/sandbox';
import { springApiClient } from '@/features/spring-auth';
import { attachSandboxAxiosInterceptor } from '../adapters/axios-sandbox-adapter';

describe('Phase A & Phase B End-to-End Wired API & Multi-Tenant Sandbox Flow', () => {
  beforeEach(() => {
    sandboxRegistry.clear();
    sandboxRegistry.register(tasksSandboxHandler);
    sandboxRegistry.register(usersSandboxHandler);
    sandboxRegistry.register(chatsSandboxHandler);
    sandboxRegistry.register(appsSandboxHandler);

    attachSandboxAxiosInterceptor(springApiClient);

    useSandboxStore.getState().resetToDefaults();
    useSandboxStore.getState().setEnabled(true);
    useSandboxStore.getState().setActiveTenant('tenant-acme');

    tasksSandboxRepo.reset();
    usersSandboxRepo.reset();
    chatsSandboxRepo.reset();
    appsSandboxRepo.reset();
  });

  describe('Tasks API End-to-End Flow (/api/tasks)', () => {
    it('fetches tasks for active tenant and handles CRUD mutations', async () => {
      // 1. GET /api/tasks
      const listRes = await springApiClient.get('/api/tasks');
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.data)).toBe(true);
      const initialCount = listRes.data.length;

      // 2. POST /api/tasks (Create)
      const newTaskId = `TASK-TEST-${Date.now()}`;
      const createRes = await springApiClient.post('/api/tasks', {
        id: newTaskId,
        title: 'End-to-End Test Task',
        status: 'in-progress',
        label: 'feature',
        priority: 'high',
      });
      expect(createRes.status).toBe(201);
      expect(createRes.data.id).toBe(newTaskId);

      // 3. PATCH /api/tasks/:id (Update)
      const patchRes = await springApiClient.patch(`/api/tasks/${newTaskId}`, {
        status: 'done',
      });
      expect(patchRes.status).toBe(200);
      expect(patchRes.data.status).toBe('done');

      // 4. Multi-Tenant Isolation
      useSandboxStore.getState().setActiveTenant('tenant-us-east-1');
      const usRes = await springApiClient.get('/api/tasks');
      expect(usRes.data.some((t: any) => t.id === newTaskId)).toBe(false);

      // 5. DELETE /api/tasks/:id
      useSandboxStore.getState().setActiveTenant('tenant-acme');
      const deleteRes = await springApiClient.delete(`/api/tasks/${newTaskId}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.data.success).toBe(true);

      const afterDeleteRes = await springApiClient.get('/api/tasks');
      expect(afterDeleteRes.data.length).toBe(initialCount);
    });
  });

  describe('Users API End-to-End Flow (/api/users)', () => {
    it('fetches users, creates, updates status, and deletes cleanly', async () => {
      // 1. GET /api/users
      const usersRes = await springApiClient.get('/api/users');
      expect(usersRes.status).toBe(200);
      expect(usersRes.data.length).toBeGreaterThan(0);

      // 2. POST /api/users
      const newUserId = `usr-test-${Date.now()}`;
      const createRes = await springApiClient.post('/api/users', {
        id: newUserId,
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        email: 'johndoe@example.com',
        phoneNumber: '+1-555-0199',
        status: 'active',
        role: 'manager',
      });
      expect(createRes.status).toBe(201);
      expect(createRes.data.username).toBe('johndoe');

      // 3. PATCH /api/users/:id
      const patchRes = await springApiClient.patch(`/api/users/${newUserId}`, {
        status: 'inactive',
      });
      expect(patchRes.status).toBe(200);
      expect(patchRes.data.status).toBe('inactive');

      // 4. DELETE /api/users/:id
      const delRes = await springApiClient.delete(`/api/users/${newUserId}`);
      expect(delRes.status).toBe(200);
      expect(delRes.data.success).toBe(true);
    });
  });

  describe('Chats API End-to-End Flow (/api/chats)', () => {
    it('supports fetching conversations and appending messages', async () => {
      const chatsRes = await springApiClient.get('/api/chats');
      expect(chatsRes.status).toBe(200);
      expect(chatsRes.data.length).toBeGreaterThan(0);

      const firstConvo = chatsRes.data[0];
      const initialMsgs = firstConvo.messages.length;

      const postMsgRes = await springApiClient.post(`/api/chats/${firstConvo.id}`, {
        sender: 'You',
        message: 'Hello via TanStack API integration test',
      });
      expect(postMsgRes.status).toBe(200);
      expect(postMsgRes.data.messages.length).toBe(initialMsgs + 1);
    });
  });

  describe('Social Apps Integration Exchange Flow (/api/integrations)', () => {
    it('handles simulated OAuth token exchange for facebook, tiktok, and youtube', async () => {
      const fbRes = await springApiClient.post('/api/integrations/facebook/exchange', { mode: 'login' });
      expect(fbRes.status).toBe(200);
      expect(fbRes.data.success).toBe(true);

      const ttRes = await springApiClient.post('/api/integrations/tiktok/exchange', { authCode: 'demo_code' });
      expect(ttRes.status).toBe(200);
      expect(ttRes.data.success).toBe(true);

      const ytRes = await springApiClient.post('/api/integrations/youtube/exchange', { authCode: 'demo_yt_code' });
      expect(ytRes.status).toBe(200);
      expect(ytRes.data.success).toBe(true);
    });
  });
});
