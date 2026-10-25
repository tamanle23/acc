import { describe, it, expect } from 'bun:test';
import path from 'path';
import fs from 'fs';
import {
  StoryConfigToUniversalIRAdapter,
  RelationalDAGCompiler,
  AssetMetadataProber,
  type LegacyStoryConfig,
} from '../packages/ir/src';
import {
  IRMasterRenderer,
  IRChunkWorkerPool,
  FFIChunkConcatMuxer,
} from '../packages/ir/src/server';
import { FFmpegManager } from '@acc/core';

describe('Enterprise Parallel Temporal Chunking & Concat (Phase 1)', () => {
  it('calculates deterministic IDR chunk slices matching concurrency requirements', async () => {
    const storyConfigPath = path.resolve('sample-story/story-config.json');
    const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
    const irDoc = StoryConfigToUniversalIRAdapter.adapt(rawJson, undefined, path.resolve('sample-story'));

    const prober = new AssetMetadataProber(path.resolve('sample-story'));
    const compiler = new RelationalDAGCompiler({ prober });
    const timeline = await compiler.compile(irDoc);

    const workerPool = new IRChunkWorkerPool(timeline, 42);

    // Test 1 concurrency
    const slices1 = workerPool.calculateSlices(1);
    expect(slices1.length).toBe(1);
    expect(slices1[0].startFrame).toBe(0);
    expect(slices1[0].endFrame).toBe(timeline.totalFrames);
    expect(slices1[0].frameCount).toBe(timeline.totalFrames);

    // Test 4 concurrency
    const slices4 = workerPool.calculateSlices(4);
    expect(slices4.length).toBe(4);
    expect(slices4[0].startFrame).toBe(0);
    expect(slices4[3].endFrame).toBe(timeline.totalFrames);

    // Verify contiguous frame coverage across all chunks
    for (let i = 0; i < slices4.length - 1; i++) {
      expect(slices4[i].endFrame).toBe(slices4[i + 1].startFrame);
    }

    const totalCalculatedFrames = slices4.reduce((acc, s) => acc + s.frameCount, 0);
    expect(totalCalculatedFrames).toBe(timeline.totalFrames);
  });

  it('guarantees Merkle root and chunk hash determinism under deterministic noise and timeline stepping', async () => {
    const storyConfigPath = path.resolve('sample-story/story-config.json');
    const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
    
    // Slice first 2 scenes for rapid deterministic verification
    const miniConfig: LegacyStoryConfig = {
      ...rawJson,
      scenes: rawJson.scenes?.slice(0, 2),
    };

    const irDoc = StoryConfigToUniversalIRAdapter.adapt(miniConfig, undefined, path.resolve('sample-story'));
    const prober = new AssetMetadataProber(path.resolve('sample-story'));
    const compiler = new RelationalDAGCompiler({ prober });
    const timeline = await compiler.compile(irDoc);

    const poolA = new IRChunkWorkerPool(timeline, 42);
    const poolB = new IRChunkWorkerPool(timeline, 42);

    // Mock progress tracker
    const progressUpdates: number[] = [];
    const resultA = await poolA.render({
      concurrency: 2,
      generateFrameHash: true,
      baseDir: path.resolve('sample-story'),
      onProgress: (p) => {
        progressUpdates.push(p.percent);
      },
    });

    const resultB = await poolB.render({
      concurrency: 2,
      generateFrameHash: true,
      baseDir: path.resolve('sample-story'),
    });

    // Invariant: Bit-identical Merkle root across identical runs
    expect(resultA.merkleRootHash).toBe(resultB.merkleRootHash);
    expect(resultA.chunkHashes).toEqual(resultB.chunkHashes);
    expect(resultA.totalFrames).toBe(timeline.totalFrames);
    expect(resultA.chunkCount).toBe(2);
    expect(progressUpdates.length).toBeGreaterThan(0);
  }, 60000);

  it('executes end-to-end multi-worker video rendering with lossless FFI chunk concatenation', async () => {
    await FFmpegManager.prepare();

    const storyConfigPath = path.resolve('sample-story/story-config.json');
    const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
    
    // Slice first 2 scenes for rapid end-to-end multi-worker video rendering
    const miniConfig: LegacyStoryConfig = {
      ...rawJson,
      scenes: rawJson.scenes?.slice(0, 2),
    };

    const irDoc = StoryConfigToUniversalIRAdapter.adapt(miniConfig, undefined, path.resolve('sample-story'));
    const prober = new AssetMetadataProber(path.resolve('sample-story'));
    const compiler = new RelationalDAGCompiler({ prober });
    const timeline = await compiler.compile(irDoc);

    const outPath = path.resolve('output/test_parallel_chunk_stitched.mp4');
    if (fs.existsSync(outPath)) {
      await fs.promises.unlink(outPath);
    }

    const workerPool = new IRChunkWorkerPool(timeline, 42);

    // Render with 2 parallel workers
    const result = await workerPool.render({
      concurrency: 2,
      outputPath: outPath,
      baseDir: path.resolve('sample-story'),
      generateFrameHash: false,
    });

    expect(fs.existsSync(outPath)).toBe(true);
    const stat = await fs.promises.stat(outPath);
    expect(stat.size).toBeGreaterThan(10000); // Valid generated MP4 file
    expect(result.chunkCount).toBe(2);
    expect(result.totalFrames).toBe(timeline.totalFrames);

    // Clean up test file
    try {
      await fs.promises.unlink(outPath);
    } catch {}
  }, 120000);
});
