import { describe, it, expect, beforeEach } from 'vitest';
import {
  workflowSandboxRepo,
  workflowExecutionsSandboxRepo,
} from '../workflow-handler';
import { dlqSandboxRepo } from '../dlq-sandbox-handler';
import { defaultSandboxStore } from '../../store';

describe('Workflows, Workflow Executions, and DLQ Cross-Store Consistency Test Suite', () => {
  beforeEach(() => {
    defaultSandboxStore.resetToDefaults();
    workflowSandboxRepo.reset();
    workflowExecutionsSandboxRepo.reset();
    dlqSandboxRepo.reset();
  });

  it('guarantees every workflow execution references an existing workflow definition', () => {
    const executions = workflowExecutionsSandboxRepo.getAll('tenant-acme');
    const definitions = workflowSandboxRepo.getDefinitions('tenant-acme');
    const defKeys = new Set(definitions.map((d) => d.workflowKey));

    expect(executions.length).toBeGreaterThanOrEqual(8);
    for (const exec of executions) {
      expect(exec.workflowId).toBeDefined();
      expect(defKeys.has(exec.workflowId!)).toBe(true);

      // Verify execution DAG snapshot also exists and aligns
      const dag = workflowSandboxRepo.getExecution(exec.id, 'tenant-acme');
      expect(dag).toBeDefined();
      expect(dag?.workflowKey).toBe(exec.workflowId);
      expect(dag?.status).toBe(exec.status);
    }
  });

  it('guarantees every DLQ poison record references an existing workflow execution and task', () => {
    const dlqRecords = dlqSandboxRepo.list(undefined, 100, 'tenant-acme');
    expect(dlqRecords.length).toBeGreaterThanOrEqual(4);

    for (const dlq of dlqRecords) {
      const exec = workflowExecutionsSandboxRepo.getById(dlq.workflowId, 'tenant-acme');
      expect(exec).toBeDefined();
      expect(exec?.taskId).toBe(dlq.taskId);

      // Verify that isolated DLQ items match failed workflow executions
      if (dlq.status === 'ISOLATED') {
        expect(exec?.status).toBe('FAILED');
        expect(exec?.outputData?.dlqId).toBe(dlq.dlqId);
      }
    }
  });

  it('synchronizes execution state when a DLQ item is replayed', () => {
    const dlqId = 'dlq-101';
    const targetDlq = dlqSandboxRepo.getById(dlqId, 'tenant-acme')!;
    expect(targetDlq.status).toBe('ISOLATED');

    const execBefore = workflowExecutionsSandboxRepo.getById(targetDlq.workflowId, 'tenant-acme')!;
    expect(execBefore.status).toBe('FAILED');
    expect(execBefore.attempt).toBe(3);

    // Perform interactive replay with payload overrides
    const overrides = { amount: 299.0, note: 'Approved customer waiver' };
    const replayed = dlqSandboxRepo.replay(dlqId, overrides, 'tenant-acme');

    expect(replayed).toBeDefined();
    expect(replayed?.status).toBe('REPLAYED');
    expect(replayed?.payloadSnapshot).toMatchObject(overrides);

    // Verify workflow execution automatically transitioned to IN_PROGRESS
    const execAfter = workflowExecutionsSandboxRepo.getById(targetDlq.workflowId, 'tenant-acme')!;
    expect(execAfter.status).toBe('IN_PROGRESS');
    expect(execAfter.attempt).toBe(4);
    expect(execAfter.errorMessage).toBeUndefined();
    expect(execAfter.outputData?.dlqStatus).toBe('REPLAYED');
    expect(execAfter.outputData?.retryStatus).toBe('RE-ENQUEUED');

    // Verify active DAG studio graph also transitioned to RUNNING
    const dagAfter = workflowSandboxRepo.getExecution(targetDlq.workflowId, 'tenant-acme');
    expect(dagAfter?.status).toBe('RUNNING');
    const quarantinedTask = dagAfter?.tasks.find((t) => t.taskId === targetDlq.taskId);
    expect(quarantinedTask?.status).toBe('SCHEDULED');
  });

  it('synchronizes execution state when a DLQ item is discarded', () => {
    const dlqId = 'dlq-101';
    const targetDlq = dlqSandboxRepo.getById(dlqId, 'tenant-acme')!;
    expect(targetDlq.status).toBe('ISOLATED');

    const discarded = dlqSandboxRepo.discard(dlqId, 'tenant-acme');
    expect(discarded).toBe(true);

    const dlqAfter = dlqSandboxRepo.getById(dlqId, 'tenant-acme');
    expect(dlqAfter?.status).toBe('DISCARDED');

    const execAfter = workflowExecutionsSandboxRepo.getById(targetDlq.workflowId, 'tenant-acme')!;
    expect(execAfter.outputData?.dlqStatus).toBe('DISCARDED');
  });
});
