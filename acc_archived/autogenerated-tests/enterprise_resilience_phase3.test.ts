import { describe, it, expect } from 'bun:test';
import path from 'path';
import fs from 'fs';
import {
  AdaptiveResourceGovernor,
  RenderCircuitBreaker,
  CircuitState,
  ModelHandleRegistry,
  ConductorSagaOrchestrator,
  DeadLetterQueue,
} from '../packages/core/src';

describe('Enterprise Resilience, VRAM Isolation & SAGA Workflows (Phase 3)', () => {
  it('AdaptiveResourceGovernor probes system RAM and governs worker concurrency within safe bounds', () => {
    const governor = AdaptiveResourceGovernor.getInstance();
    const snapshot = governor.probeSnapshot();

    expect(snapshot.totalRamGB).toBeGreaterThan(0);
    expect(snapshot.freeRamGB).toBeGreaterThan(0);
    expect(snapshot.cpuCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.recommendedConcurrency).toBeGreaterThanOrEqual(1);
    expect(typeof snapshot.isMemoryConstrained).toBe('boolean');
    expect(typeof snapshot.allowNvencEncoding).toBe('boolean');

    // Concurrency throttle resolution
    const safeAuto = governor.resolveSafeConcurrency('auto');
    expect(safeAuto).toBeGreaterThanOrEqual(1);
    expect(safeAuto).toBeLessThanOrEqual(snapshot.cpuCount);

    const safeExcessive = governor.resolveSafeConcurrency(999);
    expect(safeExcessive).toBeLessThanOrEqual(snapshot.recommendedConcurrency);
  });

  it('ModelHandleRegistry manages reference-counting locks and prevents mid-stream LRU eviction of locked models', async () => {
    const registry = ModelHandleRegistry.getInstance();
    registry.clearAll();

    let disposedA = false;
    let disposedB = false;

    const mockModelA = { id: 'model_depth_anything', dispose: async () => { disposedA = true; } };
    const mockModelB = { id: 'model_sam_2', dispose: async () => { disposedB = true; } };

    registry.registerHandle('model_a', mockModelA, 512);
    registry.registerHandle('model_b', mockModelB, 1024);

    expect(registry.getActiveHandles()).toContain('model_a');
    expect(registry.getActiveHandles()).toContain('model_b');
    expect(registry.getTotalMemoryUsageMB()).toBe(1536);

    // Acquire lock on model_a (e.g. Worker 1 is rendering)
    const lockedA = registry.acquireLock('model_a');
    expect(lockedA).toBeDefined();
    expect(registry.getRefCount('model_a')).toBe(1);

    // Attempting to evict will ignore locked model_a and evict unlocked model_b
    const evicted = await registry.evictLowestPriorityHandle();
    expect(evicted).toBe(true);
    expect(disposedB).toBe(true);
    expect(registry.getActiveHandles()).not.toContain('model_b');
    expect(registry.getActiveHandles()).toContain('model_a');

    // Attempting to release locked model_a without force will fail safely
    const releasedLocked = await registry.releaseHandle('model_a', false);
    expect(releasedLocked).toBe(false);
    expect(disposedA).toBe(false);

    // Release lock on model_a
    const remainingLocks = registry.releaseLock('model_a');
    expect(remainingLocks).toBe(0);

    // Now model_a can be safely released or evicted
    const finalEvicted = await registry.evictLowestPriorityHandle();
    expect(finalEvicted).toBe(true);
    expect(disposedA).toBe(true);
    expect(registry.getActiveHandles().length).toBe(0);
  });

  it('RenderCircuitBreaker transitions across CLOSED, OPEN, and executes fallback hierarchies without crashing', async () => {
    const breaker = new RenderCircuitBreaker('ai_depth_inference', {
      failureThreshold: 2,
      recoveryTimeoutMs: 200,
      timeoutMs: 1000,
    });

    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    let fallbackTriggered = false;

    // First failure
    await breaker.execute(
      async () => { throw new Error('CUDA Out of Memory'); },
      (err) => {
        fallbackTriggered = true;
        return 'fallback_2d_ken_burns';
      }
    );
    expect(fallbackTriggered).toBe(true);
    expect(breaker.getFailureCount()).toBe(1);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // Second failure -> Trips to OPEN
    const result2 = await breaker.execute(
      async () => { throw new Error('CUDA Out of Memory'); },
      () => 'fallback_2d_ken_burns'
    );
    expect(result2).toBe('fallback_2d_ken_burns');
    expect(breaker.getFailureCount()).toBe(2);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Third attempt while OPEN fast-fails immediately to fallback without executing primary
    let primaryExecuted = false;
    const result3 = await breaker.execute(
      async () => { primaryExecuted = true; return 'ai_depth_result'; },
      (err) => `open_circuit_fallback_${err.message}`
    );
    expect(primaryExecuted).toBe(false);
    expect(result3).toContain('open_circuit_fallback_Circuit [ai_depth_inference] is OPEN');

    // Wait for recovery timeout to transition to HALF_OPEN
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    // Successful attempt in HALF_OPEN resets circuit back to CLOSED
    const recovered = await breaker.execute(
      async () => 'healthy_depth_map',
      () => 'fallback'
    );
    expect(recovered).toBe('healthy_depth_map');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('ConductorSagaOrchestrator manages distributed transactions, executes reverse rollbacks on failure, and enqueues to DLQ', async () => {
    const dlq = DeadLetterQueue.getInstance();
    dlq.clear();

    const orchestrator = new ConductorSagaOrchestrator<{ tempFiles: string[]; s3Uploaded: boolean }>('saga_render_publish_101');

    const rollbackLog: string[] = [];

    // Step 1: Allocate temp files
    orchestrator.addStep({
      name: 'allocate_temp_chunks',
      execute: async (ctx) => {
        ctx.tempFiles.push('chunk_0.mp4', 'chunk_1.mp4');
      },
      compensate: async (ctx) => {
        rollbackLog.push('cleaned_temp_chunks');
        ctx.tempFiles = [];
      },
    });

    // Step 2: Upload to Cloudflare R2 / S3
    orchestrator.addStep({
      name: 'upload_to_s3_storage',
      execute: async (ctx) => {
        ctx.s3Uploaded = true;
      },
      compensate: async (ctx) => {
        rollbackLog.push('revoked_s3_asset');
        ctx.s3Uploaded = false;
      },
    });

    // Step 3: Trigger catastrophic publishing failure
    orchestrator.addStep({
      name: 'notify_downstream_webhook',
      execute: async () => {
        throw new Error('Downstream webhook timeout 504 Gateway Error');
      },
      compensate: async () => {
        rollbackLog.push('compensated_failed_webhook');
      },
    });

    const context = { tempFiles: [], s3Uploaded: false };

    let thrownError: Error | undefined;
    try {
      await orchestrator.execute(context);
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError!.message).toContain('504 Gateway Error');

    // Verify reverse compensation order (Step 2 S3 revoked, Step 1 chunks cleaned, Step 3 handled)
    expect(rollbackLog).toContain('revoked_s3_asset');
    expect(rollbackLog).toContain('cleaned_temp_chunks');
    expect(rollbackLog).toContain('compensated_failed_webhook');
    expect(context.tempFiles.length).toBe(0);
    expect(context.s3Uploaded).toBe(false);

    // Verify DLQ capture
    const dlqEntries = dlq.getEntries();
    expect(dlqEntries.length).toBe(1);
    expect(dlqEntries[0].sagaId).toBe('saga_render_publish_101');
    expect(dlqEntries[0].stepName).toBe('notify_downstream_webhook');
    expect(dlqEntries[0].errorPayload.message).toContain('504 Gateway Error');
    expect(dlqEntries[0].compensationStatus).toBe('COMPENSATED');
  });
});
