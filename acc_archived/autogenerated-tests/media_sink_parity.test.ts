import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  FFmpegManager,
  initFFI,
  MediaEngineRegistry,
  FFIVideoEncoderSink,
  FluentPipeVideoSink,
  type MediaAudioMixResult,
} from '@acc/core';

describe('Media Sink Parity Test (bun:ffi vs fluent-ffmpeg)', () => {
  const testDir = path.join(os.tmpdir(), 'acc-media-test-parity');
  const ffiOutputPath = path.join(testDir, 'test_sink_ffi.mp4');
  const fluentOutputPath = path.join(testDir, 'test_sink_fluent.mp4');

  const width = 320;
  const height = 240;
  const fps = 30;
  const totalFrames = 30;
  const sampleRate = 44100;
  const durationSeconds = 1.0;

  // Generate synthetic stereo audio PCM (440Hz sine wave)
  const totalSamples = sampleRate * durationSeconds;
  const audioBuffer = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.3;
    audioBuffer[i * 2] = sample;     // Left
    audioBuffer[i * 2 + 1] = sample; // Right
  }

  const audioResult: MediaAudioMixResult = {
    totalSamples,
    sampleRate,
    channels: 2,
    durationSeconds,
    buffer: audioBuffer,
  };

  beforeAll(async () => {
    await FFmpegManager.prepare();
    initFFI();
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('should render 30 frames and audio with FFIVideoEncoderSink (bun:ffi)', async () => {
    const sink = new FFIVideoEncoderSink();
    await sink.initialize({
      width,
      height,
      fps,
      totalFrames,
      durationSeconds,
      outputPath: ffiOutputPath,
    });

    const frameSize = width * height * 4;
    for (let f = 0; f < totalFrames; f++) {
      const frameBuffer = new Uint8Array(frameSize);
      // Fill with dynamic color pattern (red gradient)
      const colorVal = (f * 8) % 255;
      frameBuffer.fill(colorVal);
      sink.consumeFrame(f, frameBuffer);
    }

    const result = await sink.finalize(audioResult);

    expect(result.framesConsumed).toBe(totalFrames);
    expect(fs.existsSync(ffiOutputPath)).toBe(true);
    expect(result.fileSizeBytes).toBeGreaterThan(1000);
  });

  it('should render 30 frames and audio with FluentPipeVideoSink (fluent-ffmpeg)', async () => {
    const sink = new FluentPipeVideoSink();
    await sink.initialize({
      width,
      height,
      fps,
      totalFrames,
      durationSeconds,
      outputPath: fluentOutputPath,
    });

    const frameSize = width * height * 4;
    for (let f = 0; f < totalFrames; f++) {
      const frameBuffer = new Uint8Array(frameSize);
      const colorVal = (f * 8) % 255;
      frameBuffer.fill(colorVal);
      await sink.consumeFrame(f, frameBuffer);
    }

    const result = await sink.finalize(audioResult);

    expect(result.framesConsumed).toBe(totalFrames);
    expect(fs.existsSync(fluentOutputPath)).toBe(true);
    expect(result.fileSizeBytes).toBeGreaterThan(1000);
  });

  it('should demonstrate structural parity between bun:ffi and fluent-ffmpeg outputs', async () => {
    const fluentStrategy = MediaEngineRegistry.get('fluent-ffmpeg');
    const prober = fluentStrategy.getProbeStrategy();

    const probeFFI = await prober.probe(ffiOutputPath);
    const probeFluent = await prober.probe(fluentOutputPath);

    // Structural parity assertions
    expect(probeFFI.hasVideo).toBe(true);
    expect(probeFluent.hasVideo).toBe(true);
    expect(probeFFI.hasAudio).toBe(true);
    expect(probeFluent.hasAudio).toBe(true);

    // Dimension parity
    expect(probeFFI.width).toBe(width);
    expect(probeFluent.width).toBe(width);
    expect(probeFFI.height).toBe(height);
    expect(probeFluent.height).toBe(height);

    // Duration parity within 1 frame tolerance (0.033s)
    expect(Math.abs(probeFFI.durationSeconds - probeFluent.durationSeconds)).toBeLessThanOrEqual(0.1);
  });
});
