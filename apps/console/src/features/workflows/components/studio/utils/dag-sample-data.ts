import type { Node, Edge } from '@xyflow/react';
import type { DagNodeData } from '../canvas/dag-node';

export const BLANK_WORKFLOW_NODES: Node<DagNodeData>[] = [
  {
    id: 'node-start',
    type: 'dagNode',
    position: { x: 100, y: 200 },
    data: {
      taskReferenceName: 'workflow_start',
      taskType: 'NOOP',
      label: 'Workflow Start',
      executionState: 'PENDING',
      isPermanent: true,
      isStartNode: true,
      inputParameters: {},
    },
  },
  {
    id: 'node-end',
    type: 'dagNode',
    position: { x: 500, y: 200 },
    data: {
      taskReferenceName: 'workflow_end',
      taskType: 'NOOP',
      label: 'Workflow End',
      executionState: 'PENDING',
      isPermanent: true,
      isEndNode: true,
      inputParameters: {},
    },
  },
];

export const BLANK_WORKFLOW_EDGES: Edge[] = [
  {
    id: 'e_start_to_end',
    type: 'dagEdge',
    source: 'node-start',
    target: 'node-end',
    animated: true,
  },
];

export const INITIAL_NODES: Node<DagNodeData>[] = [
  {
    id: 'node-start',
    type: 'dagNode',
    position: { x: 40, y: 150 },
    data: {
      taskReferenceName: 'workflow_start',
      taskType: 'NOOP',
      label: 'Workflow Start',
      executionState: 'COMPLETED',
      isPermanent: true,
      isStartNode: true,
      inputParameters: {
        orderId: 'ORD-9821',
        speed: 'EXPRESS',
        postalCode: '94107',
      },
    },
  },
  {
    id: 'node-inventory',
    type: 'dagNode',
    position: { x: 280, y: 150 },
    data: {
      taskReferenceName: 'checkInventory',
      taskType: 'SIMPLE',
      label: 'Check Inventory',
      domain: 'inventory',
      timeoutSeconds: 15,
      retryCount: 3,
      retryDelaySeconds: 2,
      backoffRate: 2.0,
      executionState: 'COMPLETED',
      inputParameters: {
        orderId: '${workflow.input.orderId}',
      },
      compensateHandlerRef: 'cancelInventoryReservation',
    },
  },
  {
    id: 'node-route',
    type: 'dagNode',
    position: { x: 520, y: 150 },
    data: {
      taskReferenceName: 'routeShipping',
      taskType: 'SWITCH',
      label: 'Route Shipping',
      condition: '${workflow.input.speed}',
      executionState: 'COMPLETED',
      decisionCases: {
        EXPRESS: ['expressCourier'],
        STANDARD: ['groundPostal'],
      },
      defaultCase: ['groundPostal'],
    },
  },
  {
    id: 'node-courier',
    type: 'dagNode',
    position: { x: 760, y: 70 },
    data: {
      taskReferenceName: 'expressCourier',
      taskType: 'SIMPLE',
      label: 'Express Courier',
      domain: 'shipping',
      timeoutSeconds: 30,
      retryCount: 3,
      executionState: 'IN_PROGRESS',
      inputParameters: {
        trackingNumber: '${checkInventory.output.trackingNumber}',
      },
      compensateHandlerRef: 'cancelCourierBooking',
    },
  },
  {
    id: 'node-ground',
    type: 'dagNode',
    position: { x: 760, y: 230 },
    data: {
      taskReferenceName: 'groundPostal',
      taskType: 'SIMPLE',
      label: 'Ground Postal',
      domain: 'shipping',
      timeoutSeconds: 30,
      retryCount: 2,
      executionState: 'PENDING',
      inputParameters: {
        postalCode: '${workflow.input.postalCode}',
      },
    },
  },
  {
    id: 'node-notify',
    type: 'dagNode',
    position: { x: 1000, y: 150 },
    data: {
      taskReferenceName: 'sendCustomerAlert',
      taskType: 'HTTP',
      label: 'Dispatch SMS/Email Alert',
      executionState: 'PENDING',
      httpMethod: 'POST',
      httpEndpoint: 'https://api.notifications.tekgo.io/v1/dispatch',
      inputParameters: {
        recipient: 'customer@acc.io',
        template: 'SHIPMENT_DISPATCHED',
      },
    },
  },
  {
    id: 'node-end',
    type: 'dagNode',
    position: { x: 1240, y: 150 },
    data: {
      taskReferenceName: 'workflow_end',
      taskType: 'NOOP',
      label: 'Workflow End',
      executionState: 'PENDING',
      isPermanent: true,
      isEndNode: true,
      inputParameters: {},
    },
  },
];

export const INITIAL_EDGES: Edge[] = [
  {
    id: 'e_start_inv',
    type: 'dagEdge',
    source: 'node-start',
    target: 'node-inventory',
    animated: true,
  },
  {
    id: 'e_inv_route',
    type: 'dagEdge',
    source: 'node-inventory',
    target: 'node-route',
    animated: true,
  },
  {
    id: 'e_route_express',
    type: 'dagEdge',
    source: 'node-route',
    target: 'node-courier',
    label: 'EXPRESS',
    animated: true,
    data: { decisionCase: 'EXPRESS' },
  },
  {
    id: 'e_route_ground',
    type: 'dagEdge',
    source: 'node-route',
    target: 'node-ground',
    label: 'DEFAULT',
    animated: true,
    data: { isDefaultCase: true },
  },
  {
    id: 'e_express_notify',
    type: 'dagEdge',
    source: 'node-courier',
    target: 'node-notify',
    animated: true,
  },
  {
    id: 'e_ground_notify',
    type: 'dagEdge',
    source: 'node-ground',
    target: 'node-notify',
    animated: true,
  },
  {
    id: 'e_notify_end',
    type: 'dagEdge',
    source: 'node-notify',
    target: 'node-end',
    animated: true,
  },
];
