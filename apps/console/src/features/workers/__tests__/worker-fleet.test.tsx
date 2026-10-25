import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkerFleetMetrics } from '../components/worker-fleet-metrics';
import { WorkerCard } from '../components/worker-card';
import { workerSandboxHandler, workerFleetMockStore } from '@/core/sandbox/handlers/worker-sandbox-handler';
import type { WorkerTelemetry, WorkerFleetSummary } from '../api/worker-fleet-api';

describe('Worker Fleet Dashboard Components', () => {
  const mockSummary: WorkerFleetSummary = {
    totalWorkers: 4,
    activeLeases: 72,
    totalCompletedTasks: 42670,
    healthyCount: 3,
    degradedCount: 1,
    offlineCount: 0,
    drainingCount: 0,
    tasksPerSecond: 108.0,
  };

  const mockWorkerJava: WorkerTelemetry = {
    workerId: 'worker-java-vt-01',
    hostIp: '10.0.12.44',
    runtime: 'JAVA_VIRTUAL_THREADS',
    pollDomains: ['orders', 'billing'],
    concurrencyLimit: 256,
    activeLeases: 42,
    tasksCompletedCount: 18450,
    errorCount: 2,
    uptimeSeconds: 90000,
    lastHeartbeatEpochMs: Date.now() - 500,
    status: 'HEALTHY',
  };

  const mockWorkerNode: WorkerTelemetry = {
    workerId: 'worker-node-ts-01',
    hostIp: '10.0.14.88',
    runtime: 'NODEJS_WORKER',
    pollDomains: ['webhooks', 'integrations'],
    concurrencyLimit: 64,
    activeLeases: 12,
    tasksCompletedCount: 6890,
    errorCount: 0,
    uptimeSeconds: 45000,
    lastHeartbeatEpochMs: Date.now() - 800,
    status: 'HEALTHY',
  };

  it('renders WorkerFleetMetrics with summary counts and throughput', () => {
    render(<WorkerFleetMetrics summary={mockSummary} />);

    expect(screen.getByTestId('worker-fleet-metrics')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('3 Healthy')).toBeDefined();
    expect(screen.getByText('1 Degraded')).toBeDefined();
    expect(screen.getByText('72')).toBeDefined();
    expect(screen.getByText('108.0')).toBeDefined();
  });

  it('renders WorkerCard with Java Virtual Threads runtime badge and healthy status', () => {
    render(<WorkerCard worker={mockWorkerJava} />);

    expect(screen.getByTestId('worker-card-worker-java-vt-01')).toBeDefined();
    expect(screen.getByText('worker-java-vt-01')).toBeDefined();
    expect(screen.getByText(/Java 21 Virtual Threads/i)).toBeDefined();
    expect(screen.getByText('HEALTHY')).toBeDefined();
    expect(screen.getByText('orders')).toBeDefined();
    expect(screen.getByText('billing')).toBeDefined();
  });

  it('renders WorkerCard with Node.js runtime badge and handles Drain confirmation', async () => {
    const handleDrain = vi.fn();
    render(<WorkerCard worker={mockWorkerNode} onDrain={handleDrain} />);

    expect(screen.getByText(/Node.js @acc\/worker/i)).toBeDefined();

    // Click drain button
    const drainButton = screen.getByRole('button', { name: /drain/i });
    fireEvent.click(drainButton);

    // Confirm drain button appears
    const confirmButton = screen.getByRole('button', { name: /confirm drain/i });
    expect(confirmButton).toBeDefined();

    fireEvent.click(confirmButton);
    expect(handleDrain).toHaveBeenCalledWith('worker-node-ts-01');
  });

  it('verifies workerSandboxHandler handles GET fleet and POST drain requests', async () => {
    workerFleetMockStore.reset();

    // 1. GET fleet
    const getRes = await workerSandboxHandler.handler(
      {
        url: '/api/v1/workflow/workers',
        method: 'GET',
      },
      {} as any
    );

    expect(getRes).not.toBeNull();
    expect(getRes?.status).toBe(200);
    expect(getRes?.data.workers.length).toBeGreaterThan(0);

    // 2. POST drain
    const drainRes = await workerSandboxHandler.handler(
      {
        url: '/api/v1/workflow/workers/worker-java-vt-01/drain',
        method: 'POST',
      },
      {} as any
    );

    expect(drainRes).not.toBeNull();
    expect(drainRes?.status).toBe(200);
    expect(drainRes?.data.success).toBe(true);

    // Re-verify status is DRAINING
    const updatedFleet = workerFleetMockStore.getFleet();
    const drained = updatedFleet.workers.find((w) => w.workerId === 'worker-java-vt-01');
    expect(drained?.status).toBe('DRAINING');
  });
});
