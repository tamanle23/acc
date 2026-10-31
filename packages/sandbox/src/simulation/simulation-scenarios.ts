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
      { eventType: 'TASK_LOG', taskRef: 'dispatchWarehouse', level: 'SUCCESS', message: 'Shipping label created: TRK-990184423US' },
      { eventType: 'TASK_COMPLETED', taskRef: 'dispatchWarehouse', status: 'COMPLETED', output: { trackingNumber: 'TRK-990184423US', courier: 'FEDEX' } },
      // Workflow Finished
      { eventType: 'WORKFLOW_COMPLETED', message: 'Order fulfillment workflow execution completed in 1.42s' },
    ],
  },

  FRAUD_REJECTED: {
    id: 'FRAUD_REJECTED',
    name: 'Fault: AI Fraud Check Rejected',
    description: 'Fraud screening fails with high velocity anomalies. Downstream Join barrier and payment steps are bypassed/failed.',
    badge: 'Security Warning',
    events: [
      { eventType: 'CONNECTED', message: 'SSE Connection established for simulation' },
      { eventType: 'WORKFLOW_STARTED', message: 'Workflow execution sim_order_pipeline started' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'validateOrder', status: 'IN_PROGRESS', workerId: 'worker-order-01' },
      { eventType: 'TASK_COMPLETED', taskRef: 'validateOrder', status: 'COMPLETED', output: { orderId: 'ORD-8812', valid: true } },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'forkRiskAndInventory', status: 'IN_PROGRESS', workerId: 'engine-decider' },
      { eventType: 'TASK_COMPLETED', taskRef: 'forkRiskAndInventory', status: 'COMPLETED', output: { branches: ['fraudCheck', 'reserveInventory'] } },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'fraudCheck', status: 'IN_PROGRESS', workerId: 'ai-guard-risk-04' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'reserveInventory', status: 'IN_PROGRESS', workerId: 'wh-stock-sync-02' },
      { eventType: 'TASK_LOG', taskRef: 'fraudCheck', level: 'WARN', message: 'Velocity spike detected: IP 185.220.101.5 placed 8 orders in 60 seconds.' },
      { eventType: 'TASK_LOG', taskRef: 'fraudCheck', level: 'ERROR', message: 'Fraud risk threshold exceeded: Score 89 (Max permitted: 65)' },
      { eventType: 'TASK_FAILED', taskRef: 'fraudCheck', status: 'FAILED_WITH_TERMINAL_ERROR', error: 'FraudCheckException: High risk velocity pattern detected', reason: 'High velocity fraud anomaly' },
      { eventType: 'TASK_LOG', taskRef: 'reserveInventory', level: 'INFO', message: 'Reverting preliminary stock reservation due to concurrent branch failure...' },
      { eventType: 'TASK_FAILED', taskRef: 'reserveInventory', status: 'CANCELED', error: 'Canceled by engine decider' },
      { eventType: 'WORKFLOW_TERMINATED', message: 'Workflow terminated abnormally due to security violation at fraudCheck' },
    ],
  },

  PAYMENT_TIMEOUT: {
    id: 'PAYMENT_TIMEOUT',
    name: 'Fault: Payment Gateway Timeout',
    description: 'Stripe gateway encounters socket timeout; task triggers exponential backoff retry before eventual completion.',
    badge: 'Network Fault',
    events: [
      { eventType: 'CONNECTED', message: 'SSE Connection established for simulation' },
      { eventType: 'WORKFLOW_STARTED', message: 'Workflow execution sim_order_pipeline started' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'validateOrder', status: 'IN_PROGRESS', workerId: 'worker-order-01' },
      { eventType: 'TASK_COMPLETED', taskRef: 'validateOrder', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'forkRiskAndInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'forkRiskAndInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'fraudCheck', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'fraudCheck', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'reserveInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'reserveInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'joinRiskAndInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'joinRiskAndInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'managerApproval', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'managerApproval', status: 'COMPLETED' },
      // Payment attempt 1 fails
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'chargePayment', status: 'IN_PROGRESS', workerId: 'stripe-billing-gateway' },
      { eventType: 'TASK_LOG', taskRef: 'chargePayment', level: 'WARN', message: 'HTTP 504 Gateway Timeout connecting to api.stripe.com/v1/charges' },
      { eventType: 'TASK_LOG', taskRef: 'chargePayment', level: 'INFO', message: 'Applying retry policy: Attempt 2 of 3 with backoff...' },
      // Payment retry 2 succeeds
      { eventType: 'TASK_LOG', taskRef: 'chargePayment', level: 'SUCCESS', message: 'Retry attempt #2 succeeded! Payment captured.' },
      { eventType: 'TASK_COMPLETED', taskRef: 'chargePayment', status: 'COMPLETED', output: { charged: true, attempts: 2 } },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'dispatchWarehouse', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'dispatchWarehouse', status: 'COMPLETED' },
      { eventType: 'WORKFLOW_COMPLETED', message: 'Order fulfillment completed after retry recovery' },
    ],
  },

  APPROVAL_ESCALATION: {
    id: 'APPROVAL_ESCALATION',
    name: 'State: Human Approval Escalation',
    description: 'Manager approval breaches SLA threshold (60 minutes). System escalates to VP of Operations pool.',
    badge: 'Human Task Escalation',
    events: [
      { eventType: 'CONNECTED', message: 'SSE Connection established for simulation' },
      { eventType: 'WORKFLOW_STARTED', message: 'Workflow execution sim_order_pipeline started' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'validateOrder', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'validateOrder', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'forkRiskAndInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'forkRiskAndInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'fraudCheck', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'fraudCheck', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'reserveInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'reserveInventory', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'joinRiskAndInventory', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'joinRiskAndInventory', status: 'COMPLETED' },
      // Manager Approval Pending & Escalating
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'managerApproval', status: 'IN_PROGRESS', workerId: 'human-gateway' },
      { eventType: 'TASK_LOG', taskRef: 'managerApproval', level: 'WARN', message: 'SLA timer approaching threshold (55 minutes elapsed)' },
      { eventType: 'TASK_LOG', taskRef: 'managerApproval', level: 'ERROR', message: 'SLA BREACH: Escalating task to role VP_OPERATIONS' },
      { eventType: 'TASK_LOG', taskRef: 'managerApproval', level: 'SUCCESS', message: 'Approved by VP of Operations: sarah.jenkins@acc.io' },
      { eventType: 'TASK_COMPLETED', taskRef: 'managerApproval', status: 'COMPLETED', output: { approved: true, escalated: true } },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'chargePayment', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'chargePayment', status: 'COMPLETED' },
      { eventType: 'TASK_IN_PROGRESS', taskRef: 'dispatchWarehouse', status: 'IN_PROGRESS' },
      { eventType: 'TASK_COMPLETED', taskRef: 'dispatchWarehouse', status: 'COMPLETED' },
      { eventType: 'WORKFLOW_COMPLETED', message: 'Order fulfillment completed after escalation' },
    ],
  },
};
