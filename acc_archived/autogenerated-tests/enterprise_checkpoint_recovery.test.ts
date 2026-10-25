import { describe, it, expect, afterEach } from 'bun:test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { RenderCheckpointManager } from '@acc/core';

describe('Enterprise Checkpoint & Crash Recovery Suite', () => {
  const testDir = path.join(os.tmpdir(), 'acc_test_checkpoints');
  const manager = new RenderCheckpointManager(testDir);
  const jobId = 'job_enterprise_test_01';

  afterEach(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  it('persists chunk checkpoints and resumes from crash point skipping completed chunks', async () => {
    const totalChunks = 6;
    await manager.initCheckpoint(jobId, totalChunks);

    // Pass 1: Render chunks 0, 1, 2, then simulate crash at 50%
    const renderedFirstPass: number[] = [];
    for (let i = 0; i < 3; i++) {
      await manager.saveChunkCheckpoint(jobId, i, `/fake/chunk_${i}.mp4`, `sha256_chunk_${i}`, {
        durationMs: 5000,
      });
      renderedFirstPass.push(i);
    }

    expect(renderedFirstPass).toEqual([0, 1, 2]);

    // Inspect checkpoint before recovery
    const checkpoint = await manager.loadCheckpoint(jobId);
    expect(checkpoint).not.toBeNull();
    expect(Object.keys(checkpoint!.completedChunks).length).toBe(3);

    const completedSet = await manager.getCompletedChunkIndices(jobId);
    expect(completedSet.has(0)).toBe(true);
    expect(completedSet.has(1)).toBe(true);
    expect(completedSet.has(2)).toBe(true);
    expect(completedSet.has(3)).toBe(false);

    // Pass 2: Resume after crash
    const renderedSecondPass: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const alreadyDone = await manager.isChunkCompleted(jobId, i);
      if (alreadyDone) {
        continue; // Skip chunk
      }
      // Render missing chunk
      await manager.saveChunkCheckpoint(jobId, i, `/fake/chunk_${i}.mp4`, `sha256_chunk_${i}`);
      renderedSecondPass.push(i);
    }

    // Must have rendered ONLY the missing chunks: 3, 4, 5
    expect(renderedSecondPass).toEqual([3, 4, 5]);

    // Verify all chunks are completed
    const finalSet = await manager.getCompletedChunkIndices(jobId);
    expect(finalSet.size).toBe(6);

    // Clean up
    await manager.clearCheckpoint(jobId);
    const cleared = await manager.loadCheckpoint(jobId);
    expect(cleared).toBeNull();
  });
});
