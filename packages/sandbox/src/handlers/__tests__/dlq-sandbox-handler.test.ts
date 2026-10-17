import { describe, it, expect, beforeEach } from 'vitest';
import { dlqSandboxHandler, dlqSandboxRepository } from '../dlq-sandbox-handler';
import { defaultSandboxStore } from '../../store';

describe('DLQ Sandbox Handler Test Suite', () => {
  beforeEach(() => {
    dlqSandboxRepository.reset();
    defaultSandboxStore.resetToDefaults();
  });

  const createCtx = (path: string, method: string = 'GET', headers: Record<string, string> = {}) => ({
    pathname: path,
    method,
    headers,
    searchParams: new URLSearchParams(),
    url: path,
  });

  describe('Route Matcher', () => {
    it('matches /system/dlq and /workflow/dlq endpoints', () => {
      expect(dlqSandboxHandler.matcher(createCtx('/api/v1/system/dlq'))).toBe(true);
      expect(dlqSandboxHandler.matcher(createCtx('/workflow/dlq/dlq-101'))).toBe(true);
      expect(dlqSandboxHandler.matcher(createCtx('/api/v1/system/dlq/inject'))).toBe(true);
      expect(dlqSandboxHandler.matcher(createCtx('/api/v1/metadata/schemas'))).toBe(false);
    });
  });

  describe('DLQ Listing & Filtering', () => {
    it('lists all DLQ records across fleet when tenant is SYSTEM or ALL', async () => {
      const ctx = createCtx('/api/v1/system/dlq?limit=50', 'GET', { 'x-tenant-id': 'SYSTEM' });
      const req = { url: 'http://localhost/api/v1/system/dlq?limit=50', method: 'GET', headers: { 'x-tenant-id': 'SYSTEM' } };

      const res = await dlqSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);
      expect(res?.data.length).toBeGreaterThanOrEqual(4);
    });

    it('filters DLQ records by status parameter', async () => {
      const ctx = createCtx('/api/v1/system/dlq?status=ISOLATED', 'GET');
      const req = { url: 'http://localhost/api/v1/system/dlq?status=ISOLATED', method: 'GET', headers: {} };

      const res = await dlqSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      res?.data.forEach((r: any) => {
        expect(r.status).toBe('ISOLATED');
      });
    });

    it('retrieves single DLQ record by ID', async () => {
      const ctx = createCtx('/api/v1/system/dlq/dlq-101', 'GET');
      const req = { url: 'http://localhost/api/v1/system/dlq/dlq-101', method: 'GET', headers: {} };

      const res = await dlqSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.dlqId).toBe('dlq-101');
      expect(res?.data?.errorMessage).toContain('Connection timed out');
    });

    it('returns 404 for non-existent DLQ record ID', async () => {
      const ctx = createCtx('/api/v1/system/dlq/dlq-999999', 'GET');
      const req = { url: 'http://localhost/api/v1/system/dlq/dlq-999999', method: 'GET', headers: {} };

      const res = await dlqSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(404);
    });
  });

  describe('Poison Task Injection', () => {
    it('injects synthetic poison pill task into DLQ queue', async () => {
      const ctx = createCtx('/api/v1/system/dlq/inject', 'POST');
      const req = {
        url: 'http://localhost/api/v1/system/dlq/inject',
        method: 'POST',
        headers: { 'x-tenant-id': 'tenant-acme' },
        data: {
          taskType: 'LLM_CHAT_COMPLETE',
          errorMessage: 'Custom Poison Pill Injection for Testing',
        },
      };

      const res = await dlqSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(201);
      expect(res?.data?.dlqId).toContain('dlq-sim-');
      expect(res?.data?.taskType).toBe('LLM_CHAT_COMPLETE');
      expect(res?.data?.status).toBe('ISOLATED');

      // Verify task now exists in queue
      const check = dlqSandboxRepository.getById(res?.data?.dlqId, 'tenant-acme');
      expect(check).toBeDefined();
      expect(check?.errorMessage).toBe('Custom Poison Pill Injection for Testing');
    });
  });

  describe('Task Replay & Overrides', () => {
    it('replays poisoned task with modified payload overrides', async () => {
      const ctx = createCtx('/api/v1/system/dlq/dlq-101/replay', 'POST');
      const req = {
        url: 'http://localhost/api/v1/system/dlq/dlq-101/replay',
        method: 'POST',
        headers: { 'x-tenant-id': 'tenant-acme' },
        data: {
          payloadOverrides: {
            cardToken: 'tok_visa_remediated_9999',
          },
        },
      };

      const res = await dlqSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.status).toBe('REPLAYED');
      expect(res?.data?.replayedAtMs).toBeDefined();
      expect(res?.data?.payloadSnapshot?.cardToken).toBe('tok_visa_remediated_9999');
    });

    it('returns 404 when replaying non-existent task', async () => {
      const ctx = createCtx('/api/v1/system/dlq/non-existent-task/replay', 'POST');
      const req = { url: 'http://localhost/api/v1/system/dlq/non-existent-task/replay', method: 'POST', headers: {} };

      const res = await dlqSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(404);
    });
  });

  describe('Task Discard & Purging', () => {
    it('discards poisoned task from active queue', async () => {
      const ctx = createCtx('/api/v1/system/dlq/dlq-102', 'DELETE');
      const req = { url: 'http://localhost/api/v1/system/dlq/dlq-102', method: 'DELETE', headers: { 'x-tenant-id': 'tenant-acme' } };

      const res = await dlqSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(204);

      const discarded = dlqSandboxRepository.getById('dlq-102', 'tenant-acme');
      expect(discarded?.status).toBe('DISCARDED');
    });

    it('returns 404 when discarding non-existent task', async () => {
      const ctx = createCtx('/api/v1/system/dlq/ghost-dlq-id', 'DELETE');
      const req = { url: 'http://localhost/api/v1/system/dlq/ghost-dlq-id', method: 'DELETE', headers: {} };

      const res = await dlqSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(404);
    });
  });
});
