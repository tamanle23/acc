export type SimulationScenarioId =
  | 'HAPPY_PATH'
  | 'FRAUD_REJECTED'
  | 'PAYMENT_TIMEOUT'
  | 'APPROVAL_ESCALATION';

export interface SimulationStepEvent {
  eventType:
    | 'CONNECTED'
    | 'WORKFLOW_STARTED'
    | 'TASK_IN_PROGRESS'
    | 'TASK_LOG'
    | 'TASK_COMPLETED'
    | 'TASK_FAILED'
    | 'WORKFLOW_PAUSED'
    | 'WORKFLOW_COMPLETED'
    | 'WORKFLOW_TERMINATED';
  taskRef?: string;
  status?: string;
  level?: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  message?: string;
  workerId?: string;
  output?: Record<string, unknown>;
  reason?: string;
  error?: string;
  delayMs?: number;
}

export interface SimulationScenarioConfig {
  id: SimulationScenarioId;
  name: string;
  description: string;
  badge: string;
  events: SimulationStepEvent[];
}

export const SIMULATION_SCENARIOS: Record<SimulationScenarioId, SimulationScenarioConfig> = {
  HAPPY_PATH: {
    id: 'HAPPY_PATH',
    name: 'Happy Path: Complete Fulfillment',
    description: 'All parallel and linear steps execute successfully. Order is validated, risk cleared, inventory reserved, approved, charged, and dispatched.',
    badge: 'Success',
    events: [
      { eventType: 'CONNECTED', message: 'SSE Connection established for simulation' },
      { eventType: 'WORKFLOW_STARTED', message: 'Workflow execution sim_order_pipeline started' },
      // Step 1: Validate Order
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'validateOrder', status: 'IN_PROGRESS', workerId: 'worker-order-01' },
      { eventType: 'TASK_LOG', taskRef: 'validateOrder', level: 'INFO', message: 'Parsing order schema & SKU availability...' },
      { eventType: 'TASK_LOG', taskRef: 'validateOrder', level: 'SUCCESS', message: 'Order parameters validated: 3 line items, total $2,450.00' },
      { eventType: 'TASK_COMPLETED', taskRef: 'validateOrder', status: 'COMPLETED', output: { orderId: 'ORD-9921', valid: true } },
      // Step 2: Parallel Fork
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'forkRiskAndInventory', status: 'IN_PROGRESS', workerId: 'engine-decider' },
      { eventType: 'TASK_COMPLETED', taskRef: 'forkRiskAndInventory', status: 'COMPLETED', output: { branches: ['fraudCheck', 'reserveInventory'] } },
      // Parallel Branch 1: Fraud Check
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'fraudCheck', status: 'IN_PROGRESS', workerId: 'ai-guard-risk-04' },
      { eventType: 'TASK_LOG', taskRef: 'fraudCheck', level: 'INFO', message: 'Running biometric & velocity risk algorithms against historical tenant transactions...' },
      // Parallel Branch 2: Reserve Inventory
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'reserveInventory', status: 'IN_PROGRESS', workerId: 'wh-stock-sync-02' },
      { eventType: 'TASK_LOG', taskRef: 'reserveInventory', level: 'INFO', message: 'Allocating inventory in Zone 4 (Chicago North Hub)...' },
      // Both branches complete
      { eventType: 'TASK_LOG', taskRef: 'fraudCheck', level: 'SUCCESS', message: 'Fraud risk cleared with confidence 98.4%' },
      { eventType: 'TASK_COMPLETED', taskRef: 'fraudCheck', status: 'COMPLETED', output: { passed: true, score: 14 } },
      { eventType: 'TASK_LOG', taskRef: 'reserveInventory', level: 'SUCCESS', message: 'Stock reserved: 2 units SKU-991, Bin #A4-12' },
      { eventType: 'TASK_COMPLETED', taskRef: 'reserveInventory', status: 'COMPLETED', output: { reserved: true, warehouseId: 'wh-chicago-north' } },
      // Step 3: Join Barrier
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'joinRiskAndInventory', status: 'IN_PROGRESS', workerId: 'engine-decider' },
      { eventType: 'TASK_LOG', taskRef: 'joinRiskAndInventory', level: 'INFO', message: 'Synchronizing parallel join barrier [fraudCheck, reserveInventory]...' },
      { eventType: 'TASK_COMPLETED', taskRef: 'joinRiskAndInventory', status: 'COMPLETED', output: { synchronized: true } },
      // Step 4: Manager Approval
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'managerApproval', status: 'IN_PROGRESS', workerId: 'human-gateway' },
      { eventType: 'TASK_LOG', taskRef: 'managerApproval', level: 'INFO', message: 'Human-in-the-loop: Routing approval request to FINANCE_MANAGER pool' },
      { eventType: 'TASK_COMPLETED', taskRef: 'managerApproval', status: 'COMPLETED', output: { approved: true, approver: 'alex.chen@acc.io' } },
      // Step 5: Charge Payment
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'chargePayment', status: 'IN_PROGRESS', workerId: 'stripe-billing-gateway' },
      { eventType: 'TASK_LOG', taskRef: 'chargePayment', level: 'INFO', message: 'Authorizing credit card transaction for $2,450.00 via tokenized payment provider...' },
      { eventType: 'TASK_LOG', taskRef: 'chargePayment', level: 'SUCCESS', message: 'Payment authorized: Capture ID txn_99182301' },
      { eventType: 'TASK_COMPLETED', taskRef: 'chargePayment', status: 'COMPLETED', output: { receiptId: 'txn_99182301', charged: true } },
      // Step 6: Dispatch Warehouse
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'dispatchWarehouse', status: 'IN_PROGRESS', workerId: 'courier-dispatch-01' },
      { eventType: 'TASK_LOG', taskRef: 'dispatchWarehouse', level: 'INFO', message: 'Generating carrier shipping label (FedEx Priority Overnight)...' },
      { eventType: 'TASK_LOG', taskRef: 'dispatchWarehouse', level: 'SUCCESS', message: 'Label printed: Tracking #1Z9999999999999999' },
      { eventType: 'TASK_COMPLETED', taskRef: 'dispatchWarehouse', status: 'COMPLETED', output: { trackingNumber: '1Z9999999999999999', carrier: 'FedEx' } },
      // Completion
      { eventType: 'WORKFLOW_COMPLETED', message: 'Workflow sim_order_pipeline successfully finished all steps' },
    ],
  },

  FRAUD_REJECTED: {
    id: 'FRAUD_REJECTED',
    name: 'Fault: AI Fraud Check Rejected',
    description: 'Fraud screening fails with high velocity anomalies. Downstream Join barrier and payment steps are bypassed/failed.',
    badge: 'Fraud Anomaly',
    events: [
      { eventType: 'CONNECTED', message: 'SSE Connection established for simulation' },
      { eventType: 'WORKFLOW_STARTED', message: 'Workflow execution sim_order_pipeline started' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'validateOrder', status: 'IN_PROGRESS', workerId: 'worker-order-01' },
      { eventType: 'TASK_COMPLETED', taskRef: 'validateOrder', status: 'COMPLETED', output: { orderId: 'ORD-9921', valid: true } },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'forkRiskAndInventory', status: 'IN_PROGRESS', workerId: 'engine-decider' },
      { eventType: 'TASK_COMPLETED', taskRef: 'forkRiskAndInventory', status: 'COMPLETED' },
      // Parallel branches start
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'fraudCheck', status: 'IN_PROGRESS', workerId: 'ai-guard-risk-04' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'reserveInventory', status: 'IN_PROGRESS', workerId: 'wh-stock-sync-02' },
      { eventType: 'TASK_LOG', taskRef: 'fraudCheck', level: 'WARN', message: 'Unusual card velocity detected: 8 cards attempted in 60s' },
      { eventType: 'TASK_LOG', taskRef: 'fraudCheck', level: 'ERROR', message: 'AI Fraud evaluation score 96/100 (Threshold: 50). Rejecting order transaction.' },
      // Fraud Check Fails
      { eventType: 'TASK_FAILED', taskRef: 'fraudCheck', status: 'FAILED', error: 'High fraud risk score (96) detected by AI screening engine' },
      // Inventory completes but gets rolled back
      { eventType: 'TASK_COMPLETED', taskRef: 'reserveInventory', status: 'COMPLETED', output: { reserved: true } },
      { eventType: 'TASK_LOG', taskRef: 'reserveInventory', level: 'WARN', message: 'Compensating transaction triggered: Releasing warehouse stock reservation' },
      // Join Barrier Fails
      { eventType: 'TASK_FAILED', taskRef: 'joinRiskAndInventory', status: 'FAILED', error: 'Prerequisite branch fraudCheck failed' },
      { eventType: 'WORKFLOW_TERMINATED', reason: 'Order execution terminated due to critical fraud failure' },
    ],
  },

  PAYMENT_TIMEOUT: {
    id: 'PAYMENT_TIMEOUT',
    name: 'Fault: Payment Gateway Timeout',
    description: 'Risk and stock clear, approval succeeds, but third-party payment gateway fails with 504 Gateway Timeout after 3 retries.',
    badge: 'Gateway Timeout',
    events: [
      { eventType: 'CONNECTED', message: 'SSE Connection established for simulation' },
      { eventType: 'WORKFLOW_STARTED', message: 'Workflow execution sim_order_pipeline started' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'validateOrder', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'validateOrder', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'forkRiskAndInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'forkRiskAndInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'fraudCheck', status: 'IN_PROGRESS' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'reserveInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'fraudCheck', status: 'COMPLETED' },
      { eventType: 'TASK_COMPLETED', taskRef: 'reserveInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'joinRiskAndInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'joinRiskAndInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'managerApproval', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'managerApproval', status: 'COMPLETED' },
      // Payment Step with Retries & Failure
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'chargePayment', status: 'IN_PROGRESS', workerId: 'stripe-billing-gateway' },
      { eventType: 'TASK_LOG', taskRef: 'chargePayment', level: 'INFO', message: 'Contacting external credit gateway (Attempt 1/3)...' },
      { eventType: 'TASK_LOG', taskRef: 'chargePayment', level: 'WARN', message: 'HTTP 504 Gateway Timeout from payment processor' },
      { eventType: 'TASK_LOG', taskRef: 'chargePayment', level: 'INFO', message: 'Retrying transaction with exponential backoff (Attempt 2/3)...' },
      { eventType: 'TASK_LOG', taskRef: 'chargePayment', level: 'ERROR', message: 'Exhausted maximum retry budget for chargePayment' },
      { eventType: 'TASK_FAILED', taskRef: 'chargePayment', status: 'FAILED', error: 'Payment gateway timeout: downstream provider unreachable' },
      { eventType: 'WORKFLOW_TERMINATED', reason: 'Unrecoverable failure in chargePayment: gateway timeout' },
    ],
  },

  APPROVAL_ESCALATION: {
    id: 'APPROVAL_ESCALATION',
    name: 'State: Human Approval Escalation',
    description: 'Execution runs through validation, parallel risk and stock checks, and pauses indefinitely awaiting Human Approval.',
    badge: 'Awaiting Action',
    events: [
      { eventType: 'CONNECTED', message: 'SSE Connection established for simulation' },
      { eventType: 'WORKFLOW_STARTED', message: 'Workflow execution sim_order_pipeline started' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'validateOrder', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'validateOrder', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'forkRiskAndInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'forkRiskAndInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'fraudCheck', status: 'IN_PROGRESS' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'reserveInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'fraudCheck', status: 'COMPLETED' },
      { eventType: 'TASK_COMPLETED', taskRef: 'reserveInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'joinRiskAndInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'joinRiskAndInventory', status: 'COMPLETED' },
      // Pauses at Manager Approval
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'managerApproval', status: 'WAITING_FOR_APPROVAL', workerId: 'human-gateway' },
      { eventType: 'TASK_LOG', taskRef: 'managerApproval', level: 'WARN', message: 'Execution paused. Order flagged for manual credit evaluation by FINANCE_MANAGER.' },
      { eventType: 'WORKFLOW_PAUSED', message: 'Workflow sim_order_pipeline is paused awaiting human approval' },
    ],
  },
};
