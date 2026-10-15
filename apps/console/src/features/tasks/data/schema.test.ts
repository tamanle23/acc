import { describe, it, expect } from 'vitest';
import { workflowExecutionSchema, taskSchema } from '../data/schema';

describe('Workflow Execution Schema Tests', () => {
  it('validates a complete workflow execution instance with activeStep', () => {
    const raw = {
      id: 'wf_exec_101',
      title: 'Order Approval Workflow #101',
      status: 'IN_PROGRESS',
      label: 'workflow',
      priority: 'high',
      workflowId: 'order-approval-v1',
      workflowName: 'Order Approval Workflow',
      activeStep: 'creditCheck',
      taskReferenceName: 'creditCheck',
      durationMs: 320,
      inputData: { customerId: 'cust_982' },
      outputData: { approved: true, limit: 5000 },
    };

    const parsed = workflowExecutionSchema.parse(raw);
    expect(parsed.id).toBe('wf_exec_101');
    expect(parsed.workflowId).toBe('order-approval-v1');
    expect(parsed.activeStep).toBe('creditCheck');
    expect(parsed.status).toBe('IN_PROGRESS');
    expect(parsed.taskType).toBeUndefined(); // Internal taskType is optional and encapsulated
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
    expect(parsed.status).toBe('todo');
  });

  it('validates completed workflow execution instances', () => {
    const completedExec = {
      id: 'wf_exec_completed_1',
      title: 'Invoice Billing Pipeline #1',
      status: 'COMPLETED',
      workflowId: 'invoice-billing-v1',
      activeStep: 'Completed (All Steps)',
      durationMs: 125,
    };

    const parsed = workflowExecutionSchema.parse(completedExec);
    expect(parsed.status).toBe('COMPLETED');
    expect(parsed.activeStep).toBe('Completed (All Steps)');
    expect(parsed.durationMs).toBe(125);
  });
});
