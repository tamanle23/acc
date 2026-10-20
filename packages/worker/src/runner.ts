import { HttpWorkerTransportClient } from './client/HttpWorkerTransportClient.js';
import { WorkflowWorkerHost } from './host/WorkflowWorkerHost.js';
import { AutoHeartbeatMiddleware } from './middleware/AutoHeartbeatMiddleware.js';
import { ErrorClassificationMiddleware } from './middleware/ErrorClassificationMiddleware.js';

export function createDefaultNodeWorkerHost(
  baseUrl = process.env.UNIPOST_BACKEND_URL || 'http://localhost:8080',
  workerId = process.env.UNIPOST_WORKER_ID || 'ts-sdk-worker-01'
): WorkflowWorkerHost {
  const transport = new HttpWorkerTransportClient({ baseUrl });
  const host = new WorkflowWorkerHost(transport, workerId);

  host
    .use(new ErrorClassificationMiddleware())
    .use(new AutoHeartbeatMiddleware(transport, workerId, 10000));

  host.registerSimple(
    'checkInventory',
    async (ctx) => {
      ctx.log(`Checking warehouse stock for order ${String(ctx.input.orderId ?? 'N/A')}`);
      return {
        inStock: true,
        warehouseId: 'WH-US-EAST-01',
        reservationCode: `TS-RSV-${Date.now().toString().slice(-5)}`,
        checkedBy: workerId,
      };
    },
    {
      domain: 'default',
      description: 'Verifies SKU availability and allocates warehouse reservation slot (TS SDK)',
      inputSchema: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string' },
          sku: { type: 'string' },
          quantity: { type: 'number' },
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
    }
  );

  host.registerSimple(
    'expressCourier',
    async (ctx) => {
      ctx.log(`Dispatching express air courier for ${String(ctx.input.orderId ?? 'N/A')}`);
      return {
        carrier: 'UNIPOST_EXPRESS_AIR',
        trackingNumber: `TS-EXP-${Date.now().toString().slice(-6)}`,
        estimatedDeliveryHours: 18,
      };
    },
    {
      domain: 'default',
      description: 'Books priority overnight air freight label and tracking number (TS SDK)',
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
    }
  );

  return host;
}
