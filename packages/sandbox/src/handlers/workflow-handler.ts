import type { SandboxRouteHandler, SandboxResponse } from '../types';

interface WorkflowExecution {
  workflowId: string;
  tenantId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  tasks: Array<{
    taskId: string;
    taskReferenceName: string;
    taskType: string;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    output?: Record<string, unknown>;
  }>;
}

const mockExecutions = new Map<string, WorkflowExecution>();

export const workflowSandboxHandler: SandboxRouteHandler = {
  id: 'workflow-sandbox-handler',
  name: 'Workflow Orchestration Sandbox Simulator',
  matcher: (ctx) => {
    return ctx.pathname.startsWith('/api/v1/workflow');
  },
  handler: (req, context): SandboxResponse => {
    const method = req.method.toUpperCase();
    const { pathname, searchParams } = context;

    // 1. Poll tasks
    if (pathname.endsWith('/poll') && method === 'GET') {
      const taskType = searchParams.get('taskType') || 'SIMPLE';
      const tenantId = searchParams.get('tenantId') || 'system';

      // Find any scheduled tasks
      for (const exec of mockExecutions.values()) {
        if (exec.tenantId === tenantId && exec.status === 'RUNNING') {
          const task = exec.tasks.find((t) => t.status === 'SCHEDULED' && t.taskType === taskType);
          if (task) {
            task.status = 'IN_PROGRESS';
            return {
              status: 200,
              data: [
                {
                  taskId: task.taskId,
                  taskReferenceName: task.taskReferenceName,
                  taskType: task.taskType,
                  domain: 'default',
                  status: 'IN_PROGRESS',
                  attempt: 1,
                  inputData: { simulated: true },
                  outputData: {},
                  visibleAtEpochMs: Date.now(),
                  responseTimeoutMs: 30000,
                },
              ],
            };
          }
        }
      }
      return { status: 200, data: [] };
    }

    // 2. Report task result
    if (pathname.includes('/tasks/') && pathname.endsWith('/result') && method === 'POST') {
      const parts = pathname.split('/');
      const taskId = parts[parts.length - 2];
      const body = (req.data || {}) as Record<string, any>;

      for (const exec of mockExecutions.values()) {
        const task = exec.tasks.find((t) => t.taskId === taskId);
        if (task) {
          task.status = body.completed ? 'COMPLETED' : 'FAILED';
          task.output = body.output;

          const allDone = exec.tasks.every((t) => t.status === 'COMPLETED');
          if (allDone) {
            exec.status = 'COMPLETED';
          }
          return { status: 200, data: { success: true } };
        }
      }
      return { status: 200, data: { success: true } };
    }

    // 3. Heartbeat
    if (pathname.includes('/tasks/') && pathname.endsWith('/heartbeat') && method === 'POST') {
      return { status: 200, data: { renewed: true } };
    }

    // 4. Start workflow
    if (pathname.endsWith('/executions') && method === 'POST') {
      const body = (req.data || {}) as Record<string, any>;
      const workflowId = `wf_sim_${Date.now()}`;
      const exec: WorkflowExecution = {
        workflowId,
        tenantId: body.tenantId || 'system',
        status: 'RUNNING',
        tasks: [
          {
            taskId: `${workflowId}_step1_att1`,
            taskReferenceName: 'step1',
            taskType: 'SIMPLE',
            status: 'SCHEDULED',
          },
        ],
      };
      mockExecutions.set(workflowId, exec);
      return { status: 201, data: exec };
    }

    return { status: 404, data: { error: 'Workflow endpoint not found' } };
  },
};

export function resetWorkflowSandbox(): void {
  mockExecutions.clear();
}
