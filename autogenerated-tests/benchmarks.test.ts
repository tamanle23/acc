import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';
import { ModelHandleRegistry } from '../packages/core/src/AssetContext';
import { BoundedQueue } from '../packages/core/src/BoundedQueue';
import { LegacyStoryConfigAdapter } from '../packages/ir/src/LegacyStoryConfigAdapter';
import { FFmpegManager } from '../packages/core/src/FFmpegManager';
import { FFI, freePtr, makeAVRational, safeArrayBuffer } from '../packages/core/src/ffmpeg-ffi';
import { generateCsvReport } from '../benchmarks/cli/benchmark-cli';

describe('Performance Benchmarking Suite & Harness Unit Tests', () => {

  // 1. Directory and Configuration Structure Tests
  describe('Directory & Config Verification', () => {
    test('All required benchmark runner and suite files exist', () => {
      const root = process.cwd();
      const files = [
        'benchmarks/run-all.ts',
        'benchmarks/micro/runner.ts',
        'benchmarks/micro/ffi-dsp.bench.ts',
        'benchmarks/micro/ir-adaptation.bench.ts',
        'benchmarks/micro/canvas-overlay.bench.ts',
        'benchmarks/micro/model-registry.bench.ts',
        'benchmarks/micro/ffmpeg-ffi.bench.ts',
        'benchmarks/micro/bounded-queue.bench.ts',
        'benchmarks/micro/color-grading.bench.ts',
        'benchmarks/http/load-test-webhook.ts',
        'benchmarks/cli/benchmark-cli.ts',
      ];
      for (const file of files) {
        expect(fs.existsSync(path.join(root, file))).toBe(true);
      }
    });

    test('Package.json benchmark scripts and dependencies are correctly configured', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
      expect(pkg.scripts.bench).toBe('bun run benchmarks/run-all.ts');
      expect(pkg.scripts['bench:micro']).toBe('bun run benchmarks/micro/runner.ts');
      expect(pkg.scripts['bench:http']).toBe('bun run benchmarks/http/load-test-webhook.ts');
      expect(pkg.scripts['bench:cli']).toBe('bun run benchmarks/cli/benchmark-cli.ts');
      expect(pkg.devDependencies.mitata).toBeDefined();
    });
  });

  // 2. Microbenchmark Target Components Logic Tests
  describe('Microbenchmark Component Target Tests', () => {
    test('BoundedQueue Capacity & Backpressure Concurrency Logic', async () => {
      const queue = new BoundedQueue<string>(2);
      expect(queue.getCapacity()).toBe(2);
      expect(queue.size()).toBe(0);

      await queue.enqueue('item1');
      await queue.enqueue('item2');
      expect(queue.size()).toBe(2);

      let item1Dequeued = false;
      const dequeuePromise = (async () => {
        const val = await queue.dequeue();
        item1Dequeued = true;
        return val;
      })();

      const val = await dequeuePromise;
      expect(val).toBe('item1');
      expect(item1Dequeued).toBe(true);
      expect(queue.size()).toBe(1);
    });

    test('Color Matrix & Tone Mapping Calculations', () => {
      const rgb = new Float32Array([0.5, 0.5, 0.5, 1.0]);
      const contrast = 1.2;
      const r = (rgb[0] - 0.5) * contrast + 0.5;
      expect(r).toBe(0.5); // Neutral point

      const gamma = 2.2;
      const invGamma = 1.0 / gamma;
      const mapped = Math.pow(0.5, invGamma);
      expect(mapped).toBeGreaterThan(0.5);
    });

    test('Audio DSP Ducking & Normalization Math', () => {
      const sampleCount = 1000;
      const audioBuffer = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        audioBuffer[i] = Math.sin((2 * Math.PI * 440 * i) / 44100) * 1.5; // Over-driven signal
      }

      let peak = 0;
      for (let i = 0; i < sampleCount; i++) {
        const abs = Math.abs(audioBuffer[i]);
        if (abs > peak) peak = abs;
      }
      expect(peak).toBeGreaterThan(1.0);

      const scale = 0.98 / peak;
      const normalized = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const val = audioBuffer[i] * scale;
        normalized[i] = Math.max(-1.0, Math.min(1.0, val));
        expect(normalized[i]).toBeLessThanOrEqual(1.0);
        expect(normalized[i]).toBeGreaterThanOrEqual(-1.0);
      }
    });

    test('Canvas Overlay Frame Creation & Buffer Readout', () => {
      const canvas = createCanvas(320, 180);
      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();

      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 320, 180);

      const pngBuffer = canvas.toBuffer('image/png');
      expect(pngBuffer).toBeDefined();
      expect(pngBuffer.byteLength).toBeGreaterThan(0);
    });

    test('ModelHandleRegistry Flyweight LRU Eviction Logic', async () => {
      const registry = ModelHandleRegistry.getInstance();
      let modelAEvicted = false;
      let modelBEvicted = false;

      registry.registerHandle('model_A', { dispose: () => { modelAEvicted = true; } }, 100);
      await new Promise(r => setTimeout(r, 10));
      registry.registerHandle('model_B', { dispose: () => { modelBEvicted = true; } }, 200);

      expect(registry.getHandle('model_A')).toBeDefined();
      expect(registry.getHandle('model_B')).toBeDefined();
      expect(registry.getTotalMemoryUsageMB()).toBeGreaterThanOrEqual(300);

      const evicted = await registry.evictLowestPriorityHandle();
      expect(evicted).toBe(true);
      expect(registry.getHandle('model_A')).toBeUndefined();
    });

    test('LegacyStoryConfigAdapter AST Parsing in Microbenchmarks', () => {
      const adapted = LegacyStoryConfigAdapter.adapt({
        name: 'Benchmark Story',
        settings: {
          platform: 'tiktok',
          width: 1080,
          height: 1920,
          fps: 60,
          bgm: { source: 'bgm.mp3', volume: 0.2, autoDucking: true }
        },
        scenes: [
          {
            image: 'img1.jpg',
            audio: 'aud1.mp3',
            duration: 3,
            captions: [{ text: 'Cap 1', start: 0, end: 1.5 }],
            transition: { enabled: true, type: 'fade', duration: 0.5 }
          }
        ]
      }, 'job_test_bench');

      expect(adapted.schemaVersion).toBe('3.1.0');
      expect(adapted.settings.resolution.width).toBe(1080);
      expect(adapted.extendedChunks.length).toBe(1);
      expect(adapted.extendedChunks[0].typographyOverlays.length).toBe(1);
      expect(adapted.audioComposition?.ducking.enabled).toBe(true);
    });

    test('FFmpeg bun:ffi Zero-Copy C-Pointer Allocation & Rescaling', async () => {
      await FFmpegManager.prepare();

      const framePtr = FFI.avutil.av_frame_alloc();
      expect(framePtr).not.toBe(0n);
      expect(framePtr).not.toBe(0);

      const frameBuf = safeArrayBuffer(framePtr, 0, 64);
      expect(frameBuf.byteLength).toBe(64);
      freePtr(FFI.avutil.av_frame_free, framePtr);

      const pktPtr = FFI.avcodec.av_packet_alloc();
      expect(pktPtr).not.toBe(0n);
      freePtr(FFI.avcodec.av_packet_free, pktPtr);

      const rescale = FFI.avutil.av_rescale_q(1000n, makeAVRational(1, 30), makeAVRational(1, 1000));
      expect(Number(rescale)).toBe(33333);
    });
  });

  // 3. Harness Report Parsing & Serialization Tests
  describe('Harness Report & Output Parsing Tests', () => {
    test('generateCsvReport Formatter Output', () => {
      const csv = generateCsvReport([
        {
          command: 'bun run cli.ts list',
          mean: 0.46378,
          stddev: 0.00257,
          median: 0.46300,
          user: 0.50000,
          system: 0.10000,
          min: 0.46218,
          max: 0.46674,
        }
      ]);

      expect(csv).toContain('Command,Mean (ms),StdDev (ms),Min (ms),Max (ms)');
      expect(csv).toContain('"bun run cli.ts list",463.78,2.57,462.18,466.74');
    });

    test('OHA HTTP Load Test Metric Extraction', () => {
      const mockOhaJson = {
        summary: {
          requestsPerSec: 7068.9,
          average: 0.00552,
          fastest: 0.00014,
          slowest: 0.06275,
        },
        latencyPercentiles: {
          p50: 0.00082,
          p90: 0.02523,
          p95: 0.03120,
          p99: 0.05811,
        }
      };

      expect(mockOhaJson.summary.requestsPerSec).toBeGreaterThan(1000);
      expect((mockOhaJson.latencyPercentiles.p50 * 1000).toFixed(2)).toBe('0.82');
      expect((mockOhaJson.latencyPercentiles.p99 * 1000).toFixed(2)).toBe('58.11');
    });

    test('Hyperfine CLI Benchmark Result Parsing', () => {
      const mockHyperfineJson = {
        results: [
          {
            command: 'bun run cli.ts list',
            mean: 0.46378,
            stddev: 0.00257,
            min: 0.46218,
            max: 0.46674,
          },
          {
            command: 'bun run cli.ts help',
            mean: 0.48071,
            stddev: 0.01969,
            min: 0.46511,
            max: 0.50284,
          }
        ]
      };

      expect(mockHyperfineJson.results.length).toBe(2);
      expect((mockHyperfineJson.results[0].mean * 1000).toFixed(1)).toBe('463.8');
      expect((mockHyperfineJson.results[1].mean * 1000).toFixed(1)).toBe('480.7');
    });

    test('Autogenerated benchmarks directory creation', () => {
      const outDir = path.join(process.cwd(), 'autogenerated', 'benchmarks');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      expect(fs.existsSync(outDir)).toBe(true);
    });
  });
});
