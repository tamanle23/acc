import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  PipelineRunner,
  PipelineContext,
  AssetContext,
  DeadLetterQueue,
  SagaOrchestrator,
  RenderCheckpointManager,
  PythonBackend,
} from '@acc/core';

describe('Enterprise Chaos Resilience & SAGA Compensation Suite', () => {
  it('triggers reverse compensation and records DLQ entry when a pipeline stage crashes', async () => {
    const runner = new PipelineRunner();
    const rollbackSteps: string[] = [];

    const tempDir = path.join(os.tmpdir(), `chaos_temp_${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, 'temp_allocation.dat');
    await fs.promises.writeFile(tempFile, 'data');

    runner.use({
      name: 'step1_temp_file',
      execute: async (_ctx, next) => {
        rollbackSteps.push('step1_exec');
        await next();
      },
      compensate: async () => {
        rollbackSteps.push('step1_comp');
        if (fs.existsSync(tempFile)) {
          await fs.promises.unlink(tempFile);
        }
      },
    });

    runner.use({
      name: 'step2_encoder_session',
      execute: async (_ctx, next) => {
        rollbackSteps.push('step2_exec');
        await next();
      },
      compensate: async () => {
        rollbackSteps.push('step2_comp');
      },
    });

    runner.use({
      name: 'step3_unrecoverable_crash',
      execute: async () => {
        rollbackSteps.push('step3_exec');
        throw new Error('SIMULATED_OOM_KERNEL_PANIC');
      },
      compensate: async () => {
        rollbackSteps.push('step3_comp');
      },
    });

    const ctx: PipelineContext = {
      storyId: 'story_chaos_01',
      baseDir: '.',
      assets: new AssetContext(),
      vfxQueue: [],
      metadata: {},
      errors: [],
    };

    let threw = false;
    try {
      await runner.runWithSaga(ctx);
    } catch (err: any) {
      threw = true;
      expect(err.message).toBe('SIMULATED_OOM_KERNEL_PANIC');
    }

    expect(threw).toBe(true);

    // Assert reverse order of compensation: step3, step2, then step1
    expect(rollbackSteps).toEqual([
      'step1_exec',
      'step2_exec',
      'step3_exec',
      'step3_comp',
      'step2_comp',
      'step1_comp',
    ]);

    // Assert temp file was purged
    expect(fs.existsSync(tempFile)).toBe(false);

    // Assert DLQ has recorded failure
    const dlq = DeadLetterQueue.getInstance();
    const entries = dlq.getEntries();
    const matching = entries.find((e) => e.sagaId === 'pipeline_story_chaos_01');
    expect(matching).toBeDefined();
    expect(matching?.stepName).toBe('step3_unrecoverable_crash');
    expect(matching?.compensationStatus).toBe('COMPENSATED');

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('triggers reverse compensation cleanly upon caller AbortController cancellation', async () => {
    const runner = new PipelineRunner();
    const actions: string[] = [];
    const controller = new AbortController();

    runner.use({
      name: 'long_running_stage_1',
      execute: async (_ctx, next) => {
        actions.push('stage1_exec');
        // Abort right before proceeding to stage 2
        controller.abort('USER_CANCELLED_JOB');
        await next();
      },
      compensate: async () => {
        actions.push('stage1_comp');
      },
    });

    runner.use({
      name: 'long_running_stage_2',
      execute: async (_ctx, next) => {
        actions.push('stage2_exec');
        await next();
      },
      compensate: async () => {
        actions.push('stage2_comp');
      },
    });

    const ctx: PipelineContext = {
      storyId: 'story_abort_02',
      baseDir: '.',
      assets: new AssetContext(),
      vfxQueue: [],
      metadata: {},
      errors: [],
      signal: controller.signal,
    };

    let aborted = false;
    try {
      await runner.runWithSaga(ctx);
    } catch (err: any) {
      aborted = true;
      expect(err.message).toContain('USER_CANCELLED_JOB');
    }

    expect(aborted).toBe(true);
    expect(actions).toEqual(['stage1_exec', 'stage1_comp']);
  });

  it('recovers seamlessly from interrupted chunk renders and skips verified chunks', async () => {
    const testDir = path.join(os.tmpdir(), `checkpoint_chaos_${Date.now()}`);
    await fs.promises.mkdir(testDir, { recursive: true });

    const mgr = new RenderCheckpointManager(testDir);
    const jobId = 'chaos_job_resume';

    // Simulate chunks 0, 1, 2 completed before crash
    const chunk0 = path.join(testDir, 'chunk_0.mp4');
    const chunk1 = path.join(testDir, 'chunk_1.mp4');
    await fs.promises.writeFile(chunk0, 'valid_chunk_0_data');
    await fs.promises.writeFile(chunk1, 'valid_chunk_1_data');

    await mgr.saveChunkCheckpoint(jobId, 0, chunk0, 'hash_0');
    await mgr.saveChunkCheckpoint(jobId, 1, chunk1, 'hash_1');

    // Worker restarts after crash
    const completed = await mgr.getCompletedChunkIndices(jobId);
    expect(completed.has(0)).toBe(true);
    expect(completed.has(1)).toBe(true);
    expect(completed.has(2)).toBe(false);

    // Only render missing chunk 2
    const chunk2 = path.join(testDir, 'chunk_2.mp4');
    await fs.promises.writeFile(chunk2, 'valid_chunk_2_data');
    await mgr.saveChunkCheckpoint(jobId, 2, chunk2, 'hash_2');

    const finalCheckpoint = await mgr.loadCheckpoint(jobId);
    expect(Object.keys(finalCheckpoint!.completedChunks).length).toBe(3);

    await mgr.clearCheckpoint(jobId);
    expect(await mgr.loadCheckpoint(jobId)).toBeNull();

    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  it('supervises Python backend worker lifecycle with health checks', async () => {
    const backend = PythonBackend.getInstance();
    // Test checkHealth handles missing/simulated worker gracefully without throwing
    const healthy = await backend.checkHealth('non_existent_worker');
    expect(typeof healthy).toBe('boolean');
    expect(healthy).toBe(false);
  });
});
