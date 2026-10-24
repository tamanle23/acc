import type { Node, Edge } from '@xyflow/react';
import type { DagNodeData } from '@/features/workflows/components/studio/canvas/dag-node';

/**
 * Realistic Multi-Branch Order Fulfillment Pipeline
 * Invariant: Logic nodes (FORK_JOIN and JOIN) are strictly used for branch splitting and convergence.
 * Normal tasks strictly maintain single input and single output connections.
 */
export const MULTI_BRANCH_ORDER_NODES: Node<DagNodeData>[] = [
  {
    id: 'node-start',
    type: 'dagNode',
    position: { x: 50, y: 180 },
    data: {
      taskReferenceName: 'workflow_start',
      taskType: 'NOOP',
      label: 'Order Intake',
      executionState: 'PENDING',
      isPermanent: true,
      isStartNode: true,
      inputParameters: {
        orderId: 'ORD-9921',
        amount: 2450.0,
        riskScore: 42,
        priority: 'HIGH',
      },
    },
  },
  {
    id: 'node-validate',
    type: 'dagNode',
    position: { x: 280, y: 180 },
    data: {
      taskReferenceName: 'validateOrder',
      taskType: 'SIMPLE',
      label: 'Validate Order Schema',
      domain: 'order-processing',
      timeoutSeconds: 15,
      executionState: 'PENDING',
      inputParameters: {
        orderId: '${workflow.input.orderId}',
        amount: '${workflow.input.amount}',
      },
    },
  },
  {
    id: 'node-fork-risk-inventory',
    type: 'dagNode',
    position: { x: 520, y: 180 },
    data: {
      taskReferenceName: 'forkRiskAndInventory',
      taskType: 'FORK_JOIN',
      label: 'Parallel Branch (Risk & Stock)',
      executionState: 'PENDING',
      inputParameters: {},
    },
  },
  {
    id: 'node-fraud-check',
    type: 'dagNode',
    position: { x: 760, y: 80 },
    data: {
      taskReferenceName: 'fraudCheck',
      taskType: 'SIMPLE',
      label: 'AI Fraud Screening',
      domain: 'security',
      timeoutSeconds: 20,
      executionState: 'PENDING',
      inputParameters: {
        orderId: '${validateOrder.output.orderId}',
        riskScore: '${workflow.input.riskScore}',
      },
    },
  },
  {
    id: 'node-reserve-inventory',
    type: 'dagNode',
    position: { x: 760, y: 280 },
    data: {
      taskReferenceName: 'reserveInventory',
      taskType: 'SIMPLE',
      label: 'Reserve Warehouse Stock',
      domain: 'inventory',
      timeoutSeconds: 25,
      executionState: 'PENDING',
      inputParameters: {
        orderId: '${validateOrder.output.orderId}',
      },
    },
  },
  {
    id: 'node-join-risk-inventory',
    type: 'dagNode',
    position: { x: 1000, y: 180 },
    data: {
      taskReferenceName: 'joinRiskAndInventory',
      taskType: 'JOIN',
      label: 'Join Risk & Stock Barrier',
      executionState: 'PENDING',
      inputParameters: {
        joinOn: ['fraudCheck', 'reserveInventory'],
      },
    },
  },
  {
    id: 'node-manager-approval',
    type: 'dagNode',
    position: { x: 1240, y: 180 },
    data: {
      taskReferenceName: 'managerApproval',
      taskType: 'HUMAN',
      label: 'High-Value Order Approval',
      executionState: 'PENDING',
      humanParams: {
        role: 'FINANCE_MANAGER',
        slaMinutes: 60,
        instructions: 'Confirm fraud score is acceptable and high-value credit limit is authorized.',
      },
      inputParameters: {
        orderId: '${validateOrder.output.orderId}',
        fraudPassed: '${fraudCheck.output.passed}',
        stockReserved: '${reserveInventory.output.reserved}',
      },
    },
  },
  {
    id: 'node-charge-card',
    type: 'dagNode',
    position: { x: 1480, y: 180 },
    data: {
      taskReferenceName: 'chargePayment',
      taskType: 'SIMPLE',
      label: 'Process Credit Card Charge',
      domain: 'billing',
      timeoutSeconds: 30,
      executionState: 'PENDING',
      inputParameters: {
        orderId: '${validateOrder.output.orderId}',
        amount: '${workflow.input.amount}',
      },
    },
  },
  {
    id: 'node-dispatch-warehouse',
    type: 'dagNode',
    position: { x: 1720, y: 180 },
    data: {
      taskReferenceName: 'dispatchWarehouse',
      taskType: 'SIMPLE',
      label: 'Dispatch Carrier & Label',
      domain: 'fulfillment',
      timeoutSeconds: 30,
      executionState: 'PENDING',
      inputParameters: {
        orderId: '${validateOrder.output.orderId}',
        chargeReceipt: '${chargePayment.output.receiptId}',
      },
    },
  },
  {
    id: 'node-end',
    type: 'dagNode',
    position: { x: 1960, y: 180 },
    data: {
      taskReferenceName: 'workflow_end',
      taskType: 'NOOP',
      label: 'Fulfillment Completed',
      executionState: 'PENDING',
      isPermanent: true,
      isEndNode: true,
      inputParameters: {
        status: 'DISPATCHED',
      },
    },
  },
];

export const MULTI_BRANCH_ORDER_EDGES: Edge[] = [
  {
    id: 'e_start_validate',
    type: 'dagEdge',
    source: 'node-start',
    target: 'node-validate',
    animated: true,
  },
  {
    id: 'e_validate_fork',
    type: 'dagEdge',
    source: 'node-validate',
    target: 'node-fork-risk-inventory',
    animated: true,
  },
  {
    id: 'e_fork_fraud',
    type: 'dagEdge',
    source: 'node-fork-risk-inventory',
    target: 'node-fraud-check',
    animated: true,
  },
  {
    id: 'e_fork_inventory',
    type: 'dagEdge',
    source: 'node-fork-risk-inventory',
    target: 'node-reserve-inventory',
    animated: true,
  },
  {
    id: 'e_fraud_join',
    type: 'dagEdge',
    source: 'node-fraud-check',
    target: 'node-join-risk-inventory',
    animated: true,
  },
  {
    id: 'e_inventory_join',
    type: 'dagEdge',
    source: 'node-reserve-inventory',
    target: 'node-join-risk-inventory',
    animated: true,
  },
  {
    id: 'e_join_approval',
    type: 'dagEdge',
    source: 'node-join-risk-inventory',
    target: 'node-manager-approval',
    animated: true,
  },
  {
    id: 'e_approval_charge',
    type: 'dagEdge',
    source: 'node-manager-approval',
    target: 'node-charge-card',
    animated: true,
  },
  {
    id: 'e_charge_dispatch',
    type: 'dagEdge',
    source: 'node-charge-card',
    target: 'node-dispatch-warehouse',
    animated: true,
  },
  {
    id: 'e_dispatch_end',
    type: 'dagEdge',
    source: 'node-dispatch-warehouse',
    target: 'node-end',
    animated: true,
  },
];
