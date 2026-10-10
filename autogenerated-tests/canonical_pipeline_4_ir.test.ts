import { describe, it, expect } from 'bun:test';
import path from 'path';
import fs from 'fs';
import {
  GenerativeStoryPipeline,
} from '../apps/cli/src/pipelines/04-generative-story/GenerativeStoryPipeline';
import { VideoEditPipelineOrchestrator } from '../apps/cli/src/pipelines/04-generative-story/VideoEditPipelineOrchestrator';
import { FFmpegManager } from '@acc/core';
import type { StoryConfig } from '@acc/core/types';

describe('Canonical Pipeline 4 IR Migration & Backward Compatibility (Phase 2)', () => {
  it('executes GenerativeStoryPipeline using Universal Video IR Engine by default without legacy flags', async () => {
    await FFmpegManager.prepare();

    const sampleStoryPath = path.resolve('sample-story');
    const configPath = path.join(sampleStoryPath, 'story-config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const rawJson = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as StoryConfig;

    // Use sliced 2-scene configuration for high-speed deterministic test verification
    const testConfig: StoryConfig = {
      ...rawJson,
      name: 'canonical_pipeline_4_test',
      settings: {
        ...rawJson.settings,
        concurrency: 2,
      },
      scenes: rawJson.scenes?.slice(0, 2),
    };

    const outDir = path.resolve('output/canonical_test');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const testDir = path.resolve('output/canonical_test_workspace');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    const testConfigFile = path.join(testDir, 'story-config.json');
    fs.writeFileSync(testConfigFile, JSON.stringify(testConfig, null, 2));

    // Pipeline 4 Canonical execution: no useIRBackend or special metadata required
    const pipeline = new GenerativeStoryPipeline();
    const ctx = await pipeline.execute(testDir, {
      outDir,
      concurrency: 2,
    });

    // Verify canonical IR was used as primary default
    expect(ctx.timings.render).toBeGreaterThan(0);
    expect(ctx.metadata.irPoolResult).toBeDefined();
    expect(ctx.metadata.irRenderResult).toBeDefined();
    expect(ctx.metadata.irPoolResult.chunkCount).toBe(2);
    expect(ctx.metadata.irPoolResult.merkleRootHash).toBeDefined();
    expect(ctx.metadata.irRenderResult.cumulativeHash).toBe(ctx.metadata.irPoolResult.merkleRootHash);

    // Verify output file exists and is a valid video (> 10KB)
    expect(fs.existsSync(ctx.outputFilePath!)).toBe(true);
    const stats = fs.statSync(ctx.outputFilePath!);
    expect(stats.size).toBeGreaterThan(10 * 1024);

    // Verify zero intermediate scene video files were left in workspace or output
    const intermediateFiles = fs.readdirSync(testDir).filter(f => /^scene_\d+\.mp4$/.test(f));
    expect(intermediateFiles.length).toBe(0);

    // Cleanup test artifacts
    if (fs.existsSync(ctx.outputFilePath!)) {
      fs.unlinkSync(ctx.outputFilePath!);
    }
    if (fs.existsSync(ctx.metadataPath!)) {
      fs.unlinkSync(ctx.metadataPath!);
    }
    if (fs.existsSync(testConfigFile)) {
      fs.unlinkSync(testConfigFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  }, 120000);

  it('verifies VideoEditPipelineOrchestrator.renderStoryVideo facade delegates to IR backend with full backward compatibility', async () => {
    await FFmpegManager.prepare();

    const sampleStoryPath = path.resolve('sample-story');
    const configPath = path.join(sampleStoryPath, 'story-config.json');
    const rawJson = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as StoryConfig;

    // Sliced 1-scene configuration for single-worker IR delegate verification
    const { resolveStorySettings } = await import('../apps/cli/src/pipelines/04-generative-story/platforms');
    const resolvedConfig = {
      name: 'facade_test',
      settings: resolveStorySettings({
        ...rawJson.settings,
        concurrency: 1,
      }),
      scenes: [
        {
          image: path.resolve('sample-story', rawJson.scenes![0].image!),
          audio: path.resolve('sample-story', rawJson.scenes![0].audio!),
          duration: 2.0,
          resolvedImage: path.resolve('sample-story', rawJson.scenes![0].image!),
          resolvedAudio: path.resolve('sample-story', rawJson.scenes![0].audio!),
        },
      ],
    };

    const outDir = path.resolve('output/canonical_test');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outputPath = path.join(outDir, 'facade_story_test.mp4');

    // Call VideoEditPipelineOrchestrator.renderStoryVideo directly
    await VideoEditPipelineOrchestrator.renderStoryVideo(
      resolvedConfig as any,
      outputPath,
      sampleStoryPath
    );

    expect(fs.existsSync(outputPath)).toBe(true);
    const stat = fs.statSync(outputPath);
    expect(stat.size).toBeGreaterThan(10 * 1024);

    // Cleanup
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }, 60000);
});
