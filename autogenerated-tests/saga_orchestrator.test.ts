import { describe, it, expect, beforeEach } from 'bun:test';
import {
  SagaOrchestrator,
  ConductorSagaOrchestrator,
  DeadLetterQueue,
} from '@acc/core';

describe('SagaOrchestrator & DLQ Test Suite', () => {
  beforeEach(() => {
    DeadLetterQueue.getInstance().clear();
  });

  it('executes all steps sequentially on successful run', async () => {
    const saga = new SagaOrchestrator<{ executionLog: string[] }>('saga_success_1');
    const context = { executionLog: [] };

    saga
      .addStep({
        name: 'step1_allocate',
        execute: async (ctx) => {
          ctx.executionLog.push('step1');
        },
        compensate: async (ctx) => {
          ctx.executionLog.push('undo_step1');
        },
      })
      .addStep({
        name: 'step2_process',
        execute: async (ctx) => {
          ctx.executionLog.push('step2');
        },
        compensate: async (ctx) => {
          ctx.executionLog.push('undo_step2');
        },
      });

    await saga.execute(context);
    expect(context.executionLog).toEqual(['step1', 'step2']);
    expect(saga.getExecutedSteps().length).toBe(2);
    expect(DeadLetterQueue.getInstance().getEntries().length).toBe(0);
  });

  it('triggers reverse compensation and logs to DLQ upon step failure', async () => {
    const saga = new SagaOrchestrator<{ log: string[]; tempCleaned?: boolean }>('saga_fail_1');
    const context = { log: [] as string[], tempCleaned: false };

    saga
      .addStep({
        name: 'step1_temp_disk',
        execute: async (ctx) => {
          ctx.log.push('create_temp');
        },
        compensate: async (ctx) => {
          ctx.log.push('delete_temp');
          ctx.tempCleaned = true;
        },
      })
      .addStep({
        name: 'step2_vram_session',
        execute: async (ctx) => {
          ctx.log.push('lock_vram');
        },
        compensate: async (ctx) => {
          ctx.log.push('release_vram');
        },
      })
      .addStep({
        name: 'step3_crash',
        execute: async () => {
          throw new Error('Out of memory during encoding');
        },
        compensate: async (ctx) => {
          ctx.log.push('cleanup_crash_step');
        },
      });

    await expect(saga.execute(context)).rejects.toThrow('Out of memory during encoding');

    // Rollback order: step2 compensate -> step1 compensate -> failing step compensate
    expect(context.log).toContain('create_temp');
    expect(context.log).toContain('lock_vram');
    expect(context.log).toContain('release_vram');
    expect(context.log).toContain('delete_temp');
    expect(context.tempCleaned).toBe(true);

    // Verify DLQ
    const dlq = DeadLetterQueue.getInstance();
    const entries = dlq.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].sagaId).toBe('saga_fail_1');
    expect(entries[0].stepName).toBe('step3_crash');
    expect(entries[0].errorPayload.message).toBe('Out of memory during encoding');
  });

  it('backward compatibility alias ConductorSagaOrchestrator works identically', () => {
    expect(ConductorSagaOrchestrator).toBe(SagaOrchestrator);
    const legacySaga = new ConductorSagaOrchestrator('legacy_01');
    expect(legacySaga.getSagaId()).toBe('legacy_01');
  });
});
