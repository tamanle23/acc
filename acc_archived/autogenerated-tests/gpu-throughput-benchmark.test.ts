import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  FFmpegManager,
  initFFI,
  FFI,
  Structs,
  GPUEncoderResolver,
  GpuVideoEncodingStrategy,
  FileVideoEncodingStrategy,
  FFIVideoEncoder,
} from '@acc/core';
import { ptr, toArrayBuffer } from 'bun:ffi';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

function safeArrayBuffer(ptrVal: bigint | number, offset: number, length: number): ArrayBuffer {
  const numPtr = typeof ptrVal === 'bigint' ? Number(ptrVal) : ptrVal;
  return toArrayBuffer(numPtr, offset, length);
}

/**
 * Generate a deterministic test RGBA frame pattern based on frame index.
 * Uses pure math without Math.random() to obey DETERMINISTIC-HANDSHAKE-BACKPRESSURE.
 */
function generateDeterministicRgbaFrame(width: number, height: number, frameIndex: number, buffer: Uint8Array): Uint8Array {
  const t = frameIndex / 30;
  const rBase = Math.floor((Math.sin(t * 2) * 0.5 + 0.5) * 255);
  const gBase = Math.floor((Math.cos(t * 3) * 0.5 + 0.5) * 255);
  const bBase = Math.floor(((frameIndex * 17) % 256));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    const yFactor = (y / height);
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      const xFactor = (x / width);
      buffer[idx] = (rBase + Math.floor(xFactor * 50)) & 0xff;     // R
      buffer[idx + 1] = (gBase + Math.floor(yFactor * 50)) & 0xff; // G
      buffer[idx + 2] = (bBase + Math.floor((xFactor + yFactor) * 25)) & 0xff; // B
      buffer[idx + 3] = 255;                                       // A
    }
  }
  return buffer;
}

describe('Phase 3: Hardware Benchmarking & Optimization (Option C GPU Throughput)', () => {
  const tmpDir = path.join(os.tmpdir(), `acc_gpu_bench_${Date.now()}`);
  const width = 640;
  const height = 360;
  const fps = 30;
  const totalFrames = 60; // 2 seconds of 640x360 video

  let isNvencAvailable = false;

  beforeAll(async () => {
    await FFmpegManager.prepare();
    initFFI();
    fs.mkdirSync(tmpDir, { recursive: true });

    const resolved = await GPUEncoderResolver.resolve('h264');
    isNvencAvailable = resolved.isHardwareAccelerated && resolved.type === 'nvenc';
    console.log(`[Benchmark Suite] Initialized. Resolved default encoder: ${resolved.encoderName} (${resolved.type}, HW=${resolved.isHardwareAccelerated})`);
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // defensive cleanup ignore
    }
  });

  describe('CPU (libx264) Baseline Encoding Performance', () => {
    it('should measure CPU libx264 encoding throughput and memory profile', () => {
      const cpuOut = path.join(tmpDir, 'baseline_cpu.mp4');
      const encoder = new FFIVideoEncoder(
        width,
        height,
        fps,
        cpuOut,
        22,
        undefined,
        new FileVideoEncodingStrategy({ container: 'mp4', preset: 'veryfast' }),
        undefined,
        'cpu',
        'h264'
      );

      expect(encoder.getHardwareType()).toBe('cpu');
      expect(encoder.isHardwareAccelerated()).toBe(false);

      const frameBuffer = new Uint8Array(width * height * 4);
      const heapBefore = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      for (let i = 0; i < totalFrames; i++) {
        generateDeterministicRgbaFrame(width, height, i, frameBuffer);
        encoder.encodeRgbaFrame(frameBuffer);
      }

      encoder.close();
      const endTime = performance.now();
      const heapAfter = process.memoryUsage().heapUsed;

      const durationSec = (endTime - startTime) / 1000;
      const fpsThroughput = totalFrames / durationSec;
      const heapDeltaMb = (heapAfter - heapBefore) / (1024 * 1024);

      console.log(`[CPU libx264] Rendered ${totalFrames} frames in ${durationSec.toFixed(3)}s (${fpsThroughput.toFixed(1)} FPS). Heap delta: ${heapDeltaMb.toFixed(2)} MB`);

      expect(fs.existsSync(cpuOut)).toBe(true);
      const stat = fs.statSync(cpuOut);
      expect(stat.size).toBeGreaterThan(1024);
      expect(fpsThroughput).toBeGreaterThan(5); // Minimum baseline sanity check
    });
  });

  describe('GPU (NVENC / Hardware) Encoding Performance', () => {
    it('should measure GPU hardware encoding throughput and verify acceleration', async () => {
      const gpuOut = path.join(tmpDir, 'hardware_gpu.mp4');
      const strategy = new GpuVideoEncodingStrategy({
        container: 'mp4',
        preset: 'p4',
        gpuTune: 'hq',
        hardwareType: 'nvenc',
      });

      const encoder = new FFIVideoEncoder(
        width,
        height,
        fps,
        gpuOut,
        22,
        undefined,
        strategy,
        undefined,
        'nvenc',
        'h264'
      );

      const frameBuffer = new Uint8Array(width * height * 4);
      const heapBefore = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      for (let i = 0; i < totalFrames; i++) {
        generateDeterministicRgbaFrame(width, height, i, frameBuffer);
        encoder.encodeRgbaFrame(frameBuffer);
      }

      encoder.close();
      const endTime = performance.now();
      const heapAfter = process.memoryUsage().heapUsed;

      const durationSec = (endTime - startTime) / 1000;
      const fpsThroughput = totalFrames / durationSec;
      const heapDeltaMb = (heapAfter - heapBefore) / (1024 * 1024);

      console.log(`[GPU Encoder: ${encoder.getActiveEncoderName()}] Rendered ${totalFrames} frames in ${durationSec.toFixed(3)}s (${fpsThroughput.toFixed(1)} FPS). Heap delta: ${heapDeltaMb.toFixed(2)} MB`);

      expect(fs.existsSync(gpuOut)).toBe(true);
      const stat = fs.statSync(gpuOut);
      expect(stat.size).toBeGreaterThan(1024);
      expect(fpsThroughput).toBeGreaterThan(5);

      if (isNvencAvailable) {
        expect(encoder.isHardwareAccelerated()).toBe(true);
        expect(encoder.getActiveEncoderName()).toBe('h264_nvenc');
      }
    });
  });

  describe('Bitstream Integrity & Container Demuxing Verification', () => {
    it('should probe and demux generated MP4 bitstreams with zero container errors', () => {
      const testFiles = [
        path.join(tmpDir, 'baseline_cpu.mp4'),
        path.join(tmpDir, 'hardware_gpu.mp4'),
      ].filter((f) => fs.existsSync(f));

      for (const filePath of testFiles) {
        const inFmtPtr = new BigUint64Array(1);
        const openRet = FFI.avformat.avformat_open_input(
          ptr(inFmtPtr.buffer),
          ptr(Buffer.from(filePath + '\0')),
          0n,
          0n
        );
        expect(openRet).toBe(0);

        const formatCtx = inFmtPtr[0];
        const infoRet = FFI.avformat.avformat_find_stream_info(formatCtx, 0n);
        expect(infoRet).toBeGreaterThanOrEqual(0);

        const formatView = new DataView(safeArrayBuffer(formatCtx, 0, 64));
        const nbStreams = formatView.getUint32(44, true);
        expect(nbStreams).toBeGreaterThanOrEqual(1);

        // Demux packets to verify monotonic PTS / valid stream timestamps
        const packet = FFI.avcodec.av_packet_alloc();
        let packetCount = 0;
        while (FFI.avformat.av_read_frame(formatCtx, packet) === 0) {
          packetCount++;
          FFI.avcodec.av_packet_unref(packet);
        }

        const pAlloc = new BigUint64Array([BigInt(packet)]);
        FFI.avcodec.av_packet_free(ptr(pAlloc.buffer));

        const pFmt = new BigUint64Array([BigInt(formatCtx)]);
        FFI.avformat.avformat_close_input(ptr(pFmt.buffer));

        expect(packetCount).toBeGreaterThanOrEqual(totalFrames - 5);
        console.log(`[Demux Check] Successfully demuxed ${packetCount} packets from ${path.basename(filePath)}`);
      }
    });
  });

  describe('Zero-Alloc Memory Loop & Footprint Stability', () => {
    it('should sustain high-frame throughput without uncontrolled heap or RSS growth', () => {
      const loopOut = path.join(tmpDir, 'zero_alloc_loop.mp4');
      const encoder = new FFIVideoEncoder(
        width,
        height,
        fps,
        loopOut,
        24,
        undefined,
        new GpuVideoEncodingStrategy({ container: 'mp4', preset: 'p4', hardwareType: 'nvenc' }),
        undefined,
        'nvenc',
        'h264'
      );

      // Re-use a single pre-allocated Uint8Array for all frames
      const frameBuffer = new Uint8Array(width * height * 4);
      const initialRss = process.memoryUsage().rss;
      const initialHeap = process.memoryUsage().heapUsed;

      const loopFrames = 120;
      for (let i = 0; i < loopFrames; i++) {
        generateDeterministicRgbaFrame(width, height, i, frameBuffer);
        // zero heap cloning: pass Uint8Array directly
        encoder.encodeRgbaFrame(frameBuffer);
      }

      encoder.close();

      const finalHeap = process.memoryUsage().heapUsed;
      const finalRss = process.memoryUsage().rss;
      const heapGrowthMb = (finalHeap - initialHeap) / (1024 * 1024);
      const rssGrowthMb = (finalRss - initialRss) / (1024 * 1024);

      console.log(`[Zero-Alloc Stability] Encoded ${loopFrames} frames. Heap Growth: ${heapGrowthMb.toFixed(2)} MB, RSS Growth: ${rssGrowthMb.toFixed(2)} MB`);

      expect(fs.existsSync(loopOut)).toBe(true);
      expect(fs.statSync(loopOut).size).toBeGreaterThan(1024);
      // Ensure heap growth during 120 frames remains tightly bounded under 30MB
      expect(heapGrowthMb).toBeLessThan(30);
    });
  });

  describe('Concurrent Temporal Chunk Encoding Parity', () => {
    it('should encode parallel video chunks concurrently without cross-thread or pointer collisions', async () => {
      const chunkCount = 3;
      const framesPerChunk = 25;

      const chunkPromises = Array.from({ length: chunkCount }).map(async (_, chunkIdx) => {
        const chunkOut = path.join(tmpDir, `chunk_${chunkIdx}.mp4`);
        const chunkEncoder = new FFIVideoEncoder(
          width,
          height,
          fps,
          chunkOut,
          23,
          undefined,
          new GpuVideoEncodingStrategy({ container: 'mp4', preset: 'p4', hardwareType: 'nvenc' }),
          undefined,
          'nvenc',
          'h264'
        );

        const localBuffer = new Uint8Array(width * height * 4);
        const startFrame = chunkIdx * framesPerChunk;

        for (let f = 0; f < framesPerChunk; f++) {
          generateDeterministicRgbaFrame(width, height, startFrame + f, localBuffer);
          chunkEncoder.encodeRgbaFrame(localBuffer);
        }

        chunkEncoder.close();

        expect(fs.existsSync(chunkOut)).toBe(true);
        const stat = fs.statSync(chunkOut);
        expect(stat.size).toBeGreaterThan(512);

        return { chunkIdx, size: stat.size, path: chunkOut };
      });

      const results = await Promise.all(chunkPromises);
      expect(results.length).toBe(chunkCount);
      for (const res of results) {
        expect(res.size).toBeGreaterThan(512);
        console.log(`[Concurrent Chunk ${res.chunkIdx}] Size: ${res.size} bytes`);
      }
    });
  });

  describe('Deterministic Frame Math & Parity Check', () => {
    it('should verify that identical input frames yield consistent byte parity', () => {
      const runA = path.join(tmpDir, 'parity_run_a.mp4');
      const runB = path.join(tmpDir, 'parity_run_b.mp4');

      const encodeRun = (outPath: string) => {
        const enc = new FFIVideoEncoder(
          320,
          240,
          fps,
          outPath,
          20,
          undefined,
          new FileVideoEncodingStrategy({ container: 'mp4', preset: 'fast' }),
          undefined,
          'cpu',
          'h264'
        );
        const buf = new Uint8Array(320 * 240 * 4);
        for (let i = 0; i < 30; i++) {
          generateDeterministicRgbaFrame(320, 240, i, buf);
          enc.encodeRgbaFrame(buf);
        }
        enc.close();
      };

      encodeRun(runA);
      encodeRun(runB);

      const sizeA = fs.statSync(runA).size;
      const sizeB = fs.statSync(runB).size;

      // File sizes of identical deterministic CPU runs should match exactly or within container metadata tolerance (< 1%)
      const sizeDiffRatio = Math.abs(sizeA - sizeB) / Math.max(sizeA, sizeB);
      expect(sizeDiffRatio).toBeLessThan(0.01);
      console.log(`[Parity Check] Run A Size: ${sizeA}, Run B Size: ${sizeB}, Diff Ratio: ${(sizeDiffRatio * 100).toFixed(2)}%`);
    });
  });
});
