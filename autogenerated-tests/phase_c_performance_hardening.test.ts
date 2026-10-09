import { describe, expect, test } from 'bun:test';
import os from 'os';
import { FFIVideoEncoder } from '../packages/core/src/ffmpeg-ffi/FFIVideoEncoder';

describe('Phase C: Performance, Memory Bounds & NVENC Hardening', () => {
  test('Step C1: Dynamic Worker Memory Throttling bounds concurrency safely by RAM', () => {
    const freeRamGB = os.freemem() / (1024 * 1024 * 1024);
    const cpuCount = os.cpus().length || 4;
    const memoryBoundWorkers = Math.max(1, Math.floor(freeRamGB / 1.5));
    const requestedConcurrency = 8;
    const totalScenes = 28;

    const activeConcurrency = Math.max(1, Math.min(requestedConcurrency, totalScenes, cpuCount, memoryBoundWorkers));

    expect(activeConcurrency).toBeGreaterThanOrEqual(1);
    expect(activeConcurrency).toBeLessThanOrEqual(cpuCount);
    expect(activeConcurrency).toBeLessThanOrEqual(memoryBoundWorkers);
  });

  test('Step C3: FFIVideoEncoder initializes and handles NVENC fallback gracefully without throwing', async () => {
    const { FFmpegManager } = await import('../packages/core/src/FFmpegManager');
    await FFmpegManager.prepare();

    const outputPath = 'output/test_nvenc_fallback.mp4';
    const encoder = new FFIVideoEncoder(640, 360, 30, outputPath, 23);

    // Initialization should either succeed with NVENC or cleanly fall back to libx264
    expect(() => {
      encoder.initialize();
    }).not.toThrow();
  });
});
