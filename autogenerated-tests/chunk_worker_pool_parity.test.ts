import { StoryConfigToUniversalIRAdapter, LegacyStoryConfigAdapter, type LegacyStoryConfig } from '@acc/legacy-story-renderer';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  RelationalDAGCompiler,
  AssetMetadataProber,
  } from '../packages/ir/src';
import { IRChunkWorkerPool } from '../packages/ir/src/server';
import { FFmpegManager, initFFI, MediaEngineRegistry } from '@acc/core';

describe('Chunk Worker Pool Parity (bun:ffi vs fluent-ffmpeg)', () => {
  const testDir = path.join(os.tmpdir(), 'acc-chunk-pool-parity');
  const outFFI = path.join(testDir, 'chunk_render_ffi.mp4');
  const outFluent = path.join(testDir, 'chunk_render_fluent.mp4');

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

  it('renders multi-chunk timeline with bun:ffi and fluent-ffmpeg with structural parity', async () => {
    const storyConfigPath = path.resolve('sample-story/story-config.json');
    const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;

    // Slice 1 scene for quick verification
    const miniConfig: LegacyStoryConfig = {
      ...rawJson,
      scenes: rawJson.scenes?.slice(0, 1),
    };

    const irDoc = StoryConfigToUniversalIRAdapter.adapt(miniConfig, undefined, path.resolve('sample-story'));
    const prober = new AssetMetadataProber(path.resolve('sample-story'));
    const compiler = new RelationalDAGCompiler({ prober });
    const timeline = await compiler.compile(irDoc);

    const poolFFI = new IRChunkWorkerPool(timeline, 42);
    const resultFFI = await poolFFI.render({
      engine: 'bun-ffi',
      concurrency: 2,
      outputPath: outFFI,
      baseDir: path.resolve('sample-story'),
      generateFrameHash: true,
    });

    const poolFluent = new IRChunkWorkerPool(timeline, 42);
    const resultFluent = await poolFluent.render({
      engine: 'fluent-ffmpeg',
      concurrency: 2,
      outputPath: outFluent,
      baseDir: path.resolve('sample-story'),
      generateFrameHash: true,
    });

    // Verify both completed successfully
    expect(resultFFI.totalFrames).toBe(timeline.totalFrames);
    expect(resultFluent.totalFrames).toBe(timeline.totalFrames);
    expect(resultFFI.chunkCount).toBe(resultFluent.chunkCount);
    expect(resultFFI.chunkCount).toBeGreaterThanOrEqual(1);

    // Verify bit-identical Merkle root of rendered frames
    expect(resultFFI.merkleRootHash).toBe(resultFluent.merkleRootHash);

    // Verify output files exist and are non-empty
    expect(fs.existsSync(outFFI)).toBe(true);
    expect(fs.existsSync(outFluent)).toBe(true);
    expect(fs.statSync(outFFI).size).toBeGreaterThan(1000);
    expect(fs.statSync(outFluent).size).toBeGreaterThan(1000);

    // Verify probe parity
    const fluentEngine = MediaEngineRegistry.get('fluent-ffmpeg');
    const probe = fluentEngine.getProbeStrategy();
    const probeFFI = await probe.probe(outFFI);
    const probeFlu = await probe.probe(outFluent);

    expect(probeFFI.hasVideo).toBe(true);
    expect(probeFlu.hasVideo).toBe(true);
    expect(probeFFI.width).toBe(probeFlu.width);
    expect(probeFFI.height).toBe(probeFlu.height);
  }, 120000);
});
