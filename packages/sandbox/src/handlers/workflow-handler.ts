import type { SandboxRouteHandler, SandboxResponse, SandboxRequest } from '../types';
import { defaultSandboxStore } from '../store';
import { sandboxResetRegistry } from '../reset-registry';
import { workflowExecutions } from './data/workflow-executions';
import type { WorkflowExecution as ClientWorkflowExecution } from '@unipost/client';

export class WorkflowExecutionsSandboxRepository {
  private tenantWorkflowExecutions: Map<string, ClientWorkflowExecution[]> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  private getActiveTenantId(): string {
    return defaultSandboxStore.getState().activeTenantId || 'tenant-acme';
  }

  private getTenantList(tenantId?: string): ClientWorkflowExecution[] {
    const tid = tenantId || this.getActiveTenantId();
    if (!this.tenantWorkflowExecutions.has(tid)) {
      this.tenantWorkflowExecutions.set(tid, JSON.parse(JSON.stringify(workflowExecutions)));
    }
    return this.tenantWorkflowExecutions.get(tid)!;
  }

  public reset(): void {
    this.tenantWorkflowExecutions.clear();
    this.tenantWorkflowExecutions.set('SYSTEM', JSON.parse(JSON.stringify(workflowExecutions)));
    this.tenantWorkflowExecutions.set('tenant-acme', JSON.parse(JSON.stringify(workflowExecutions)));
    this.tenantWorkflowExecutions.set(
      'tenant-us-east-1',
      (workflowExecutions as ClientWorkflowExecution[]).slice(0, 5).map((t, idx) => ({
        ...t,
        id: `TASK-US-${1000 + idx}`,
        title: `[US-EAST] ${t.title}`,
      }))
    );
  }

  public getAll(tenantId?: string): ClientWorkflowExecution[] {
    return [...this.getTenantList(tenantId)];
  }

  public getById(id: string, tenantId?: string): ClientWorkflowExecution | undefined {
    return this.getTenantList(tenantId).find((t) => t.id === id);
  }

  public create(task: ClientWorkflowExecution, tenantId?: string): ClientWorkflowExecution {
    const list = this.getTenantList(tenantId);
    list.unshift(task);
    return task;
  }

  public update(id: string, patch: Partial<ClientWorkflowExecution>, tenantId?: string): ClientWorkflowExecution | null {
    const list = this.getTenantList(tenantId);
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: new Date() };
    return list[idx];
  }

  public delete(id: string, tenantId?: string): boolean {
    const tid = tenantId || this.getActiveTenantId();
    const list = this.getTenantList(tid);
    const beforeLen = list.length;
    const filtered = list.filter((t) => t.id !== id);
    this.tenantWorkflowExecutions.set(tid, filtered);
    return filtered.length < beforeLen;
  }
}

export const workflowExecutionsSandboxRepo = new WorkflowExecutionsSandboxRepository();

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
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TERMINATED' | 'PAUSED_AT_BREAKPOINT';
  currentStep?: string;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  tasks: Array<{
    taskId: string;
    taskReferenceName: string;
    taskType: string;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'WAITING_FOR_APPROVAL';
    inputData?: Record<string, unknown>;
    output?: Record<string, unknown>;
    outputData?: Record<string, unknown>;
  }>;
  tasksByRef?: Record<string, any>;
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

export interface SandboxApprovalTask {
  id: string;
  taskId: string;
  workflowId: string;
  workflowKey: string;
  workflowName: string;
  taskReferenceName: string;
  status: 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'FAILED';
  assignee?: string;
  role?: string;
  instructions?: string;
  slaMinutes?: number;
  createdAt: string;
  dueAt?: string;
  claimedBy?: string | null;
  claimedAt?: string | number | null;
  slaBreached?: boolean;
  decision?: 'APPROVED' | 'REJECTED';
  decisionComment?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
}

const DEFAULT_APPROVALS: SandboxApprovalTask[] = [
  {
    id: 'appr_01',
    taskId: 'task_exec_901_complianceReview',
    workflowId: 'wf_exec_901',
    workflowKey: 'order-fulfillment-v1',
    workflowName: 'Order Fulfillment Pipeline',
    taskReferenceName: 'complianceReview',
    status: 'WAITING_FOR_APPROVAL',
    role: 'ROLE_COMPLIANCE_OFFICER',
    instructions: 'Verify international export declaration documents and customs clearance certificate.',
    slaMinutes: 120,
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() + 85 * 60 * 1000).toISOString(),
    claimedBy: null,
    claimedAt: null,
    slaBreached: false,
    inputData: {
      orderId: 'ORD-2026-9921',
      country: 'DE',
      declaredValue: 45000000,
      customerTier: 'ENTERPRISE',
    },
  },
  {
    id: 'appr_02',
    taskId: 'task_exec_902_financeSignoff',
    workflowId: 'wf_exec_902',
    workflowKey: 'invoice-billing-v1',
    workflowName: 'Monthly Billing & Tax Reconciliation',
    taskReferenceName: 'financeSignoff',
    status: 'WAITING_FOR_APPROVAL',
    role: 'ROLE_FINANCE_DIRECTOR',
    instructions: 'Approve VAT reconciliation exception for quarterly consolidated invoice batch.',
    slaMinutes: 30,
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    claimedBy: 'satnaing',
    claimedAt: Date.now() - 15 * 60 * 1000,
    slaBreached: true,
    inputData: {
      batchId: 'BATCH-2026-Q3-TAX',
      varianceAmount: 1245000,
      vatCode: 'VN-VAT-10',
    },
  },
];

export class WorkflowSandboxRepository {
  private tenantDefinitions: Map<string, Map<string, WorkflowDefinitionIR>> = new Map();
  private tenantExecutions: Map<string, Map<string, WorkflowExecution>> = new Map();
  private tenantApprovals: Map<string, SandboxApprovalTask[]> = new Map();

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

  private getApprovalList(tenantId?: string): SandboxApprovalTask[] {
    const tid = tenantId || this.getActiveTenantId();
    if (!this.tenantApprovals.has(tid)) {
      this.tenantApprovals.set(tid, JSON.parse(JSON.stringify(DEFAULT_APPROVALS)));
    }
    return this.tenantApprovals.get(tid)!;
  }

  public reset(): void {
    this.tenantDefinitions.clear();
    this.tenantExecutions.clear();
    this.tenantApprovals.clear();

    const seedTenants = ['SYSTEM', 'tenant-acme', 'tenant-us-east-1', 'tenant-eu-central-1', 'tenant-us-west-2'];
    seedTenants.forEach((tid) => {
      const defMap = new Map<string, WorkflowDefinitionIR>();
      DEFAULT_DEFINITIONS.forEach((d) => {
        defMap.set(d.workflowKey, { ...JSON.parse(JSON.stringify(d)), tenantId: tid });
      });
      this.tenantDefinitions.set(tid, defMap);
      this.tenantApprovals.set(tid, JSON.parse(JSON.stringify(DEFAULT_APPROVALS)));
    });
  }

  public getApprovals(tenantId?: string): SandboxApprovalTask[] {
    return this.getApprovalList(tenantId);
  }

  public claimApproval(taskId: string, userId: string = 'satnaing', tenantId?: string): SandboxApprovalTask | null {
    const list = this.getApprovalList(tenantId);
    const item = list.find((a) => a.taskId === taskId || a.id === taskId);
    if (!item) return null;
    item.claimedBy = userId;
    item.claimedAt = Date.now();
    return item;
  }

  public unclaimApproval(taskId: string, tenantId?: string): SandboxApprovalTask | null {
    const list = this.getApprovalList(tenantId);
    const item = list.find((a) => a.taskId === taskId || a.id === taskId);
    if (!item) return null;
    item.claimedBy = null;
    item.claimedAt = null;
    return item;
  }

  public resolveApproval(
    taskId: string,
    action: 'APPROVE' | 'REJECT',
    comment?: string,
    formData?: Record<string, unknown>,
    tenantId?: string
  ): SandboxApprovalTask | null {
    const list = this.getApprovalList(tenantId);
    const item = list.find((a) => a.taskId === taskId || a.id === taskId);
    if (!item) return null;
    item.status = action === 'APPROVE' ? 'COMPLETED' : 'FAILED';
    item.decision = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    item.decisionComment = comment;
    item.outputData = {
      decision: item.decision,
      decisionComment: comment,
      resolvedAt: Date.now(),
      ...(formData || {}),
    };
    return item;
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
      ? def.tasks.map((t: any, idx: number) => {
          const isHuman = t.taskType === 'HUMAN';
          let initialStatus = idx === 0 ? (isHuman ? 'WAITING_FOR_APPROVAL' : 'SCHEDULED') : 'PENDING';
          let output: any = undefined;
          if (idx === 0) {
            switch (t.taskType) {
              case 'HTTP':
                output = { status: 200, body: { success: true, url: t.httpParams?.url || 'https://api.example.com' } };
                break;
              case 'JDBC':
                output = { rows: [{ id: 1, executed: true }], rowsAffected: 1 };
                break;
              case 'JSON_JQ_TRANSFORM':
                output = { transformed: true, data: input };
                break;
              case 'INLINE':
                output = { evalResult: true, script: t.inlineParams?.expression || '' };
                break;
              case 'LLM_CHAT_COMPLETE':
                output = { text: 'Simulated LLM analysis response.', model: t.llmParams?.model || 'gpt-4o' };
                break;
              case 'CALL_MCP_TOOL':
                output = { toolSuccess: true, tool: t.mcpParams?.toolName || 'tool' };
                break;
              case 'KAFKA_PUBLISH':
                output = { topic: t.kafkaParams?.topic || 'order-events', partition: 0, offset: 1042 };
                break;
              case 'SET_VARIABLE':
                output = { variablesSet: input };
                break;
              default:
                output = { orderId: input.orderId || 'ord_auto', executed: true };
            }
          }
          return {
            taskId: `${workflowId}_${t.taskReferenceName}_${idx + 1}`,
            taskReferenceName: t.taskReferenceName,
            taskType: t.taskType || 'SIMPLE',
            status: initialStatus as any,
            output,
          };
        })
      : [
          {
            taskId: `${workflowId}_step1`,
            taskReferenceName: 'step1',
            taskType: 'SIMPLE',
            status: 'SCHEDULED' as any,
            output: { orderId: input.orderId || 'ord_auto' },
          },
        ];

    const breakpoints = Array.isArray(input.__breakpoints) ? (input.__breakpoints as string[]) : [];
    const firstRef = tasks[0]?.taskReferenceName;
    const isPausedInitially = Boolean(firstRef && breakpoints.includes(firstRef));
    if (isPausedInitially && tasks[0]) {
      tasks[0].status = 'SCHEDULED';
    }

    const tasksByRef: Record<string, any> = {};
    for (const t of tasks) {
      tasksByRef[t.taskReferenceName] = {
        ...t,
        inputData: (t as any).inputData || input,
        outputData: t.output || {},
      };
    }

    const execution: WorkflowExecution = {
      workflowId,
      tenantId: tid,
      workflowKey,
      status: isPausedInitially ? 'PAUSED_AT_BREAKPOINT' : 'RUNNING',
      currentStep: firstRef || 'Initializing',
      inputPayload: { ...input, __breakpoints: breakpoints },
      outputPayload: isPausedInitially ? { pausedAtNode: firstRef } : {},
      variables: { ...input },
      tasks,
      tasksByRef,
    };

    execMap.set(workflowId, execution);
    return execution;
  }

  public getExecution(workflowId: string, tenantId?: string): WorkflowExecution | undefined {
    return this.getExecutionMap(tenantId).get(workflowId);
  }

  public updateBreakpoints(workflowId: string, breakpoints: string[], tenantId?: string): WorkflowExecution | null {
    const exec = this.getExecutionMap(tenantId).get(workflowId);
    if (!exec) return null;
    exec.inputPayload = { ...(exec.inputPayload || {}), __breakpoints: breakpoints };
    return exec;
  }

  public pauseExecution(workflowId: string, tenantId?: string): WorkflowExecution | null {
    const exec = this.getExecutionMap(tenantId).get(workflowId);
    if (!exec) return null;
    exec.status = 'PAUSED_AT_BREAKPOINT';
    const activeTask = exec.tasks.find((t) => t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS') || exec.tasks[0];
    if (activeTask) {
      exec.currentStep = activeTask.taskReferenceName;
      exec.outputPayload = { ...(exec.outputPayload || {}), pausedAtNode: activeTask.taskReferenceName };
    }
    return exec;
  }

  public resumeExecution(workflowId: string, tenantId?: string): WorkflowExecution | null {
    const exec = this.getExecutionMap(tenantId).get(workflowId);
    if (!exec) return null;
    exec.status = 'RUNNING';
    if (exec.outputPayload) {
      delete exec.outputPayload.pausedAtNode;
    }
    return exec;
  }

  public stepOverExecution(workflowId: string, tenantId?: string): WorkflowExecution | null {
    const exec = this.getExecutionMap(tenantId).get(workflowId);
    if (!exec) return null;
    const pausedNode = (exec.outputPayload?.pausedAtNode as string) || exec.currentStep;
    const idx = exec.tasks.findIndex((t) => t.taskReferenceName === pausedNode);
    if (idx >= 0) {
      exec.tasks[idx].status = 'COMPLETED';
      exec.tasks[idx].output = exec.tasks[idx].output || { steppedOver: true, completedAt: new Date().toISOString() };
      if (exec.tasksByRef && exec.tasksByRef[pausedNode!]) {
        exec.tasksByRef[pausedNode!].status = 'COMPLETED';
        exec.tasksByRef[pausedNode!].outputData = exec.tasks[idx].output;
      }
      const nextTask = exec.tasks[idx + 1];
      if (nextTask) {
        nextTask.status = 'SCHEDULED';
        exec.currentStep = nextTask.taskReferenceName;
        exec.status = 'PAUSED_AT_BREAKPOINT';
        exec.outputPayload = { ...(exec.outputPayload || {}), pausedAtNode: nextTask.taskReferenceName };
      } else {
        exec.status = 'COMPLETED';
        exec.outputPayload = { completedAt: new Date().toISOString() };
      }
    } else {
      exec.status = 'RUNNING';
    }
    return exec;
  }

  public rerunTaskFromNode(
    workflowId: string,
    taskRef: string,
    modifiedInput: Record<string, unknown>,
    tenantId?: string
  ): WorkflowExecution | null {
    const exec = this.getExecutionMap(tenantId).get(workflowId);
    if (!exec) return null;
    const task = exec.tasks.find((t) => t.taskReferenceName === taskRef);
    if (task) {
      task.status = 'SCHEDULED';
      task.inputData = { ...(task.inputData || {}), ...modifiedInput };
      task.output = { rerunWithInput: modifiedInput, timestamp: Date.now() };
      if (exec.tasksByRef && exec.tasksByRef[taskRef]) {
        exec.tasksByRef[taskRef].status = 'SCHEDULED';
        exec.tasksByRef[taskRef].inputData = task.inputData;
        exec.tasksByRef[taskRef].outputData = task.output;
      }
    }
    exec.status = 'RUNNING';
    exec.currentStep = taskRef;
    exec.variables = { ...(exec.variables || {}), ...modifiedInput };
    return exec;
  }

  public terminateExecution(workflowId: string, tenantId?: string): boolean {
    const exec = this.getExecutionMap(tenantId).get(workflowId);
    if (!exec) return false;
    exec.status = 'TERMINATED';
    return true;
  }
}

export const workflowSandboxRepo = new WorkflowSandboxRepository();
// Backward compatibility alias for tasks
export const tasksSandboxRepo = workflowExecutionsSandboxRepo;

export const workflowSandboxHandler: SandboxRouteHandler = {
  id: 'workflow-sandbox-handler',
  name: 'Workflow Orchestration Sandbox Simulator',
  description: 'Enterprise multi-tenant mock repository for Workflows CRUD, execution SSE streams, and worker leases',
  priority: 95,
  matcher: (ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    return cleanPath.startsWith('/workflow') || cleanPath.startsWith('/workflow-executions');
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

    // 1. Workflow Executions Collection: GET & POST /workflow/executions or /workflow-executions
    if (cleanPath === '/workflow/executions' || cleanPath === '/workflow/executions/' || cleanPath === '/workflow-executions' || cleanPath === '/workflow-executions/') {
      if (method === 'GET') {
        return { status: 200, data: workflowExecutionsSandboxRepo.getAll(tenantId) };
      }
      if (method === 'POST') {
        const body = (req.data || {}) as Record<string, any>;
        // If it's a tabular task/execution record creation with title
        if (body.title) {
          const created = workflowExecutionsSandboxRepo.create(body as ClientWorkflowExecution, tenantId);
          return { status: 201, data: created };
        }
        // Otherwise, start workflow execution via workflowSandboxRepo
        const workflowKey = body.workflowKey || 'order-fulfillment-v1';
        const mergedInput = { ...(body.input || {}) };
        if (Array.isArray(body.breakpoints)) {
          mergedInput.__breakpoints = body.breakpoints;
        }
        const execution = workflowSandboxRepo.startExecution(workflowKey, mergedInput, tenantId);
        return { status: 201, data: execution };
      }
    }

    // 2. Simulated SSE Events: GET /workflow/executions/{id}/events
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

    // 2b. Debugger Endpoints: /breakpoints, /pause, /resume, /step, /tasks/:ref/rerun
    const bpMatch = cleanPath.match(/^\/workflow\/executions\/([^/]+)\/breakpoints$/);
    if (bpMatch && method === 'POST') {
      const execId = bpMatch[1];
      const bps = Array.isArray((req.data as any)?.breakpoints) ? (req.data as any).breakpoints : [];
      const updated = workflowSandboxRepo.updateBreakpoints(execId, bps, tenantId);
      return updated ? { status: 200, data: updated } : { status: 404, data: { error: 'Execution not found' } };
    }

    const pauseMatch = cleanPath.match(/^\/workflow\/executions\/([^/]+)\/pause$/);
    if (pauseMatch && method === 'POST') {
      const execId = pauseMatch[1];
      const updated = workflowSandboxRepo.pauseExecution(execId, tenantId);
      return updated ? { status: 200, data: updated } : { status: 404, data: { error: 'Execution not found' } };
    }

    const resumeMatch = cleanPath.match(/^\/workflow\/executions\/([^/]+)\/resume$/);
    if (resumeMatch && method === 'POST') {
      const execId = resumeMatch[1];
      const updated = workflowSandboxRepo.resumeExecution(execId, tenantId);
      return updated ? { status: 200, data: updated } : { status: 404, data: { error: 'Execution not found' } };
    }

    const stepMatch = cleanPath.match(/^\/workflow\/executions\/([^/]+)\/step$/);
    if (stepMatch && method === 'POST') {
      const execId = stepMatch[1];
      const updated = workflowSandboxRepo.stepOverExecution(execId, tenantId);
      return updated ? { status: 200, data: updated } : { status: 404, data: { error: 'Execution not found' } };
    }

    const replayOrRerunMatch = cleanPath.match(/^\/workflow\/executions\/([^/]+)\/tasks\/([^/]+)\/(?:rerun|replay)$/);
    if (replayOrRerunMatch && method === 'POST') {
      const execId = replayOrRerunMatch[1];
      const taskRef = decodeURIComponent(replayOrRerunMatch[2]);
      const body = (req.data as any) || {};
      const modifiedInput = (body.modifiedInput || body.overrideInput || body) as Record<string, unknown>;
      const updated = workflowSandboxRepo.rerunTaskFromNode(execId, taskRef, modifiedInput, tenantId);
      if (updated) {
        return { status: 200, data: updated };
      }
      // Fallback for static mock execution item: return synthesized rerun snapshot
      return {
        status: 200,
        data: {
          workflowId: execId,
          status: 'RUNNING',
          currentStep: taskRef,
          variables: modifiedInput,
          tasks: [
            {
              taskId: taskRef,
              taskReferenceName: taskRef,
              status: 'SCHEDULED',
              inputData: modifiedInput,
              output: { rerunWithInput: modifiedInput, timestamp: Date.now() },
            },
          ],
        },
      };
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

    // 4. Single Execution Operations: /workflow/executions/{id} or /workflow-executions/{id}
    const singleExecMatch = cleanPath.match(/^\/(?:workflow\/executions|workflow-executions)\/([^/]+)$/);
    if (singleExecMatch) {
      const execId = singleExecMatch[1];

      if (method === 'GET') {
        const executionItem = workflowExecutionsSandboxRepo.getById(execId, tenantId);
        if (executionItem) {
          return { status: 200, data: executionItem };
        }
        const activeInstance = workflowSandboxRepo.getExecution(execId, tenantId);
        if (activeInstance) {
          return { status: 200, data: activeInstance };
        }
        return { status: 404, data: { error: `Execution ${execId} not found` } };
      }

      if (method === 'PATCH' || method === 'PUT') {
        const updated = workflowExecutionsSandboxRepo.update(execId, req.data, tenantId);
        if (updated) {
          return { status: 200, data: updated };
        }
        return { status: 404, data: { error: `Execution ${execId} not found` } };
      }

      if (method === 'DELETE') {
        const deleted = workflowExecutionsSandboxRepo.delete(execId, tenantId);
        return { status: 200, data: { success: deleted } };
      }
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

    // 8. Human-in-the-Loop Approval Endpoints:
    // GET /workflow/tasks/approvals
    if ((cleanPath === '/workflow/tasks/approvals' || cleanPath === '/workflow/tasks/approvals/') && method === 'GET') {
      return { status: 200, data: workflowSandboxRepo.getApprovals(tenantId) };
    }

    // POST /workflow/tasks/{id}/claim
    const claimMatch = cleanPath.match(/^\/workflow\/tasks\/([^/]+)\/claim$/);
    if (claimMatch && method === 'POST') {
      const taskId = claimMatch[1];
      const userId = (req.data as any)?.userId || 'satnaing';
      const claimed = workflowSandboxRepo.claimApproval(taskId, userId, tenantId);
      if (claimed) {
        return { status: 200, data: { claimed: true, taskId, claimedBy: userId } };
      }
      return { status: 404, data: { error: `Approval task ${taskId} not found` } };
    }

    // POST /workflow/tasks/{id}/unclaim
    const unclaimMatch = cleanPath.match(/^\/workflow\/tasks\/([^/]+)\/unclaim$/);
    if (unclaimMatch && method === 'POST') {
      const taskId = unclaimMatch[1];
      const unclaimed = workflowSandboxRepo.unclaimApproval(taskId, tenantId);
      if (unclaimed) {
        return { status: 200, data: { unclaimed: true, taskId } };
      }
      return { status: 404, data: { error: `Approval task ${taskId} not found` } };
    }

    // POST /workflow/tasks/{id}/resolve
    const resolveMatch = cleanPath.match(/^\/workflow\/tasks\/([^/]+)\/resolve$/);
    if (resolveMatch && method === 'POST') {
      const taskId = resolveMatch[1];
      const body = (req.data || {}) as { action: 'APPROVE' | 'REJECT'; comment?: string; formData?: Record<string, unknown> };
      const resolved = workflowSandboxRepo.resolveApproval(taskId, body.action || 'APPROVE', body.comment, body.formData, tenantId);
      if (resolved) {
        return { status: 200, data: { resolved: true, taskId, action: body.action } };
      }
      return { status: 404, data: { error: `Approval task ${taskId} not found` } };
    }

    return { status: 404, data: { error: 'Workflow endpoint not found' } };
  },
};


export const tasksSandboxHandler = workflowSandboxHandler;

export function resetWorkflowSandbox(): void {
  workflowSandboxRepo.reset();
}
