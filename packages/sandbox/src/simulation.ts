import type { SandboxResponse } from './types';

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Decorates an async response supplier with simulated latency and fault injection.
 */
export async function withSimulationDecorator<T>(
  action: () => Promise<SandboxResponse<T> | null> | SandboxResponse<T> | null,
  options: {
    latencyMinMs: number;
    latencyMaxMs: number;
    faultRate: number;
    faultStatusCode: number;
  }
): Promise<SandboxResponse<T> | null> {
  // 1. Fault injection check
  if (options.faultRate > 0 && Math.random() < options.faultRate) {
    const status = options.faultStatusCode || 500;
    const errorMessages: Record<number, string> = {
      400: 'Simulated Sandbox Bad Request',
      401: 'Simulated Sandbox Unauthorized',
      403: 'Simulated Sandbox Forbidden',
      429: 'Simulated Sandbox Too Many Requests (Rate Limited)',
      500: 'Simulated Sandbox Internal Server Error',
      503: 'Simulated Sandbox Service Unavailable',
    };

    // Calculate delay even on fault if configured
    if (options.latencyMaxMs > 0) {
      const delay =
        options.latencyMinMs +
        Math.random() * (options.latencyMaxMs - options.latencyMinMs);
      await sleep(Math.floor(delay));
    }

    return {
      status,
      statusText: errorMessages[status] || 'Simulated Sandbox Error',
      headers: { 'x-sandbox-fault-injected': 'true' },
      data: {
        error: errorMessages[status] || 'Simulated Sandbox Error',
        status,
        timestamp: new Date().toISOString(),
      } as any,
    };
  }

  // 2. Simulated Latency
  if (options.latencyMaxMs > 0) {
    const delay =
      options.latencyMinMs +
      Math.random() * (options.latencyMaxMs - options.latencyMinMs);
    await sleep(Math.floor(delay));
  }

  // 3. Execute original handler
  return await Promise.resolve(action());
}
