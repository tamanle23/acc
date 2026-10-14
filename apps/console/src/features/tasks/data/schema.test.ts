import { describe, it, expect } from 'vitest';
import { workflowTaskExecutionSchema, taskSchema } from '../data/schema';

describe('Workflow Task Execution Schema Tests', () => {
  it('validates a complete workflow execution unit task', () => {
    const raw = {
      id: 'tsk_wf_101',
      taskId: 'tsk_wf_101',
      title: 'Execute Credit Check',
      status: 'IN_PROGRESS',
      label: 'workflow',
      priority: 'high',
      workflowId: 'order-approval-v1',
      workflowName: 'Order Approval Workflow',
      taskReferenceName: 'creditCheck',
      taskType: 'SIMPLE',
      leaseOwner: 'worker-node-1',
      attempt: 2,
      maxRetries: 3,
      pollDomain: 'finance-domain',
      durationMs: 320,
      inputData: { customerId: 'cust_982' },
      outputData: { approved: true, limit: 5000 },
    };

    const parsed = workflowTaskExecutionSchema.parse(raw);
    expect(parsed.id).toBe('tsk_wf_101');
    expect(parsed.workflowId).toBe('order-approval-v1');
    expect(parsed.taskType).toBe('SIMPLE');
    expect(parsed.status).toBe('IN_PROGRESS');
    expect(parsed.leaseOwner).toBe('worker-node-1');
  });

  it('validates legacy tasks with backward compatibility', () => {
    const legacy = {
      id: 'TASK-1234',
      title: 'Fix typo on landing page',
      status: 'todo',
      label: 'bug',
      priority: 'low',
    };

    const parsed = taskSchema.parse(legacy);
    expect(parsed.id).toBe('TASK-1234');
    expect(parsed.taskType).toBe('SIMPLE'); // Default
    expect(parsed.status).toBe('todo');
  });

  it('validates switch and fork workflow tasks', () => {
    const switchTask = {
      id: 'tsk_wf_switch_1',
      title: 'Branch on Payment Method',
      status: 'COMPLETED',
      workflowId: 'checkout-wf',
      taskReferenceName: 'switchPayment',
      taskType: 'SWITCH',
    };

    const parsed = taskSchema.parse(switchTask);
    expect(parsed.taskType).toBe('SWITCH');
    expect(parsed.status).toBe('COMPLETED');
  });
});
