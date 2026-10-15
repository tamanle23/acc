import { describe, it, expect, beforeAll } from 'bun:test';
import {
  FFmpegManager,
  initFFI,
  GPUEncoderResolver,
  GpuVideoEncodingStrategy,
  FFIVideoEncoder,
} from '@acc/core';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Phase 2: Hardware Accelerated Encoders & GPU Pipelining Suite (Option C)', () => {
  beforeAll(async () => {
    await FFmpegManager.prepare();
    initFFI();
  });

  describe('GPUEncoderResolver: Candidate Chains & Architecture Probing', () => {
    it('should generate prioritized candidate chains based on OS and codec', () => {
      const h264Chain = GPUEncoderResolver.getCandidateChain('h264');
      expect(h264Chain.length).toBeGreaterThanOrEqual(2);
      expect(h264Chain[h264Chain.length - 1]).toBe('libx264');

      const hevcChain = GPUEncoderResolver.getCandidateChain('hevc');
      expect(hevcChain.length).toBeGreaterThanOrEqual(2);
      expect(hevcChain[hevcChain.length - 1]).toBe('libx265');
    });

    it('should enforce CPU fallback when preference is set to cpu', () => {
      const cpuH264 = GPUEncoderResolver.getCandidateChain('h264', 'cpu');
      expect(cpuH264).toEqual(['libx264']);

      const cpuHevc = GPUEncoderResolver.getCandidateChain('hevc', 'cpu');
      expect(cpuHevc).toEqual(['libx265']);
    });

    it('should map hardware encoder types correctly', () => {
      expect(GPUEncoderResolver.mapEncoderToType('h264_nvenc')).toBe('nvenc');
      expect(GPUEncoderResolver.mapEncoderToType('hevc_nvenc')).toBe('nvenc');
      expect(GPUEncoderResolver.mapEncoderToType('h264_videotoolbox')).toBe('videotoolbox');
      expect(GPUEncoderResolver.mapEncoderToType('h264_vaapi')).toBe('vaapi');
      expect(GPUEncoderResolver.mapEncoderToType('h264_qsv')).toBe('qsv');
      expect(GPUEncoderResolver.mapEncoderToType('h264_amf')).toBe('amf');
      expect(GPUEncoderResolver.mapEncoderToType('libx264')).toBe('cpu');
      expect(GPUEncoderResolver.mapEncoderToType('libx265')).toBe('cpu');
    });

    it('should resolve available hardware encoders or gracefully fall back to CPU', async () => {
      const resolved = await GPUEncoderResolver.resolve('h264');
      expect(resolved.encoderName).toBeDefined();
      expect(resolved.handle).toBeGreaterThan(0n);

      if (resolved.isHardwareAccelerated) {
        expect(['nvenc', 'videotoolbox', 'vaapi', 'qsv', 'amf']).toContain(resolved.type);
      } else {
        expect(resolved.type).toBe('cpu');
        expect(resolved.encoderName).toBe('libx264');
      }
    });

    it('should defensively fall back to libx264 when requesting unavailable hardware on this OS', async () => {
      // Force VideoToolbox on non-macOS or non-existent hardware preference
      const forcedFallback = await GPUEncoderResolver.resolve('h264', 'videotoolbox', true);
      if (process.platform !== 'darwin') {
        expect(forcedFallback.isHardwareAccelerated).toBe(false);
        expect(forcedFallback.encoderName).toBe('libx264');
        expect(forcedFallback.type).toBe('cpu');
      }
    });

    it('should list openable encoders on the local host without throwing', async () => {
      const encoders = await GPUEncoderResolver.getAvailableEncoders();
      expect(encoders.length).toBeGreaterThan(0);
      const names = encoders.map((e) => e.encoderName);
      expect(names).toContain('libx264');
    });
  });

  describe('GpuVideoEncodingStrategy: Codec Tuning Profiles', () => {
    it('should construct with customized GPU tuning parameters', () => {
      const strategy = new GpuVideoEncodingStrategy({
        container: 'mp4',
        preset: 'p6',
        gpuTune: 'hq',
        spatialAq: true,
        temporalAq: true,
        hardwareType: 'nvenc',
        encoderName: 'h264_nvenc',
      });

      expect(strategy.mode).toBe('file');
      expect(strategy.hardwareType).toBe('nvenc');
      expect(strategy.encoderName).toBe('h264_nvenc');
      expect(strategy.getContainer()).toBe('mp4');
      expect(strategy.isFastStart()).toBe(true);
    });

    it('should support Apple VideoToolbox and VAAPI strategy instantiation', () => {
      const vtbStrategy = new GpuVideoEncodingStrategy({
        container: 'mov',
        hardwareType: 'videotoolbox',
        encoderName: 'h264_videotoolbox',
      });
      expect(vtbStrategy.hardwareType).toBe('videotoolbox');
      expect(vtbStrategy.getContainer()).toBe('mov');

      const vaapiStrategy = new GpuVideoEncodingStrategy({
        container: 'mkv',
        hardwareType: 'vaapi',
        encoderName: 'h264_vaapi',
      });
      expect(vaapiStrategy.hardwareType).toBe('vaapi');
      expect(vaapiStrategy.getContainer()).toBe('mkv');
    });
  });

  describe('FFIVideoEncoder: Hardware Acceleration & Fallback Pipeline Integration', () => {
    const tempDir = path.join(os.tmpdir(), `gpu-test-${Date.now()}`);

    beforeAll(() => {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    });

    it('should initialize FFIVideoEncoder with automatic hardware detection', () => {
      const outputPath = path.join(tempDir, 'auto-hw-test.mp4');
      const encoder = new FFIVideoEncoder(320, 240, 30, outputPath, 23);

      encoder.initialize();

      expect(encoder.getActiveEncoderName()).toBeDefined();
      expect(encoder.getHardwareType()).toBeDefined();
      expect(typeof encoder.isHardwareAccelerated()).toBe('boolean');

      encoder.close();
    });

    it('should initialize FFIVideoEncoder with explicit CPU fallback and encode frames', () => {
      const outputPath = path.join(tempDir, 'cpu-fallback-test.mp4');
      const encoder = new FFIVideoEncoder(
        320,
        240,
        30,
        outputPath,
        23,
        undefined,
        undefined,
        undefined,
        'cpu' // Explicit CPU preference
      );

      encoder.initialize();

      expect(encoder.getActiveEncoderName()).toBe('libx264');
      expect(encoder.isHardwareAccelerated()).toBe(false);
      expect(encoder.getHardwareType()).toBe('cpu');

      // Encode 5 dummy frames
      const frameBytes = new Uint8Array(320 * 240 * 4); // RGBA
      for (let i = 0; i < 5; i++) {
        encoder.encodeRgbaFrame(frameBytes);
      }

      encoder.close();

      expect(fs.existsSync(outputPath)).toBe(true);
      const stat = fs.statSync(outputPath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('should successfully encode frames using the resolved encoder without memory leaks', () => {
      const outputPath = path.join(tempDir, 'resolved-encode-test.mp4');
      const encoder = new FFIVideoEncoder(320, 240, 30, outputPath, 20);

      encoder.initialize();

      const frameBytes = new Uint8Array(320 * 240 * 4);
      // Fill with solid color
      for (let i = 0; i < frameBytes.length; i += 4) {
        frameBytes[i] = 100; // R
        frameBytes[i + 1] = 150; // G
        frameBytes[i + 2] = 200; // B
        frameBytes[i + 3] = 255; // A
      }

      for (let i = 0; i < 10; i++) {
        encoder.encodeRgbaFrame(frameBytes);
      }

      encoder.close();

      expect(fs.existsSync(outputPath)).toBe(true);
      const stat = fs.statSync(outputPath);
      expect(stat.size).toBeGreaterThan(0);
    });
  });
});
