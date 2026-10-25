import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  FFmpegManager,
  initFFI,
  MediaEngineRegistry,
  MediabunnyServerStrategy,
  MediabunnyClientStrategy,
  MediabunnyServerSink,
  MediabunnyClientSink,
  type MediaAudioMixResult,
} from '@acc/core';

describe('Mediabunny Strategies & Sinks (Phase 2)', () => {
  const testDir = path.join(os.tmpdir(), 'acc-mediabunny-test');
  const chunk1Path = path.join(testDir, 'chunk_1.mp4');
  const chunk2Path = path.join(testDir, 'chunk_2.mp4');
  const concatOutputPath = path.join(testDir, 'concatenated.mp4');
  const clientOutputPath = path.join(testDir, 'client_output.mp4');

  const width = 160;
  const height = 120;
  const fps = 30;
  const chunkFrames = 15; // 0.5s each

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

  it('should register mediabunny-server and mediabunny-client strategies in registry', () => {
    expect(MediaEngineRegistry.has('mediabunny-server')).toBe(true);
    expect(MediaEngineRegistry.has('mediabunny-client')).toBe(true);

    const serverStrat = MediaEngineRegistry.get('mediabunny-server');
    expect(serverStrat.id).toBe('mediabunny-server');
    expect(serverStrat.capabilities.supportsBrowserRuntime).toBe(false);
    expect(serverStrat.capabilities.supportsRawFrameStream).toBe(true);
    expect(serverStrat.getChunkPolicy().executionMode).toBe('worker-thread');

    const clientStrat = MediaEngineRegistry.get('mediabunny-client');
    expect(clientStrat.id).toBe('mediabunny-client');
    expect(clientStrat.capabilities.supportsBrowserRuntime).toBe(true);
    expect(clientStrat.capabilities.supportsRawFrameStream).toBe(true);
    expect(clientStrat.getChunkPolicy().executionMode).toBe('web-worker');
  });

  it('should render video chunks using MediabunnyServerSink', async () => {
    const frameBytes = width * height * 4;
    const frameData = new Uint8Array(frameBytes);
    // Fill with solid RGBA color
    for (let i = 0; i < frameBytes; i += 4) {
      frameData[i] = 200;
      frameData[i + 1] = 50;
      frameData[i + 2] = 50;
      frameData[i + 3] = 255;
    }

    // Render Chunk 1
    const sink1 = new MediabunnyServerSink();
    await sink1.initialize({
      width,
      height,
      fps,
      totalFrames: chunkFrames,
      durationSeconds: chunkFrames / fps,
      outputPath: chunk1Path,
      tempDir: testDir,
    });
    for (let f = 0; f < chunkFrames; f++) {
      await sink1.consumeFrame(f, frameData);
    }
    const res1 = await sink1.finalize();
    expect(fs.existsSync(chunk1Path)).toBe(true);
    expect(res1.framesConsumed).toBe(chunkFrames);
    expect(res1.fileSizeBytes).toBeGreaterThan(0);

    // Render Chunk 2
    const sink2 = new MediabunnyServerSink();
    await sink2.initialize({
      width,
      height,
      fps,
      totalFrames: chunkFrames,
      durationSeconds: chunkFrames / fps,
      outputPath: chunk2Path,
      tempDir: testDir,
    });
    for (let f = 0; f < chunkFrames; f++) {
      await sink2.consumeFrame(f, frameData);
    }
    const res2 = await sink2.finalize();
    expect(fs.existsSync(chunk2Path)).toBe(true);
    expect(res2.framesConsumed).toBe(chunkFrames);
    expect(res2.fileSizeBytes).toBeGreaterThan(0);
  });

  it('should probe video metadata using MediabunnyProbeStrategy in pure TypeScript', async () => {
    const serverStrat = MediaEngineRegistry.get('mediabunny-server');
    const prober = serverStrat.getProbeStrategy();

    const probeResult = await prober.probe(chunk1Path);
    expect(probeResult.hasVideo).toBe(true);
    expect(probeResult.width).toBe(width);
    expect(probeResult.height).toBe(height);
    expect(probeResult.durationSeconds).toBeCloseTo(0.5, 1);
    expect(probeResult.codecVideo).toBeDefined();
  });

  it('should perform lossless demux-remux chunk concatenation via MediabunnyConcatStrategy', async () => {
    const serverStrat = MediaEngineRegistry.get('mediabunny-server');
    const concatStrategy = serverStrat.getConcatStrategy();

    await concatStrategy.concatenate([chunk1Path, chunk2Path], concatOutputPath);
    expect(fs.existsSync(concatOutputPath)).toBe(true);

    const prober = serverStrat.getProbeStrategy();
    const probeResult = await prober.probe(concatOutputPath);

    // Total duration should be chunk 1 (0.5s) + chunk 2 (0.5s) = 1.0s
    expect(probeResult.durationSeconds).toBeCloseTo(1.0, 1);
    expect(probeResult.width).toBe(width);
    expect(probeResult.height).toBe(height);
  });

  it('should encode in-memory frames using MediabunnyClientSink', async () => {
    const clientSink = new MediabunnyClientSink();
    const frameBytes = width * height * 4;
    const frameData = new Uint8Array(frameBytes);

    await clientSink.initialize({
      width,
      height,
      fps,
      totalFrames: 10,
      durationSeconds: 10 / fps,
      outputPath: clientOutputPath,
    });

    for (let f = 0; f < 10; f++) {
      await clientSink.consumeFrame(f, frameData);
    }

    const res = await clientSink.finalize();
    expect(res.framesConsumed).toBe(10);
    expect(res.fileSizeBytes).toBeGreaterThan(0);
    expect(fs.existsSync(clientOutputPath)).toBe(true);
    expect(res.stats?.inMemoryBufferSize).toBeGreaterThan(0);
  });

  it('should encode audio with video using MediabunnyServerSink', async () => {
    const audioVideoPath = path.join(testDir, 'audio_video_mb.mp4');
    const sink = new MediabunnyServerSink();

    const sampleRate = 44100;
    const durationSeconds = 0.5;
    const totalSamples = sampleRate * durationSeconds;
    const audioBuffer = new Float32Array(totalSamples * 2);
    for (let i = 0; i < totalSamples; i++) {
      const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.3;
      audioBuffer[i * 2] = sample;
      audioBuffer[i * 2 + 1] = sample;
    }

    const audioResult: MediaAudioMixResult = {
      totalSamples,
      sampleRate,
      channels: 2,
      durationSeconds,
      buffer: audioBuffer,
    };

    await sink.initialize({
      width,
      height,
      fps,
      totalFrames: chunkFrames,
      durationSeconds,
      outputPath: audioVideoPath,
      tempDir: testDir,
    });

    const frameBytes = width * height * 4;
    const frameData = new Uint8Array(frameBytes);
    for (let f = 0; f < chunkFrames; f++) {
      await sink.consumeFrame(f, frameData);
    }

    const res = await sink.finalize(audioResult);
    expect(fs.existsSync(audioVideoPath)).toBe(true);
    expect(res.framesConsumed).toBe(chunkFrames);

    const prober = MediaEngineRegistry.get('mediabunny-server').getProbeStrategy();
    const probe = await prober.probe(audioVideoPath);
    expect(probe.hasVideo).toBe(true);
    expect(probe.hasAudio).toBe(true);
  });
});
