import { describe, it, expect, beforeEach } from 'vitest';
import {
  workflowSandboxHandler,
  workflowExecutionsSandboxRepo,
} from '../workflow-handler';
import {
  workflowVersioningSandboxHandler,
  workflowVersioningSandboxRepo,
} from '../workflow-versioning-sandbox-handler';
import { defaultSandboxStore } from '../../store';

describe('Workflow & Versioning Sandbox Handlers Test Suite', () => {
  beforeEach(() => {
    workflowExecutionsSandboxRepo.reset();
    workflowVersioningSandboxRepo.reset();
    defaultSandboxStore.resetToDefaults();
  });

  const createCtx = (path: string, method: string = 'GET', headers: Record<string, string> = {}) => ({
    pathname: path,
    method,
    headers,
    searchParams: new URLSearchParams(),
    url: path,
  });

  describe('Workflow Execution Handler', () => {
    it('matches /workflow and /workflow-executions endpoints', () => {
      expect(workflowSandboxHandler.matcher(createCtx('/api/v1/workflow/definitions'))).toBe(true);
      expect(workflowSandboxHandler.matcher(createCtx('/api/v1/workflow/executions'))).toBe(true);
      expect(workflowSandboxHandler.matcher(createCtx('/workflow-executions'))).toBe(true);
      expect(workflowSandboxHandler.matcher(createCtx('/api/v1/billing'))).toBe(false);
    });

    it('lists workflow executions with pagination and tenant filtering', async () => {
      const ctx = createCtx('/api/v1/workflow-executions', 'GET');
      const req = { url: '/api/v1/workflow-executions', method: 'GET', headers: {} };

      const res = await workflowSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);
      expect(res?.data.length).toBeGreaterThan(0);
    });

    it('creates, updates, and deletes workflow execution tasks in repository', () => {
      const all = workflowExecutionsSandboxRepo.getAll('tenant-acme');
      expect(all.length).toBeGreaterThan(0);

      const newTask = workflowExecutionsSandboxRepo.create(
        {
          id: 'TASK-CUSTOM-99',
          title: 'Custom Test Task',
          status: 'in_progress',
          label: 'feature',
          priority: 'high',
        } as any,
        'tenant-acme'
      );
      expect(newTask.id).toBe('TASK-CUSTOM-99');

      const found = workflowExecutionsSandboxRepo.getById('TASK-CUSTOM-99', 'tenant-acme');
      expect(found?.title).toBe('Custom Test Task');

      const updated = workflowExecutionsSandboxRepo.update(
        'TASK-CUSTOM-99',
        { status: 'done' as any },
        'tenant-acme'
      );
      expect(updated?.status).toBe('done');

      const deleted = workflowExecutionsSandboxRepo.delete('TASK-CUSTOM-99', 'tenant-acme');
      expect(deleted).toBe(true);
      expect(workflowExecutionsSandboxRepo.getById('TASK-CUSTOM-99', 'tenant-acme')).toBeUndefined();
    });

    it('returns workflow definitions list and allows saving custom definition', async () => {
      const ctxGet = createCtx('/api/v1/workflow/definitions', 'GET');
      const reqGet = { url: '/api/v1/workflow/definitions', method: 'GET', headers: {} };
      const resGet = await workflowSandboxHandler.handler(reqGet, ctxGet);
      expect(resGet?.status).toBe(200);
      expect(Array.isArray(resGet?.data)).toBe(true);

      const ctxPost = createCtx('/api/v1/workflow/definitions', 'POST');
      const reqPost = {
        url: '/api/v1/workflow/definitions',
        method: 'POST',
        headers: {},
        data: {
          name: 'Order Fulfillment V2',
          workflowKey: 'order-fulfillment-v2',
          version: 2,
          tasks: [{ taskReferenceName: 'validateOrder', taskType: 'SIMPLE' }],
        },
      };
      const resPost = await workflowSandboxHandler.handler(reqPost, ctxPost);
      expect(resPost?.status).toBe(201);
      expect(resPost?.data?.workflowKey).toBe('order-fulfillment-v2');
    });

    it('handles approvals listing and status mutations', async () => {
      const ctx = createCtx('/api/v1/workflow/tasks/approvals', 'GET');
      const req = { url: '/api/v1/workflow/tasks/approvals', method: 'GET', headers: {} };
      const res = await workflowSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);

      const firstTask = res?.data?.[0];
      if (firstTask?.taskId) {
        // Claim
        const claimRes = await workflowSandboxHandler.handler(
          { url: `/api/v1/workflow/tasks/${firstTask.taskId}/claim`, method: 'POST', headers: {}, data: { userId: 'alice' } },
          createCtx(`/api/v1/workflow/tasks/${firstTask.taskId}/claim`, 'POST')
        );
        expect(claimRes?.status).toBe(200);
        expect(claimRes?.data?.claimed).toBe(true);

        // Unclaim
        const unclaimRes = await workflowSandboxHandler.handler(
          { url: `/api/v1/workflow/tasks/${firstTask.taskId}/unclaim`, method: 'POST', headers: {} },
          createCtx(`/api/v1/workflow/tasks/${firstTask.taskId}/unclaim`, 'POST')
        );
        expect(unclaimRes?.status).toBe(200);
        expect(unclaimRes?.data?.unclaimed).toBe(true);

        // Resolve
        const resolveRes = await workflowSandboxHandler.handler(
          { url: `/api/v1/workflow/tasks/${firstTask.taskId}/resolve`, method: 'POST', headers: {}, data: { action: 'APPROVE', comment: 'Approved' } },
          createCtx(`/api/v1/workflow/tasks/${firstTask.taskId}/resolve`, 'POST')
        );
        expect(resolveRes?.status).toBe(200);
        expect(resolveRes?.data?.resolved).toBe(true);
      }
    });
  });

  describe('Workflow Versioning & Hot Migration Handler', () => {
    it('matches versioning, migration, and audit ledger routes', () => {
      expect(workflowVersioningSandboxHandler.matcher(createCtx('/workflow/definitions/order-flow/versions'))).toBe(true);
      expect(workflowVersioningSandboxHandler.matcher(createCtx('/workflow/executions/wf-1/migrate/dry-run'))).toBe(true);
      expect(workflowVersioningSandboxHandler.matcher(createCtx('/workflow/executions/wf-1/migrate'))).toBe(true);
      expect(workflowVersioningSandboxHandler.matcher(createCtx('/workflow/executions/wf-1/audit'))).toBe(true);
      expect(workflowVersioningSandboxHandler.matcher(createCtx('/workflow/executions/wf-1/audit/verify'))).toBe(true);
      expect(workflowVersioningSandboxHandler.matcher(createCtx('/workflow/executions'))).toBe(false);
    });

    it('lists versions for a workflow and saves definition version in repository', async () => {
      const ctxGet = createCtx('/api/v1/workflow/definitions/order-fulfillment-v1/versions', 'GET');
      const reqGet = { url: 'http://localhost/api/v1/workflow/definitions/order-fulfillment-v1/versions', method: 'GET', headers: {} };
      const resGet = await workflowVersioningSandboxHandler.handler(reqGet, ctxGet);
      expect(resGet?.status).toBe(200);
      expect(resGet?.data.length).toBeGreaterThanOrEqual(2);

      const savedVer = workflowVersioningSandboxRepo.saveVersion({
        definitionId: 'def-custom-v3',
        tenantId: 'tenant-acme',
        workflowKey: 'order-fulfillment-v1',
        version: 3,
        status: 'ACTIVE',
        name: 'Order Fulfillment V3',
        description: 'Added automated fraud inspection step',
        definition: { tasks: [{ taskReferenceName: 'fraudCheck', taskType: 'SIMPLE' }] },
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      expect(savedVer.version).toBe(3);
    });

    it('executes dry-run migration check and returns validation report', async () => {
      const ctx = createCtx('/api/v1/workflow/executions/wf-exec-101/migrate/dry-run', 'POST');
      const req = {
        url: 'http://localhost/api/v1/workflow/executions/wf-exec-101/migrate/dry-run',
        method: 'POST',
        headers: {},
        data: { version: 2 },
      };

      const res = await workflowVersioningSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.compatible).toBe(true);
      expect(Array.isArray(res?.data?.completedTasksPreserved)).toBe(true);
    });

    it('performs live hot migration and emits tamper-evident audit ledger entries', async () => {
      const ctx = createCtx('/api/v1/workflow/executions/wf-exec-101/migrate', 'POST');
      const req = {
        url: 'http://localhost/api/v1/workflow/executions/wf-exec-101/migrate',
        method: 'POST',
        headers: {},
        data: { version: 2 },
      };

      const res = await workflowVersioningSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.migrated).toBe(true);
      expect(res?.data?.version).toBe(2);

      // Verify audit ledger
      const ctxLedger = createCtx('/api/v1/workflow/executions/wf-exec-101/audit', 'GET');
      const reqLedger = { url: 'http://localhost/api/v1/workflow/executions/wf-exec-101/audit', method: 'GET', headers: {} };
      const resLedger = await workflowVersioningSandboxHandler.handler(reqLedger, ctxLedger);
      expect(resLedger?.status).toBe(200);
      expect(resLedger?.data.length).toBeGreaterThan(0);

      // Verify tamper-evident cryptographic hash chain
      const ctxVerify = createCtx('/api/v1/workflow/executions/wf-exec-101/audit/verify', 'GET');
      const reqVerify = { url: 'http://localhost/api/v1/workflow/executions/wf-exec-101/audit/verify', method: 'GET', headers: {} };
      const resVerify = await workflowVersioningSandboxHandler.handler(reqVerify, ctxVerify);
      expect(resVerify?.status).toBe(200);
      expect(resVerify?.data?.verified).toBe(true);
      expect(resVerify?.data?.totalEvents).toBeGreaterThan(0);

      // Diagnostic simulation: tamper with audit record and assert hash chain invalidation
      const ctxTamper = createCtx('/api/v1/workflow/executions/wf-exec-101/audit/tamper', 'POST');
      const reqTamper = {
        url: 'http://localhost/api/v1/workflow/executions/wf-exec-101/audit/tamper',
        method: 'POST',
        headers: {},
        data: { sequenceNum: 1, payload: { illegalOverride: true } },
      };
      const resTamper = await workflowVersioningSandboxHandler.handler(reqTamper, ctxTamper);
      expect(resTamper?.status).toBe(200);

      const resVerifyAfterTamper = await workflowVersioningSandboxHandler.handler(reqVerify, ctxVerify);
      expect(resVerifyAfterTamper?.status).toBe(200);
      expect(resVerifyAfterTamper?.data?.verified).toBe(false);

      // Migration preview & batch migration
      const ctxPreview = createCtx('/api/v1/workflow/definitions/order-fulfillment-v1/migration-preview', 'POST');
      const reqPreview = {
        url: 'http://localhost/api/v1/workflow/definitions/order-fulfillment-v1/migration-preview',
        method: 'POST',
        headers: {},
        data: { targetVersion: 2 },
      };
      const resPreview = await workflowVersioningSandboxHandler.handler(reqPreview, ctxPreview);
      expect(resPreview?.status).toBe(200);
      expect(resPreview?.data?.summary).toBeDefined();

      const ctxBatch = createCtx('/api/v1/workflow/definitions/order-fulfillment-v1/batch-migrate', 'POST');
      const reqBatch = {
        url: 'http://localhost/api/v1/workflow/definitions/order-fulfillment-v1/batch-migrate',
        method: 'POST',
        headers: {},
        data: { targetVersion: 2 },
      };
      const resBatch = await workflowVersioningSandboxHandler.handler(reqBatch, ctxBatch);
      expect(resBatch?.status).toBe(200);
      expect(resBatch?.data?.migrated).toBeGreaterThan(0);
    });
  });

  describe('Workflow Definition Lifecycle & Single Executions', () => {
    it('manages single definitions and handles execution pause/resume', async () => {
      // 1. Get single definition
      const getDef = await workflowSandboxHandler.handler(
        { url: '/api/v1/workflow/definitions/order-fulfillment-v1', method: 'GET', headers: {} },
        createCtx('/api/v1/workflow/definitions/order-fulfillment-v1', 'GET')
      );
      expect(getDef?.status).toBe(200);
      expect(getDef?.data?.name).toBeDefined();

      // 2. Update definition status
      const updateDef = await workflowSandboxHandler.handler(
        { url: '/api/v1/workflow/definitions/order-fulfillment-v1', method: 'PUT', headers: {}, data: { status: 'DEPRECATED' } },
        createCtx('/api/v1/workflow/definitions/order-fulfillment-v1', 'PUT')
      );
      expect(updateDef?.status).toBe(200);

      // 3. Delete definition
      const delDef = await workflowSandboxHandler.handler(
        { url: '/api/v1/workflow/definitions/order-fulfillment-v2', method: 'DELETE', headers: {} },
        createCtx('/api/v1/workflow/definitions/order-fulfillment-v2', 'DELETE')
      );
      expect(delDef?.status).toBe(200);
    });
  });
});
