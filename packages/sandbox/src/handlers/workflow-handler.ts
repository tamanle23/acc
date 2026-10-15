import type { SandboxRouteHandler, SandboxResponse, SandboxRequest } from '../types';
import { defaultSandboxStore } from '../store';
import { sandboxResetRegistry } from '../reset-registry';

export interface WorkflowDefinitionIR {
  workflowKey: string;
  version: number;
  name: string;
  description?: string;
  tasks: any[];
  layoutMetadata?: Record<string, { x: number; y: number }>;
  status?: 'ACTIVE' | 'DISABLED';
  updatedAt?: string;
  tenantId?: string;
}

export interface WorkflowExecution {
  workflowId: string;
  tenantId: string;
  workspaceId?: string;
  workflowKey: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TERMINATED';
  currentStep?: string;
  tasks: Array<{
    taskId: string;
    taskReferenceName: string;
    taskType: string;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    output?: Record<string, unknown>;
  }>;
}

const DEFAULT_DEFINITIONS: WorkflowDefinitionIR[] = [
  {
    workflowKey: 'order-fulfillment-v1',
    name: 'Order Fulfillment Pipeline',
    version: 1,
    description: 'Multi-stage e-commerce order routing, automated warehouse allocation, and postal delivery.',
    status: 'ACTIVE',
    updatedAt: '2 hours ago',
    tasks: [
      {
        taskReferenceName: 'checkInventory',
        taskType: 'SIMPLE',
        domain: 'inventory',
        timeoutSeconds: 15,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: { orderId: '${workflow.input.orderId}' },
      },
      {
        taskReferenceName: 'routeShipping',
        taskType: 'SWITCH',
        condition: '${workflow.input.speed}',
        decisionCases: {
          EXPRESS: ['expressCourier'],
          STANDARD: ['groundPostal'],
        },
        defaultCase: ['groundPostal'],
      },
      {
        taskReferenceName: 'expressCourier',
        taskType: 'SIMPLE',
        domain: 'shipping',
        timeoutSeconds: 30,
        retryCount: 3,
        inputParameters: { trackingNumber: '${checkInventory.output.trackingNumber}' },
        compensateHandlerRef: 'cancelCourierBooking',
      },
      {
        taskReferenceName: 'groundPostal',
        taskType: 'SIMPLE',
        domain: 'shipping',
        timeoutSeconds: 30,
        retryCount: 2,
        inputParameters: { postalCode: '${workflow.input.postalCode}' },
      },
    ],
    layoutMetadata: {
      checkInventory: { x: 50, y: 150 },
      routeShipping: { x: 340, y: 150 },
      expressCourier: { x: 620, y: 70 },
      groundPostal: { x: 620, y: 230 },
    },
  },
  {
    workflowKey: 'checkout-pipeline-v2',
    name: 'Checkout & Payment Settlement',
    version: 2,
    description: '3D Secure payment validation, fraud check telemetry, and transaction ledger entry.',
    status: 'ACTIVE',
    updatedAt: 'Yesterday',
    tasks: [
      {
        taskReferenceName: 'validateCard',
        taskType: 'SIMPLE',
        domain: 'payment',
        timeoutSeconds: 20,
      },
      {
        taskReferenceName: 'waitCustomer3DS',
        taskType: 'WAIT',
        timeoutSeconds: 300,
      },
      {
        taskReferenceName: 'settleLedger',
        taskType: 'SIMPLE',
        domain: 'payment',
        timeoutSeconds: 15,
      },
    ],
    layoutMetadata: {
      validateCard: { x: 80, y: 120 },
      waitCustomer3DS: { x: 340, y: 120 },
      settleLedger: { x: 600, y: 120 },
    },
  },
  {
    workflowKey: 'invoice-billing-v1',
    name: 'Monthly Billing & Tax Reconciliation',
    version: 1,
    description: 'Automated VAT calculation, PDF generation, and customer notification dispatch.',
    status: 'DISABLED',
    updatedAt: '3 days ago',
    tasks: [
      {
        taskReferenceName: 'calcTaxes',
        taskType: 'SIMPLE',
        domain: 'billing',
      },
      {
        taskReferenceName: 'parallelNotifyAndInvoice',
        taskType: 'FORK_JOIN',
      },
      {
        taskReferenceName: 'archiveInvoice',
        taskType: 'SIMPLE',
        domain: 'storage',
      },
    ],
    layoutMetadata: {
      calcTaxes: { x: 80, y: 100 },
      parallelNotifyAndInvoice: { x: 320, y: 100 },
      archiveInvoice: { x: 580, y: 100 },
    },
  },
];

export class WorkflowSandboxRepository {
  private tenantDefinitions: Map<string, Map<string, WorkflowDefinitionIR>> = new Map();
  private tenantExecutions: Map<string, Map<string, WorkflowExecution>> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  private getActiveTenantId(): string {
    return defaultSandboxStore.getState().activeTenantId || 'tenant-acme';
  }

  private getDefinitionMap(tenantId?: string): Map<string, WorkflowDefinitionIR> {
    const tid = tenantId || this.getActiveTenantId();
    if (!this.tenantDefinitions.has(tid)) {
      const initialMap = new Map<string, WorkflowDefinitionIR>();
      DEFAULT_DEFINITIONS.forEach((d) => {
        initialMap.set(d.workflowKey, JSON.parse(JSON.stringify(d)));
      });
      this.tenantDefinitions.set(tid, initialMap);
    }
    return this.tenantDefinitions.get(tid)!;
  }

  private getExecutionMap(tenantId?: string): Map<string, WorkflowExecution> {
    const tid = tenantId || this.getActiveTenantId();
    if (!this.tenantExecutions.has(tid)) {
      this.tenantExecutions.set(tid, new Map());
    }
    return this.tenantExecutions.get(tid)!;
  }

  public reset(): void {
    this.tenantDefinitions.clear();
    this.tenantExecutions.clear();

    const seedTenants = ['SYSTEM', 'tenant-acme', 'tenant-us-east-1', 'tenant-eu-central-1', 'tenant-us-west-2'];
    seedTenants.forEach((tid) => {
      const defMap = new Map<string, WorkflowDefinitionIR>();
      DEFAULT_DEFINITIONS.forEach((d) => {
        defMap.set(d.workflowKey, { ...JSON.parse(JSON.stringify(d)), tenantId: tid });
      });
      this.tenantDefinitions.set(tid, defMap);
    });
  }

  public getDefinitions(tenantId?: string): WorkflowDefinitionIR[] {
    return Array.from(this.getDefinitionMap(tenantId).values());
  }

  public getDefinition(key: string, tenantId?: string): WorkflowDefinitionIR | undefined {
    return this.getDefinitionMap(tenantId).get(key);
  }

  public saveDefinition(def: WorkflowDefinitionIR, tenantId?: string): WorkflowDefinitionIR {
    const map = this.getDefinitionMap(tenantId);
    const existing = map.get(def.workflowKey);
    const record: WorkflowDefinitionIR = {
      ...existing,
      ...def,
      updatedAt: 'Just now',
      version: existing ? (existing.version || 1) + 1 : def.version || 1,
      status: def.status || existing?.status || 'ACTIVE',
    };
    map.set(def.workflowKey, record);
    return record;
  }

  public toggleStatus(key: string, status: 'ACTIVE' | 'DISABLED', tenantId?: string): WorkflowDefinitionIR | null {
    const map = this.getDefinitionMap(tenantId);
    const found = map.get(key);
    if (!found) return null;
    found.status = status;
    found.updatedAt = 'Just now';
    return found;
  }

  public deleteDefinition(key: string, tenantId?: string): boolean {
    return this.getDefinitionMap(tenantId).delete(key);
  }

  public startExecution(workflowKey: string, input: Record<string, unknown> = {}, tenantId?: string): WorkflowExecution {
    const tid = tenantId || this.getActiveTenantId();
    const def = this.getDefinition(workflowKey, tid);
    const execMap = this.getExecutionMap(tid);

    const workflowId = `wf_exec_${Date.now()}`;
    const tasks = def?.tasks
      ? def.tasks.map((t: any, idx: number) => ({
          taskId: `${workflowId}_${t.taskReferenceName}_${idx + 1}`,
          taskReferenceName: t.taskReferenceName,
          taskType: t.taskType || 'SIMPLE',
          status: (idx === 0 ? 'SCHEDULED' : 'PENDING') as any,
          output: idx === 0 ? { orderId: input.orderId || 'ord_auto' } : undefined,
        }))
      : [
          {
            taskId: `${workflowId}_step1`,
            taskReferenceName: 'step1',
            taskType: 'SIMPLE',
            status: 'SCHEDULED' as any,
          },
        ];

    const execution: WorkflowExecution = {
      workflowId,
      tenantId: tid,
      workflowKey,
      status: 'RUNNING',
      currentStep: tasks[0]?.taskReferenceName || 'Initializing',
      tasks,
    };

    execMap.set(workflowId, execution);
    return execution;
  }

  public getExecution(workflowId: string, tenantId?: string): WorkflowExecution | undefined {
    return this.getExecutionMap(tenantId).get(workflowId);
  }

  public terminateExecution(workflowId: string, tenantId?: string): boolean {
    const exec = this.getExecutionMap(tenantId).get(workflowId);
    if (!exec) return false;
    exec.status = 'TERMINATED';
    return true;
  }
}

export const workflowSandboxRepo = new WorkflowSandboxRepository();

export const workflowSandboxHandler: SandboxRouteHandler = {
  id: 'workflow-sandbox-handler',
  name: 'Workflow Orchestration Sandbox Simulator',
  description: 'Enterprise multi-tenant mock repository for Workflows CRUD, execution SSE streams, and worker leases',
  priority: 95,
  matcher: (ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    return cleanPath.startsWith('/workflow');
  },
  handler: (req: SandboxRequest, context): SandboxResponse => {
    const method = req.method.toUpperCase();
    const { pathname } = context;
    const cleanPath = pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    const tenantId = (req.headers?.['x-tenant-id'] as string) || defaultSandboxStore.getState().activeTenantId || 'tenant-acme';

    // 0. Workflow Definitions Catalog: /workflow/definitions
    if (cleanPath === '/workflow/definitions' || cleanPath === '/workflow/definitions/') {
      if (method === 'GET') {
        const definitions = workflowSandboxRepo.getDefinitions(tenantId);
        return {
          status: 200,
          data: definitions,
        };
      }
      if (method === 'POST') {
        const body = (req.data || {}) as WorkflowDefinitionIR;
        if (!body.workflowKey) {
          return { status: 400, data: { error: 'workflowKey is required' } };
        }
        const created = workflowSandboxRepo.saveDefinition(body, tenantId);
        return { status: 201, data: created };
      }
    }

    // 0.1 Single Definition Operations: /workflow/definitions/{key}
    const defKeyMatch = cleanPath.match(/^\/workflow\/definitions\/([^/]+)$/);
    if (defKeyMatch) {
      const key = defKeyMatch[1];

      if (method === 'GET') {
        const found = workflowSandboxRepo.getDefinition(key, tenantId);
        if (found) {
          return { status: 200, data: found };
        }
        return { status: 404, data: { error: `Workflow definition ${key} not found` } };
      }

      if (method === 'PUT' || method === 'PATCH') {
        const body = (req.data || {}) as Partial<WorkflowDefinitionIR>;
        if (body.status) {
          const updated = workflowSandboxRepo.toggleStatus(key, body.status as any, tenantId);
          if (updated) return { status: 200, data: updated };
        }
        const existing = workflowSandboxRepo.getDefinition(key, tenantId);
        if (!existing) {
          return { status: 404, data: { error: `Workflow definition ${key} not found` } };
        }
        const updated = workflowSandboxRepo.saveDefinition({ ...existing, ...body }, tenantId);
        return { status: 200, data: updated };
      }

      if (method === 'DELETE') {
        const existed = workflowSandboxRepo.deleteDefinition(key, tenantId);
        return { status: existed ? 200 : 404, data: { success: existed, deletedKey: key } };
      }
    }

    // 1. Start Workflow Execution: POST /workflow/executions
    if (cleanPath === '/workflow/executions' && method === 'POST') {
      const body = (req.data || {}) as Record<string, any>;
      const workflowKey = body.workflowKey || 'order-fulfillment-v1';
      const execution = workflowSandboxRepo.startExecution(workflowKey, body.input || {}, tenantId);
      return { status: 201, data: execution };
    }

    // 2. Query Execution Snapshot: GET /workflow/executions/{id}
    const execSnapshotMatch = cleanPath.match(/^\/workflow\/executions\/([^/]+)$/);
    if (execSnapshotMatch && method === 'GET') {
      const execId = execSnapshotMatch[1];
      const found = workflowSandboxRepo.getExecution(execId, tenantId);
      if (found) {
        return { status: 200, data: found };
      }
      return { status: 404, data: { error: `Execution ${execId} not found` } };
    }

    // 3. Terminate Execution: POST /workflow/executions/{id}/terminate
    const execTermMatch = cleanPath.match(/^\/workflow\/executions\/([^/]+)\/terminate$/);
    if (execTermMatch && method === 'POST') {
      const execId = execTermMatch[1];
      const success = workflowSandboxRepo.terminateExecution(execId, tenantId);
      if (success) {
        return { status: 200, data: { terminated: true, workflowId: execId } };
      }
      return { status: 404, data: { error: `Execution ${execId} not found` } };
    }

    // 4. Simulated SSE Events: GET /workflow/executions/{id}/events
    const sseMatch = cleanPath.match(/^\/workflow\/executions\/([^/]+)\/events$/);
    if (sseMatch && method === 'GET') {
      const execId = sseMatch[1];
      const events = [
        { event: 'CONNECTED', data: { executionId: execId, status: 'CONNECTED' } },
        { event: 'TASK_IN_PROGRESS', data: { executionId: execId, taskReferenceName: 'checkInventory', status: 'IN_PROGRESS' } },
        { event: 'TASK_COMPLETED', data: { executionId: execId, taskReferenceName: 'checkInventory', status: 'COMPLETED' } },
        { event: 'TASK_IN_PROGRESS', data: { executionId: execId, taskReferenceName: 'routeShipping', status: 'IN_PROGRESS' } },
        { event: 'TASK_COMPLETED', data: { executionId: execId, taskReferenceName: 'routeShipping', status: 'COMPLETED' } },
        { event: 'TASK_IN_PROGRESS', data: { executionId: execId, taskReferenceName: 'expressCourier', status: 'IN_PROGRESS' } },
        { event: 'TASK_COMPLETED', data: { executionId: execId, taskReferenceName: 'expressCourier', status: 'COMPLETED' } },
        { event: 'WORKFLOW_COMPLETED', data: { executionId: execId, status: 'COMPLETED' } },
      ];
      return {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        data: events,
      };
    }

    // 5. Worker Polling: GET /workflow/tasks/poll
    if (cleanPath.endsWith('/poll') && method === 'GET') {
      return { status: 200, data: [] };
    }

    // 6. Worker Result Report: POST /workflow/tasks/{id}/result
    if (cleanPath.includes('/tasks/') && cleanPath.endsWith('/result') && method === 'POST') {
      return { status: 200, data: { success: true } };
    }

    // 7. Worker Heartbeat: POST /workflow/tasks/{id}/heartbeat
    if (cleanPath.includes('/tasks/') && cleanPath.endsWith('/heartbeat') && method === 'POST') {
      return { status: 200, data: { renewed: true } };
    }

    return { status: 404, data: { error: 'Workflow endpoint not found' } };
  },
};

export function resetWorkflowSandbox(): void {
  workflowSandboxRepo.reset();
}
