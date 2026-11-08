import type { SandboxRouteHandler, SandboxResponse, SandboxRequest } from '../types';
import { defaultSandboxStore } from '../store';
import { sandboxResetRegistry } from '../reset-registry';
import { workflowExecutions } from './data/workflow-executions';
import type { WorkflowExecution as ClientWorkflowExecution } from '@acc/client';

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
    const scoped = this.getTenantList(tenantId).find((t) => t.id === id);
    if (scoped) return scoped;
    for (const list of this.tenantWorkflowExecutions.values()) {
      const match = list.find((t) => t.id === id);
      if (match) return match;
    }
    return undefined;
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
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  tasks: any[];
  layoutMetadata?: Record<string, { x: number; y: number; isPermanent?: boolean; isStartNode?: boolean; isEndNode?: boolean }>;
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
    workflowKey: 'order-fulfillment-pipeline',
    name: 'Order Fulfillment & Logistics Pipeline',
    version: 1,
    description: 'Production demonstration: validates order compliance, checks inventory allocation, captures payment settlement, and books courier air freight.',
    status: 'ACTIVE',
    updatedAt: 'Just now',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['orderId', 'sku', 'quantity', 'amount', 'customerEmail'],
      properties: {
        orderId: { type: 'string', description: 'Target order identifier' },
        sku: { type: 'string', description: 'Stock Keeping Unit code' },
        quantity: { type: 'integer', description: 'Requested item count' },
        amount: { type: 'number', description: 'Total order monetary amount' },
        customerEmail: { type: 'string', description: 'Customer notification email' },
      },
      additionalProperties: false,
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['fulfillmentStatus', 'orderId', 'reservationCode', 'transactionId', 'trackingNumber'],
      properties: {
        fulfillmentStatus: { type: 'string' },
        orderId: { type: 'string' },
        reservationCode: { type: 'string' },
        transactionId: { type: 'string' },
        trackingNumber: { type: 'string' },
      },
      additionalProperties: false,
    },
    tasks: [
      {
        taskReferenceName: 'workflow_start',
        taskType: 'START_WORKFLOW',
        outputSchema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            sku: { type: 'string' },
            quantity: { type: 'integer' },
            amount: { type: 'number' },
            customerEmail: { type: 'string' },
          },
        },
      },
      {
        taskReferenceName: 'validateOrder',
        taskType: 'SIMPLE',
        domain: 'default',
        inputParameters: { orderId: '${workflow.input.orderId}' },
        inputSchema: {
          type: 'object',
          required: ['orderId'],
          properties: { orderId: { type: 'string', description: 'Target order identifier' } },
        },
        outputSchema: {
          type: 'object',
          properties: { valid: { type: 'boolean' }, riskScore: { type: 'integer' } },
        },
      },
      {
        taskReferenceName: 'checkInventory',
        taskType: 'SIMPLE',
        domain: 'default',
        inputParameters: {
          orderId: '${workflow.input.orderId}',
          sku: '${workflow.input.sku}',
          quantity: '${workflow.input.quantity}',
        },
        inputSchema: {
          type: 'object',
          required: ['orderId', 'sku', 'quantity'],
          properties: {
            orderId: { type: 'string' },
            sku: { type: 'string' },
            quantity: { type: 'integer' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            inStock: { type: 'boolean' },
            warehouseId: { type: 'string' },
            reservationCode: { type: 'string' },
          },
        },
        compensateHandlerRef: 'cancelInventoryReservation',
      },
      {
        taskReferenceName: 'chargePayment',
        taskType: 'SIMPLE',
        domain: 'default',
        inputParameters: {
          orderId: '${workflow.input.orderId}',
          amount: '${workflow.input.amount}',
        },
        inputSchema: {
          type: 'object',
          required: ['orderId', 'amount'],
          properties: {
            orderId: { type: 'string' },
            amount: { type: 'number' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            charged: { type: 'boolean' },
            transactionId: { type: 'string' },
          },
        },
      },
      {
        taskReferenceName: 'expressCourier',
        taskType: 'SIMPLE',
        domain: 'default',
        inputParameters: { orderId: '${workflow.input.orderId}' },
        inputSchema: {
          type: 'object',
          required: ['orderId'],
          properties: { orderId: { type: 'string' } },
        },
        outputSchema: {
          type: 'object',
          properties: {
            carrier: { type: 'string' },
            trackingNumber: { type: 'string' },
          },
        },
        compensateHandlerRef: 'cancelCourierBooking',
      },
      {
        taskReferenceName: 'workflow_end',
        taskType: 'END_WORKFLOW',
        inputParameters: {
          fulfillmentStatus: 'COMPLETED',
          orderId: '${workflow.input.orderId}',
          reservationCode: '${checkInventory.output.reservationCode}',
          transactionId: '${chargePayment.output.transactionId}',
          trackingNumber: '${expressCourier.output.trackingNumber}',
        },
        outputSchema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          required: ['fulfillmentStatus', 'orderId', 'reservationCode', 'transactionId', 'trackingNumber'],
          properties: {
            fulfillmentStatus: { type: 'string' },
            orderId: { type: 'string' },
            reservationCode: { type: 'string' },
            transactionId: { type: 'string' },
            trackingNumber: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    ],
    layoutMetadata: {
      workflow_start: { x: 60, y: 200 },
      validateOrder: { x: 260, y: 200 },
      checkInventory: { x: 480, y: 200 },
      chargePayment: { x: 700, y: 200 },
      expressCourier: { x: 920, y: 200 },
      workflow_end: { x: 1140, y: 200 },
    },
  },
  {
    workflowKey: 'order-fulfillment-v1',
    name: 'Order Fulfillment Pipeline',
    version: 1,
    description: 'Multi-stage e-commerce order routing, automated warehouse allocation, and postal delivery.',
    status: 'ACTIVE',
    updatedAt: '2 hours ago',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['orderId', 'sku', 'quantity', 'speed'],
      properties: {
        orderId: { type: 'string' },
        sku: { type: 'string' },
        quantity: { type: 'integer' },
        speed: { type: 'string' },
        postalCode: { type: 'string' },
      },
      additionalProperties: false,
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['fulfillmentStatus', 'orderId', 'warehouseId'],
      properties: {
        fulfillmentStatus: { type: 'string' },
        orderId: { type: 'string' },
        warehouseId: { type: 'string' },
        carrier: { type: 'string' },
        trackingNumber: { type: 'string' },
      },
      additionalProperties: false,
    },
    tasks: [
      {
        taskReferenceName: 'workflow_start',
        taskType: 'START_WORKFLOW',
        outputSchema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            sku: { type: 'string' },
            quantity: { type: 'integer' },
            speed: { type: 'string' },
            postalCode: { type: 'string' },
          },
        },
      },
      {
        taskReferenceName: 'checkInventory',
        taskType: 'SIMPLE',
        domain: 'inventory',
        timeoutSeconds: 15,
        retryCount: 3,
        retryDelaySeconds: 2,
        backoffRate: 2.0,
        inputParameters: { orderId: '${workflow.input.orderId}' },
        inputSchema: {
          type: 'object',
          required: ['orderId'],
          properties: { orderId: { type: 'string' } },
        },
        outputSchema: {
          type: 'object',
          properties: { inStock: { type: 'boolean' }, warehouseId: { type: 'string' } },
        },
      },
      {
        taskReferenceName: 'routeShipping',
        taskType: 'SWITCH',
        condition: '${workflow.input.speed}',
        inputSchema: {
          type: 'object',
          required: ['condition'],
          properties: { condition: { type: 'string' } },
        },
        outputSchema: {
          type: 'object',
          properties: { selectedCase: { type: 'string' } },
        },
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
        inputSchema: {
          type: 'object',
          required: ['trackingNumber'],
          properties: { trackingNumber: { type: 'string' } },
        },
        outputSchema: {
          type: 'object',
          properties: { carrier: { type: 'string' }, trackingNumber: { type: 'string' } },
        },
        compensateHandlerRef: 'cancelCourierBooking',
      },
      {
        taskReferenceName: 'groundPostal',
        taskType: 'SIMPLE',
        domain: 'shipping',
        timeoutSeconds: 30,
        retryCount: 2,
        inputParameters: { postalCode: '${workflow.input.postalCode}' },
        inputSchema: {
          type: 'object',
          required: ['postalCode'],
          properties: { postalCode: { type: 'string' } },
        },
        outputSchema: {
          type: 'object',
          properties: { carrier: { type: 'string' }, trackingNumber: { type: 'string' } },
        },
      },
      {
        taskReferenceName: 'workflow_end',
        taskType: 'END_WORKFLOW',
        inputParameters: {
          fulfillmentStatus: 'COMPLETED',
          orderId: '${workflow.input.orderId}',
          warehouseId: '${checkInventory.output.warehouseId}',
          carrier: '${expressCourier.output.carrier}',
          trackingNumber: '${expressCourier.output.trackingNumber}',
        },
        outputSchema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          required: ['fulfillmentStatus', 'orderId', 'warehouseId'],
          properties: {
            fulfillmentStatus: { type: 'string' },
            orderId: { type: 'string' },
            warehouseId: { type: 'string' },
            carrier: { type: 'string' },
            trackingNumber: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    ],
    layoutMetadata: {
      workflow_start: { x: 50, y: 150 },
      checkInventory: { x: 260, y: 150 },
      routeShipping: { x: 500, y: 150 },
      expressCourier: { x: 740, y: 70 },
      groundPostal: { x: 740, y: 230 },
      workflow_end: { x: 980, y: 150 },
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
  {
    workflowKey: 'batch-etl-v3',
    name: 'High-Throughput Batch Telemetry Ingestion',
    version: 3,
    description: 'Dynamic partition fan-out, telemetry transformations, and columnar ingestion into ClickHouse.',
    status: 'ACTIVE',
    updatedAt: '4 hours ago',
    tasks: [
      {
        taskReferenceName: 'extractTelemetry',
        taskType: 'SIMPLE',
        domain: 'etl-domain',
        timeoutSeconds: 30,
      },
      {
        taskReferenceName: 'dynamicFanOut',
        taskType: 'DYNAMIC_FORK',
        domain: 'etl-domain',
        timeoutSeconds: 120,
      },
      {
        taskReferenceName: 'transformPartitions',
        taskType: 'SIMPLE',
        domain: 'etl-domain',
        timeoutSeconds: 60,
      },
      {
        taskReferenceName: 'loadClickHouse',
        taskType: 'SIMPLE',
        domain: 'storage',
        timeoutSeconds: 45,
      },
    ],
    layoutMetadata: {
      extractTelemetry: { x: 80, y: 120 },
      dynamicFanOut: { x: 320, y: 120 },
      transformPartitions: { x: 560, y: 120 },
      loadClickHouse: { x: 800, y: 120 },
    },
  },
  {
    workflowKey: 'subscription-billing-v1',
    name: 'Annual Enterprise Subscription Automated Card Renewal',
    version: 1,
    description: 'Automated recurring card token settlement, retry threshold isolation, and receipt notification.',
    status: 'ACTIVE',
    updatedAt: '1 hour ago',
    tasks: [
      {
        taskReferenceName: 'checkEntitlements',
        taskType: 'SIMPLE',
        domain: 'billing',
        timeoutSeconds: 15,
      },
      {
        taskReferenceName: 'chargeRecurringCard',
        taskType: 'SIMPLE',
        domain: 'payment',
        timeoutSeconds: 30,
        retryCount: 3,
      },
      {
        taskReferenceName: 'issueInvoiceReceipt',
        taskType: 'SIMPLE',
        domain: 'billing',
        timeoutSeconds: 20,
      },
      {
        taskReferenceName: 'notifyCustomer',
        taskType: 'SIMPLE',
        domain: 'notification',
        timeoutSeconds: 15,
      },
    ],
    layoutMetadata: {
      checkEntitlements: { x: 80, y: 150 },
      chargeRecurringCard: { x: 320, y: 150 },
      issueInvoiceReceipt: { x: 560, y: 150 },
      notifyCustomer: { x: 800, y: 150 },
    },
  },
  {
    workflowKey: 'content-enrichment-v1',
    name: 'Generative AI Content Enrichment & Localization',
    version: 1,
    description: 'LLM financial disclosure summarization, automated sentiment tagging, and moderation signoff.',
    status: 'ACTIVE',
    updatedAt: 'Yesterday',
    tasks: [
      {
        taskReferenceName: 'extractSourceText',
        taskType: 'SIMPLE',
        domain: 'cms',
        timeoutSeconds: 15,
      },
      {
        taskReferenceName: 'llmGenerateSummary',
        taskType: 'SIMPLE',
        domain: 'ai-enrichment',
        timeoutSeconds: 45,
        retryCount: 3,
      },
      {
        taskReferenceName: 'humanModerationReview',
        taskType: 'WAIT',
        domain: 'moderation',
        timeoutSeconds: 3600,
      },
      {
        taskReferenceName: 'publishContent',
        taskType: 'SIMPLE',
        domain: 'cms',
        timeoutSeconds: 20,
      },
    ],
    layoutMetadata: {
      extractSourceText: { x: 80, y: 150 },
      llmGenerateSummary: { x: 320, y: 150 },
      humanModerationReview: { x: 560, y: 150 },
      publishContent: { x: 800, y: 150 },
    },
  },
  {
    workflowKey: 'inventory-sync-v1',
    name: 'Multi-Warehouse Inventory Stock Synchronization',
    version: 1,
    description: 'Real-time inter-warehouse inventory reservations and stock adjustment delta propagation.',
    status: 'ACTIVE',
    updatedAt: '2 days ago',
    tasks: [
      {
        taskReferenceName: 'fetchInventoryDelta',
        taskType: 'SIMPLE',
        domain: 'inventory',
        timeoutSeconds: 15,
      },
      {
        taskReferenceName: 'reserveStockJdbc',
        taskType: 'SIMPLE',
        domain: 'inventory',
        timeoutSeconds: 20,
        retryCount: 3,
      },
      {
        taskReferenceName: 'notifyWarehouseStaff',
        taskType: 'SIMPLE',
        domain: 'notification',
        timeoutSeconds: 15,
      },
    ],
    layoutMetadata: {
      fetchInventoryDelta: { x: 80, y: 150 },
      reserveStockJdbc: { x: 340, y: 150 },
      notifyWarehouseStaff: { x: 600, y: 150 },
    },
  },
  {
    workflowKey: 'audit-pipeline-v1',
    name: 'Enterprise Audit & Compliance Event Dispatcher',
    version: 1,
    description: 'Distributed Kafka audit stream distribution, cold storage archiving, and compliance logging.',
    status: 'ACTIVE',
    updatedAt: '3 days ago',
    tasks: [
      {
        taskReferenceName: 'gatherSecurityEvents',
        taskType: 'SIMPLE',
        domain: 'audit',
        timeoutSeconds: 15,
      },
      {
        taskReferenceName: 'publishKafkaAudit',
        taskType: 'SIMPLE',
        domain: 'audit',
        timeoutSeconds: 30,
        retryCount: 3,
      },
      {
        taskReferenceName: 'archiveColdStorage',
        taskType: 'SIMPLE',
        domain: 'storage',
        timeoutSeconds: 30,
      },
    ],
    layoutMetadata: {
      gatherSecurityEvents: { x: 80, y: 150 },
      publishKafkaAudit: { x: 340, y: 150 },
      archiveColdStorage: { x: 600, y: 150 },
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

      const execMap = new Map<string, WorkflowExecution>();
      workflowExecutions.forEach((rawExec) => {
        const def = defMap.get(rawExec.workflowId) || DEFAULT_DEFINITIONS.find((d) => d.workflowKey === rawExec.workflowId);
        const tasks = (def?.tasks || []).map((tDef) => {
          let tStatus: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' = 'SCHEDULED';
          let output: any = {};
          if (rawExec.status === 'COMPLETED') {
            tStatus = 'COMPLETED';
            output = { completedAt: (rawExec as any).completedAt || new Date().toISOString() };
          } else if (rawExec.status === 'FAILED') {
            if (tDef.taskReferenceName === rawExec.activeStep) {
              tStatus = 'FAILED';
              output = rawExec.outputData || { error: rawExec.errorMessage };
            } else {
              const defIdx = def?.tasks.findIndex((t) => t.taskReferenceName === tDef.taskReferenceName) ?? -1;
              const activeIdx = def?.tasks.findIndex((t) => t.taskReferenceName === rawExec.activeStep) ?? -1;
              tStatus = defIdx < activeIdx ? 'COMPLETED' : 'SCHEDULED';
            }
          } else if (rawExec.status === 'IN_PROGRESS') {
            if (tDef.taskReferenceName === rawExec.activeStep) {
              tStatus = 'IN_PROGRESS';
            } else {
              const defIdx = def?.tasks.findIndex((t) => t.taskReferenceName === tDef.taskReferenceName) ?? -1;
              const activeIdx = def?.tasks.findIndex((t) => t.taskReferenceName === rawExec.activeStep) ?? -1;
              tStatus = defIdx < activeIdx ? 'COMPLETED' : 'SCHEDULED';
            }
          }
          const taskId = (rawExec.taskId && tDef.taskReferenceName === rawExec.activeStep)
            ? rawExec.taskId
            : `${rawExec.id}_${tDef.taskReferenceName}`;
          return {
            taskId,
            taskReferenceName: tDef.taskReferenceName,
            taskType: tDef.taskType,
            status: tStatus,
            inputData: rawExec.inputData || {},
            output,
            outputData: output,
          };
        });

        const tasksByRef: Record<string, any> = {};
        tasks.forEach((t) => {
          tasksByRef[t.taskReferenceName] = t;
        });

        const execution: WorkflowExecution = {
          workflowId: rawExec.id,
          tenantId: tid,
          workspaceId: 'default',
          workflowKey: rawExec.workflowId,
          status: rawExec.status as any,
          currentStep: rawExec.activeStep,
          inputPayload: rawExec.inputData,
          outputPayload: rawExec.outputData,
          variables: { ...(rawExec.inputData || {}), ...(rawExec.outputData || {}) },
          tasks,
          tasksByRef,
        };
        execMap.set(rawExec.id, execution);
      });
      this.tenantExecutions.set(tid, execMap);
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

    let tasks = def.tasks || existing?.tasks;
    let layoutMetadata = def.layoutMetadata || existing?.layoutMetadata;

    // Backend parity: When creating a blank workflow (empty/no tasks), initialize canonical boundary nodes (Start & End)
    if (!tasks || tasks.length === 0) {
      tasks = [
        {
          taskReferenceName: 'workflow_start',
          taskType: 'START_WORKFLOW',
          domain: 'default',
        },
        {
          taskReferenceName: 'workflow_end',
          taskType: 'END_WORKFLOW',
          domain: 'default',
        },
      ];
      layoutMetadata = {
        workflow_start: { x: 100, y: 200, isPermanent: true, isStartNode: true },
        workflow_end: { x: 500, y: 200, isPermanent: true, isEndNode: true },
      };
    }

    const record: WorkflowDefinitionIR = {
      ...existing,
      ...def,
      tasks,
      layoutMetadata,
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
    const scoped = this.getExecutionMap(tenantId).get(workflowId);
    if (scoped) return scoped;
    for (const map of this.tenantExecutions.values()) {
      const match = map.get(workflowId);
      if (match) return match;
    }
    return undefined;
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

export interface TaskDefinitionRecordIR {
  taskDefId: string;
  tenantId: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
  description?: string;
  retryCount?: number;
  retryDelaySeconds?: number;
  backoffRate?: number;
  timeoutSeconds?: number;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  changelogNote?: string;
  publishedAtMs?: number;
  publishedBy?: string;
  createdAtMs: number;
  updatedAtMs: number;
  createdBy?: string;
  isBuiltIn?: boolean;
}

export const DEFAULT_TASK_DEFINITIONS: TaskDefinitionRecordIR[] = [
  {
    taskDefId: 'system:validateOrder:v1',
    tenantId: 'system',
    name: 'validateOrder',
    version: 1,
    status: 'ACTIVE',
    description: 'Executes KYC, sanctions screening, and velocity fraud heuristics on incoming order.',
    retryCount: 3,
    retryDelaySeconds: 2,
    backoffRate: 2.0,
    timeoutSeconds: 30,
    inputSchema: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'string' },
        orderValue: { type: 'number' },
        customerTier: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        riskScore: { type: 'number' },
        checkedAt: { type: 'string' },
      },
    },
    changelogNote: 'Initial canonical validateOrder specification',
    publishedAtMs: Date.now() - 86400000,
    publishedBy: 'SYSTEM',
    createdAtMs: Date.now() - 86400000,
    updatedAtMs: Date.now() - 86400000,
    createdBy: 'SYSTEM',
  },
  {
    taskDefId: 'system:checkInventory:v1',
    tenantId: 'system',
    name: 'checkInventory',
    version: 1,
    status: 'ACTIVE',
    description: 'Verifies stock levels in warehouse and reserves allocation lease.',
    retryCount: 3,
    retryDelaySeconds: 2,
    backoffRate: 2.0,
    timeoutSeconds: 30,
    inputSchema: {
      type: 'object',
      required: ['sku', 'quantity'],
      properties: {
        sku: { type: 'string' },
        quantity: { type: 'number' },
        warehouseZone: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        inStock: { type: 'boolean' },
        warehouseId: { type: 'string' },
        reservationCode: { type: 'string' },
      },
    },
    changelogNote: 'Initial canonical checkInventory specification',
    publishedAtMs: Date.now() - 86400000,
    publishedBy: 'SYSTEM',
    createdAtMs: Date.now() - 86400000,
    updatedAtMs: Date.now() - 86400000,
    createdBy: 'SYSTEM',
  },
  {
    taskDefId: 'system:chargePayment:v1',
    tenantId: 'system',
    name: 'chargePayment',
    version: 1,
    status: 'ACTIVE',
    description: 'Captures authorized funds across primary payment gateway with idempotency key.',
    retryCount: 3,
    retryDelaySeconds: 2,
    backoffRate: 2.0,
    timeoutSeconds: 30,
    inputSchema: {
      type: 'object',
      required: ['orderId', 'amount'],
      properties: {
        orderId: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        charged: { type: 'boolean' },
        transactionId: { type: 'string' },
        settledAt: { type: 'string' },
      },
    },
    changelogNote: 'Initial canonical chargePayment specification',
    publishedAtMs: Date.now() - 86400000,
    publishedBy: 'SYSTEM',
    createdAtMs: Date.now() - 86400000,
    updatedAtMs: Date.now() - 86400000,
    createdBy: 'SYSTEM',
  },
  {
    taskDefId: 'system:expressCourier:v1',
    tenantId: 'system',
    name: 'expressCourier',
    version: 1,
    status: 'ACTIVE',
    description: 'Books priority overnight air freight label and tracking number.',
    retryCount: 3,
    retryDelaySeconds: 2,
    backoffRate: 2.0,
    timeoutSeconds: 30,
    inputSchema: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'string' },
        destinationZone: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        carrier: { type: 'string' },
        trackingNumber: { type: 'string' },
        estimatedDeliveryHours: { type: 'number' },
      },
    },
    changelogNote: 'Initial canonical expressCourier specification',
    publishedAtMs: Date.now() - 86400000,
    publishedBy: 'SYSTEM',
    createdAtMs: Date.now() - 86400000,
    updatedAtMs: Date.now() - 86400000,
    createdBy: 'SYSTEM',
  },
  {
    taskDefId: 'system:groundPostal:v1',
    tenantId: 'system',
    name: 'groundPostal',
    version: 1,
    status: 'ACTIVE',
    description: 'Books economical ground parcel fulfillment route.',
    retryCount: 3,
    retryDelaySeconds: 2,
    backoffRate: 2.0,
    timeoutSeconds: 30,
    inputSchema: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'string' },
        postalCode: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        carrier: { type: 'string' },
        trackingNumber: { type: 'string' },
        estimatedDeliveryDays: { type: 'number' },
      },
    },
    changelogNote: 'Initial canonical groundPostal specification',
    publishedAtMs: Date.now() - 86400000,
    publishedBy: 'SYSTEM',
    createdAtMs: Date.now() - 86400000,
    updatedAtMs: Date.now() - 86400000,
    createdBy: 'SYSTEM',
  },
  {
    taskDefId: 'system:cancelCourierBooking:v1',
    tenantId: 'system',
    name: 'cancelCourierBooking',
    version: 1,
    status: 'ACTIVE',
    description: 'Revokes active carrier label and releases reserved manifest capacity.',
    retryCount: 3,
    retryDelaySeconds: 2,
    backoffRate: 2.0,
    timeoutSeconds: 30,
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        trackingNumber: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        cancelled: { type: 'boolean' },
        refundReference: { type: 'string' },
      },
    },
    changelogNote: 'Initial canonical cancelCourierBooking specification',
    publishedAtMs: Date.now() - 86400000,
    publishedBy: 'SYSTEM',
    createdAtMs: Date.now() - 86400000,
    updatedAtMs: Date.now() - 86400000,
    createdBy: 'SYSTEM',
  },
  {
    taskDefId: 'system:publishCmsArticle:v1',
    tenantId: 'system',
    name: 'publishCmsArticle',
    version: 1,
    status: 'ACTIVE',
    description: 'Promotes reviewed content revision to live CDN edge cache.',
    retryCount: 3,
    retryDelaySeconds: 2,
    backoffRate: 2.0,
    timeoutSeconds: 30,
    inputSchema: {
      type: 'object',
      required: ['articleId'],
      properties: {
        articleId: { type: 'string' },
        slug: { type: 'string' },
        channel: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        published: { type: 'boolean' },
        cdnUrl: { type: 'string' },
        publishedAt: { type: 'string' },
      },
    },
    changelogNote: 'Initial canonical publishCmsArticle specification',
    publishedAtMs: Date.now() - 86400000,
    publishedBy: 'SYSTEM',
    createdAtMs: Date.now() - 86400000,
    updatedAtMs: Date.now() - 86400000,
    createdBy: 'SYSTEM',
  },
];

export class WorkflowTaskDefinitionsSandboxRepository {
  private tenantTaskDefs: Map<string, Map<string, TaskDefinitionRecordIR>> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  private getActiveTenantId(): string {
    return defaultSandboxStore.getState().activeTenantId || 'tenant-acme';
  }

  private getTenantMap(tenantId?: string): Map<string, TaskDefinitionRecordIR> {
    const tid = tenantId || this.getActiveTenantId();
    if (!this.tenantTaskDefs.has(tid)) {
      const map = new Map<string, TaskDefinitionRecordIR>();
      DEFAULT_TASK_DEFINITIONS.forEach((def) => {
        map.set(`${def.name}:v${def.version}`, { ...JSON.parse(JSON.stringify(def)), tenantId: tid });
      });
      this.tenantTaskDefs.set(tid, map);
    }
    return this.tenantTaskDefs.get(tid)!;
  }

  public reset(): void {
    this.tenantTaskDefs.clear();
    const seedTenants = ['SYSTEM', 'tenant-acme', 'tenant-us-east-1', 'tenant-eu-central-1', 'tenant-us-west-2'];
    seedTenants.forEach((tid) => {
      const map = new Map<string, TaskDefinitionRecordIR>();
      DEFAULT_TASK_DEFINITIONS.forEach((def) => {
        map.set(`${def.name}:v${def.version}`, { ...JSON.parse(JSON.stringify(def)), tenantId: tid });
      });
      this.tenantTaskDefs.set(tid, map);
    });
  }

  public listLatest(tenantId?: string): TaskDefinitionRecordIR[] {
    const map = this.getTenantMap(tenantId);
    const latestByName = new Map<string, TaskDefinitionRecordIR>();

    // 1. Built-in platform system contracts
    for (const b of getBuiltinTaskDefinitions()) {
      latestByName.set(b.name, b);
    }

    // 2. Custom/Tenant task definitions (can override or supplement)
    for (const record of map.values()) {
      const existing = latestByName.get(record.name);
      if (!existing || record.version >= existing.version) {
        latestByName.set(record.name, record);
      }
    }
    return Array.from(latestByName.values());
  }

  public listVersions(name: string, tenantId?: string): TaskDefinitionRecordIR[] {
    const map = this.getTenantMap(tenantId);
    const versions = Array.from(map.values())
      .filter((r) => r.name === name)
      .sort((a, b) => a.version - b.version);
    if (versions.length === 0) {
      const builtin = getBuiltinTaskDefinitions().find((b) => b.name === name);
      if (builtin) return [builtin];
    }
    return versions;
  }

  public resolve(name: string, version?: number, tenantId?: string): TaskDefinitionRecordIR | undefined {
    const map = this.getTenantMap(tenantId);
    if (version !== undefined && version > 0) {
      const found = map.get(`${name}:v${version}`);
      if (found) return found;
      if (version === 1) {
        return getBuiltinTaskDefinitions().find((b) => b.name === name);
      }
      return undefined;
    }
    const all = this.listVersions(name, tenantId);
    const active = all.filter((r) => r.status === 'ACTIVE');
    if (active.length > 0) {
      return active[active.length - 1];
    }
    if (all.length > 0) return all[all.length - 1];
    return getBuiltinTaskDefinitions().find((b) => b.name === name);
  }

  public createOrForkDraft(data: Partial<TaskDefinitionRecordIR>, tenantId?: string): TaskDefinitionRecordIR {
    const tid = tenantId || this.getActiveTenantId();
    const map = this.getTenantMap(tid);
    const name = data.name || 'customTask';
    const existing = this.listVersions(name, tid);
    let nextVersion = 1;
    if (existing.length > 0) {
      const maxVer = Math.max(...existing.map((e) => e.version));
      const latest = existing.find((e) => e.version === maxVer);
      if (latest && latest.status === 'DRAFT') {
        nextVersion = maxVer;
      } else {
        nextVersion = maxVer + 1;
      }
    }
    const now = Date.now();
    const record: TaskDefinitionRecordIR = {
      taskDefId: `${tid}:${name}:v${nextVersion}`,
      tenantId: tid,
      name,
      version: nextVersion,
      status: 'DRAFT',
      description: data.description || '',
      retryCount: data.retryCount ?? 3,
      retryDelaySeconds: data.retryDelaySeconds ?? 2,
      backoffRate: data.backoffRate ?? 2.0,
      timeoutSeconds: data.timeoutSeconds ?? 30,
      inputSchema: data.inputSchema || { type: 'object', properties: {} },
      outputSchema: data.outputSchema || { type: 'object', properties: {} },
      changelogNote: data.changelogNote || 'Draft revision created in sandbox',
      createdAtMs: now,
      updatedAtMs: now,
      createdBy: 'SANDBOX_USER',
    };
    map.set(`${name}:v${nextVersion}`, record);
    return record;
  }

  public publishVersion(name: string, version: number, tenantId?: string): TaskDefinitionRecordIR | undefined {
    const tid = tenantId || this.getActiveTenantId();
    const map = this.getTenantMap(tid);
    const target = map.get(`${name}:v${version}`);
    if (!target) return undefined;
    const now = Date.now();

    // Deprecate other active versions
    for (const rec of map.values()) {
      if (rec.name === name && rec.version !== version && rec.status === 'ACTIVE') {
        rec.status = 'DEPRECATED';
        rec.updatedAtMs = now;
      }
    }

    target.status = 'ACTIVE';
    target.publishedAtMs = now;
    target.publishedBy = 'SANDBOX_USER';
    target.updatedAtMs = now;
    return target;
  }

  public deleteDraftVersion(name: string, version: number, tenantId?: string): boolean {
    const builtin = getBuiltinTaskDefinitions().find((b) => b.name === name);
    if (builtin && version === 1) return false;
    const tid = tenantId || this.getActiveTenantId();
    const map = this.getTenantMap(tid);
    const target = map.get(`${name}:v${version}`);
    if (!target || target.status !== 'DRAFT') return false;
    return map.delete(`${name}:v${version}`);
  }
}

export const workflowTaskDefinitionsSandboxRepo = new WorkflowTaskDefinitionsSandboxRepository();

export interface TaskTypeContractIR {
  taskType: string;
  category: 'BOUNDARY' | 'SYSTEM' | 'WORKER';
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  parameterDescriptors: Array<Record<string, unknown>>;
}

export const SANDBOX_TASK_CONTRACTS: TaskTypeContractIR[] = [
  {
    taskType: 'START_WORKFLOW',
    category: 'BOUNDARY',
    description: 'Canonical workflow entry boundary. Emits workflow trigger inputs as downstream context.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {}, description: 'Mirrors workflow trigger payload' },
    parameterDescriptors: [],
  },
  {
    taskType: 'END_WORKFLOW',
    category: 'BOUNDARY',
    description: 'Canonical workflow exit boundary. Evaluates terminal output mappings and enforces workflow outputSchema.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Terminal workflow status', default: 'COMPLETED' },
        payload: { type: 'object', description: 'Explicit mapped terminal output payload' },
      },
    },
    outputSchema: { type: 'object', properties: {}, additionalProperties: false },
    parameterDescriptors: [
      { key: 'status', label: 'Workflow Status', type: 'string', required: true, defaultValue: 'COMPLETED' },
      { key: 'payload', label: 'Result Payload', type: 'object', required: false },
    ],
  },
  {
    taskType: 'HTTP',
    category: 'SYSTEM',
    description: 'Executes synchronous REST HTTP/HTTPS requests with configurable methods, headers, and timeouts.',
    inputSchema: {
      type: 'object',
      required: ['url', 'method'],
      properties: {
        url: { type: 'string', description: 'Destination HTTP/HTTPS URL endpoint' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'], default: 'GET' },
        headers: { type: 'object', description: 'Optional HTTP request headers' },
        body: { type: 'object', description: 'Optional HTTP request payload' },
        timeoutMs: { type: 'integer', default: 5000 },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['statusCode'],
      properties: {
        statusCode: { type: 'integer', description: 'HTTP response status code' },
        body: { type: 'object', description: 'Decoded JSON response payload' },
        headers: { type: 'object', description: 'Response headers map' },
        durationMs: { type: 'integer', description: 'Execution roundtrip time in ms' },
      },
    },
    parameterDescriptors: [
      { key: 'url', label: 'Endpoint URL', type: 'string', required: true, exampleValue: 'https://api.example.com/v1/resource' },
      { key: 'method', label: 'HTTP Method', type: 'string', required: true, defaultValue: 'GET' },
      { key: 'headers', label: 'Request Headers', type: 'object', required: false },
      { key: 'body', label: 'Request Body', type: 'object', required: false },
      { key: 'timeoutMs', label: 'Timeout (ms)', type: 'number', required: false, defaultValue: 5000 },
    ],
  },
  {
    taskType: 'LLM_CHAT_COMPLETE',
    category: 'SYSTEM',
    description: 'Invokes large language model inference (Gemini, Claude, GPT) with deterministic temperature and token accounting.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'Primary user message or prompt text' },
        model: { type: 'string', default: 'gemini-1.5-pro' },
        temperature: { type: 'number', default: 0.7 },
        systemPrompt: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['responseText'],
      properties: {
        responseText: { type: 'string', description: 'Generated assistant response text' },
        tokenUsage: { type: 'object' },
      },
    },
    parameterDescriptors: [
      { key: 'prompt', label: 'Prompt Text', type: 'string', required: true },
      { key: 'model', label: 'Model Name', type: 'string', required: false, defaultValue: 'gemini-1.5-pro' },
      { key: 'temperature', label: 'Temperature', type: 'number', required: false, defaultValue: 0.7 },
      { key: 'systemPrompt', label: 'System Prompt', type: 'string', required: false },
    ],
  },
  {
    taskType: 'JSON_JQ_TRANSFORM',
    category: 'SYSTEM',
    description: 'Applies in-memory JQ expressions for deterministic JSON filtering, plucking, and structural projection.',
    inputSchema: {
      type: 'object',
      required: ['queryExpression'],
      properties: {
        queryExpression: { type: 'string' },
        input: { type: 'object' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['result'],
      properties: { result: { description: 'Transformed output projection' } },
    },
    parameterDescriptors: [
      { key: 'queryExpression', label: 'JQ Query Expression', type: 'string', required: true },
      { key: 'input', label: 'Target Input Object', type: 'object', required: false },
    ],
  },
  {
    taskType: 'SWITCH',
    category: 'SYSTEM',
    description: 'Evaluates conditional branch expressions and routes execution to matching decision branches.',
    inputSchema: {
      type: 'object',
      required: ['evaluatorType', 'expression'],
      properties: {
        evaluatorType: { type: 'string', enum: ['value-param', 'javascript', 'spel'], default: 'value-param' },
        expression: { type: 'string' },
        value: { description: 'Direct value parameter' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['selectedCase'],
      properties: { selectedCase: { type: 'string' } },
    },
    parameterDescriptors: [
      { key: 'evaluatorType', label: 'Evaluator Type', type: 'string', required: true, defaultValue: 'value-param' },
      { key: 'expression', label: 'Decision Expression', type: 'string', required: true },
      { key: 'value', label: 'Evaluation Value', type: 'string', required: false },
    ],
  },
  {
    taskType: 'WAIT',
    category: 'SYSTEM',
    description: 'Pauses execution for a specified duration or until a target timestamp is reached.',
    inputSchema: {
      type: 'object',
      properties: { duration: { type: 'string' }, until: { type: 'string' } },
    },
    outputSchema: {
      type: 'object',
      properties: { waitedMs: { type: 'integer' } },
    },
    parameterDescriptors: [
      { key: 'duration', label: 'Duration', type: 'string', required: false },
      { key: 'until', label: 'Wait Until (ISO)', type: 'string', required: false },
    ],
  },
  {
    taskType: 'SUB_WORKFLOW',
    category: 'SYSTEM',
    description: 'Spawns and monitors an isolated child workflow execution.',
    inputSchema: {
      type: 'object',
      required: ['subWorkflowKey'],
      properties: {
        subWorkflowKey: { type: 'string' },
        subWorkflowVersion: { type: 'integer', default: 1 },
        workflowInput: { type: 'object' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: { subWorkflowId: { type: 'string' }, subWorkflowOutput: { type: 'object' } },
    },
    parameterDescriptors: [
      { key: 'subWorkflowKey', label: 'Sub-Workflow Key', type: 'string', required: true },
      { key: 'subWorkflowVersion', label: 'Version', type: 'number', required: false, defaultValue: 1 },
      { key: 'workflowInput', label: 'Child Input Payload', type: 'object', required: false },
    ],
  },
  {
    taskType: 'SIMPLE',
    category: 'WORKER',
    description: 'Domain worker task executed asynchronously by worker fleet pollers.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
    outputSchema: { type: 'object', properties: { result: { type: 'object' } }, additionalProperties: true },
    parameterDescriptors: [],
  },
  {
    taskType: 'validateOrder',
    category: 'WORKER',
    description: 'Evaluates fraud risk, customer KYC status, and credit limits.',
    inputSchema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string', description: 'Target order identifier' } },
    },
    outputSchema: {
      type: 'object',
      properties: { valid: { type: 'boolean' }, riskScore: { type: 'integer' } },
    },
    parameterDescriptors: [
      { key: 'orderId', label: 'Order ID', type: 'string', required: true },
    ],
  },
  {
    taskType: 'checkInventory',
    category: 'WORKER',
    description: 'Verifies SKU availability and allocates warehouse reservation slot.',
    inputSchema: {
      type: 'object',
      required: ['orderId', 'sku', 'quantity'],
      properties: {
        orderId: { type: 'string' },
        sku: { type: 'string' },
        quantity: { type: 'integer' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: { inStock: { type: 'boolean' }, warehouseId: { type: 'string' }, reservationCode: { type: 'string' } },
    },
    parameterDescriptors: [
      { key: 'orderId', label: 'Order ID', type: 'string', required: true },
      { key: 'sku', label: 'SKU Code', type: 'string', required: true },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    ],
  },
  {
    taskType: 'chargePayment',
    category: 'WORKER',
    description: 'Processes credit card or gateway payment capture with idempotency.',
    inputSchema: {
      type: 'object',
      required: ['orderId', 'amount'],
      properties: { orderId: { type: 'string' }, amount: { type: 'number' } },
    },
    outputSchema: {
      type: 'object',
      properties: { charged: { type: 'boolean' }, transactionId: { type: 'string' } },
    },
    parameterDescriptors: [
      { key: 'orderId', label: 'Order ID', type: 'string', required: true },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
    ],
  },
  {
    taskType: 'expressCourier',
    category: 'WORKER',
    description: 'Books priority overnight air freight label and tracking number.',
    inputSchema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string' } },
    },
    outputSchema: {
      type: 'object',
      properties: { carrier: { type: 'string' }, trackingNumber: { type: 'string' } },
    },
    parameterDescriptors: [
      { key: 'orderId', label: 'Order ID', type: 'string', required: true },
    ],
  },
  {
    taskType: 'groundPostal',
    category: 'WORKER',
    description: 'Books economical ground parcel fulfillment route.',
    inputSchema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string' } },
    },
    outputSchema: {
      type: 'object',
      properties: { carrier: { type: 'string' }, trackingNumber: { type: 'string' } },
    },
    parameterDescriptors: [
      { key: 'orderId', label: 'Order ID', type: 'string', required: true },
    ],
  },
];

export function getBuiltinTaskDefinitions(): TaskDefinitionRecordIR[] {
  return SANDBOX_TASK_CONTRACTS.map((c) => ({
    taskDefId: `system:${c.taskType.toLowerCase()}:v1`,
    tenantId: 'SYSTEM',
    name: c.taskType,
    version: 1,
    status: 'ACTIVE' as const,
    description: c.description,
    retryCount: c.taskType === 'HTTP' ? 3 : 0,
    retryDelaySeconds: c.taskType === 'HTTP' ? 2 : 0,
    backoffRate: c.taskType === 'HTTP' ? 2.0 : 1.0,
    timeoutSeconds: c.taskType === 'HTTP' ? 30 : 60,
    inputSchema: c.inputSchema,
    outputSchema: c.outputSchema,
    changelogNote: 'Canonical built-in platform contract',
    isBuiltIn: true,
    publishedAtMs: 0,
    publishedBy: 'SYSTEM',
    createdAtMs: 0,
    updatedAtMs: 0,
    createdBy: 'SYSTEM',
  }));
}

export const workflowSandboxHandler: SandboxRouteHandler = {
  id: 'workflow-sandbox-handler',
  name: 'Workflow Orchestration Sandbox Simulator',
  description: 'Enterprise multi-tenant mock repository for Workflows CRUD, execution SSE streams, and worker leases',
  priority: 95,
  matcher: (ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    return cleanPath.startsWith('/workflow') || cleanPath.startsWith('/workflow-executions') || cleanPath.startsWith('/tasks');
  },
  handler: (req: SandboxRequest, context): SandboxResponse => {
    const method = req.method.toUpperCase();
    const { pathname } = context;
    const cleanPath = pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    const tenantId = (req.headers?.['x-tenant-id'] as string) || defaultSandboxStore.getState().activeTenantId || 'tenant-acme';

    // -1. Task Contracts Catalog: /tasks/contracts
    if (cleanPath === '/tasks/contracts' || cleanPath === '/tasks/contracts/') {
      if (method === 'GET') {
        const dynamicDefs = workflowTaskDefinitionsSandboxRepo.listLatest(tenantId);
        const dynamicContracts: TaskTypeContractIR[] = dynamicDefs.map((def) => ({
          taskType: def.name,
          category: 'WORKER',
          description: def.description || `Task definition ${def.name}`,
          inputSchema: def.inputSchema || {},
          outputSchema: def.outputSchema || {},
          parameterDescriptors: Object.entries((def.inputSchema?.properties as Record<string, any>) || {}).map(([key, val]) => ({
            key,
            label: key,
            type: val.type || 'string',
            required: ((def.inputSchema?.required as string[]) || []).includes(key),
          })),
        }));
        const combined = [...SANDBOX_TASK_CONTRACTS];
        for (const dc of dynamicContracts) {
          if (!combined.some((c) => c.taskType.toLowerCase() === dc.taskType.toLowerCase())) {
            combined.push(dc);
          }
        }
        return {
          status: 200,
          data: combined,
        };
      }
    }
    const taskContractMatch = cleanPath.match(/^\/tasks\/contracts\/([^/]+)$/);
    if (taskContractMatch) {
      const type = taskContractMatch[1].toUpperCase();
      const found = SANDBOX_TASK_CONTRACTS.find((c) => c.taskType.toUpperCase() === type);
      if (found) {
        return { status: 200, data: found };
      }
      const dynFound = workflowTaskDefinitionsSandboxRepo.resolve(taskContractMatch[1], undefined, tenantId);
      if (dynFound) {
        return {
          status: 200,
          data: {
            taskType: dynFound.name,
            category: 'WORKER',
            description: dynFound.description || `Task definition ${dynFound.name}`,
            inputSchema: dynFound.inputSchema || {},
            outputSchema: dynFound.outputSchema || {},
            parameterDescriptors: Object.entries((dynFound.inputSchema?.properties as Record<string, any>) || {}).map(([key, val]) => ({
              key,
              label: key,
              type: val.type || 'string',
              required: ((dynFound.inputSchema?.required as string[]) || []).includes(key),
            })),
          },
        };
      }
      return { status: 404, data: { error: `Task contract ${type} not found` } };
    }

    // 0.2 Workflow Task Definitions Catalog: /workflow/task-definitions
    if (
      cleanPath === '/workflow/task-definitions' ||
      cleanPath === '/workflow/task-definitions/' ||
      cleanPath === '/workflow/task-definitions/draft'
    ) {
      if (method === 'GET') {
        return {
          status: 200,
          data: workflowTaskDefinitionsSandboxRepo.listLatest(tenantId),
        };
      }
      if (method === 'POST') {
        const body = (req.data || {}) as Partial<TaskDefinitionRecordIR>;
        if (!body.name) {
          return { status: 400, data: { error: 'Task definition name is required' } };
        }
        const created = workflowTaskDefinitionsSandboxRepo.createOrForkDraft(body, tenantId);
        return { status: 201, data: created };
      }
    }

    // 0.3 Task Definition Version Operations: /workflow/task-definitions/{name}/versions/{version}/publish
    const taskDefPublishMatch = cleanPath.match(/^\/workflow\/task-definitions\/([^/]+)\/versions\/(\d+)\/publish$/);
    if (taskDefPublishMatch && method === 'POST') {
      const name = taskDefPublishMatch[1];
      const version = parseInt(taskDefPublishMatch[2], 10);
      const published = workflowTaskDefinitionsSandboxRepo.publishVersion(name, version, tenantId);
      if (published) {
        return { status: 200, data: published };
      }
      return { status: 404, data: { error: `Task definition ${name} v${version} not found` } };
    }

    // 0.4 Task Definition Versions List: /workflow/task-definitions/{name}/versions
    const taskDefVersionsMatch = cleanPath.match(/^\/workflow\/task-definitions\/([^/]+)\/versions$/);
    if (taskDefVersionsMatch && method === 'GET') {
      const name = taskDefVersionsMatch[1];
      return {
        status: 200,
        data: workflowTaskDefinitionsSandboxRepo.listVersions(name, tenantId),
      };
    }

    // 0.5 Single Version Operations: /workflow/task-definitions/{name}/versions/{version}
    const taskDefSingleVersionMatch = cleanPath.match(/^\/workflow\/task-definitions\/([^/]+)\/versions\/(\d+)$/);
    if (taskDefSingleVersionMatch) {
      const name = taskDefSingleVersionMatch[1];
      const version = parseInt(taskDefSingleVersionMatch[2], 10);
      if (method === 'GET') {
        const found = workflowTaskDefinitionsSandboxRepo.resolve(name, version, tenantId);
        if (found) return { status: 200, data: found };
        return { status: 404, data: { error: `Task definition ${name} v${version} not found` } };
      }
      if (method === 'DELETE') {
        const deleted = workflowTaskDefinitionsSandboxRepo.deleteDraftVersion(name, version, tenantId);
        if (deleted) return { status: 204, data: null };
        return { status: 400, data: { error: `Cannot delete non-draft or non-existent task definition ${name} v${version}` } };
      }
    }

    // 0.6 Single Task Definition (Latest Active): /workflow/task-definitions/{name}
    const taskDefNameMatch = cleanPath.match(/^\/workflow\/task-definitions\/([^/]+)$/);
    if (taskDefNameMatch && method === 'GET') {
      const name = taskDefNameMatch[1];
      const found = workflowTaskDefinitionsSandboxRepo.resolve(name, undefined, tenantId);
      if (found) return { status: 200, data: found };
      return { status: 404, data: { error: `Task definition ${name} not found` } };
    }

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
        const all = workflowExecutionsSandboxRepo.getAll(tenantId);
        const urlParams = context.searchParams;
        const pageParam = urlParams?.get('page');
        const sizeParam = urlParams?.get('size') || urlParams?.get('limit');
        const afterId = urlParams?.get('afterId');

        if (pageParam !== null && pageParam !== undefined) {
          const page = Math.max(0, parseInt(pageParam, 10) || 0);
          const size = Math.max(1, parseInt(sizeParam || '20', 10));
          const start = page * size;
          const content = all.slice(start, start + size);
          return {
            status: 200,
            data: {
              content,
              page,
              size,
              totalElements: all.length,
              totalPages: Math.ceil(all.length / size),
              first: page === 0,
              last: start + size >= all.length,
            },
          };
        }

        if (afterId) {
          const limit = Math.max(1, parseInt(sizeParam || '20', 10));
          const idx = all.findIndex((x) => x.id === afterId);
          const start = idx >= 0 ? idx + 1 : 0;
          const content = all.slice(start, start + limit);
          const nextCursor = content.length > 0 ? content[content.length - 1].id : null;
          return {
            status: 200,
            data: {
              content,
              limit,
              afterId,
              nextCursor,
              hasMore: start + content.length < all.length,
            },
          };
        }

        return { status: 200, data: all };
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
