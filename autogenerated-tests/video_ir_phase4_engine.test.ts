import { describe, it, expect } from 'bun:test';
import path from 'path';
import fs from 'fs';
import {
  RelationalDAGCompiler,
  AssetMetadataProber,
  IRMasterRenderer,
  IRPreviewEngine,
  DeterministicNoiseGenerator,
  FrameBackpressureLock,
  DecoupledAudioMixer,
  } from '@acc/ir';
import { StoryConfigToUniversalIRAdapter, LegacyStoryConfigAdapter, type LegacyStoryConfig } from '@acc/legacy-story-renderer';

describe('Video IR Phase 4: Deterministic Headless Rasterizer & Interactive Preview Engine', () => {
  it('generates bit-identical frame hashes and cumulative hash across independent runs (Determinism Invariant)', async () => {
    const storyConfigPath = path.resolve('sample-story/story-config.json');
    const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
    const irDoc = StoryConfigToUniversalIRAdapter.adapt(rawJson);

    // Limit to first 30 frames for rapid bit-identical verification
    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(irDoc);
    timeline.totalFrames = 30; // Test window

    const renderer1 = new IRMasterRenderer(timeline, 1337);
    const result1 = await renderer1.render({ generateFrameHash: true });

    const renderer2 = new IRMasterRenderer(timeline, 1337);
    const result2 = await renderer2.render({ generateFrameHash: true });

    expect(result1.totalFrames).toBe(30);
    expect(result2.totalFrames).toBe(30);
    expect(result1.cumulativeHash).toBe(result2.cumulativeHash);
    expect(result1.frameHashes).toEqual(result2.frameHashes!);
    expect(result1.frameHashes!.length).toBe(30);
  });

  it('verifies FrameBackpressureLock enforces synchronous stepping', async () => {
    const lock = new FrameBackpressureLock();

    await lock.acquire(0);
    expect(lock.isLocked()).toBe(true);
    expect(lock.getCurrentFrame()).toBe(0);

    let acquiredNext = false;
    const nextPromise = lock.acquire(1).then(() => {
      acquiredNext = true;
    });

    // Frame 1 should not acquire while Frame 0 is unacknowledged
    expect(acquiredNext).toBe(false);

    lock.acknowledge(0);
    await nextPromise;

    expect(acquiredNext).toBe(true);
    expect(lock.getCurrentFrame()).toBe(1);
    lock.acknowledge(1);
  });

  it('performs sub-16ms random-access playhead seeks in IRPreviewEngine (Preview Mode Invariant)', async () => {
    const storyConfigPath = path.resolve('sample-story/story-config.json');
    const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
    const irDoc = StoryConfigToUniversalIRAdapter.adapt(rawJson);

    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(irDoc);

    const preview = new IRPreviewEngine(timeline);
    preview.setLODScale(0.5);

    // Perform multiple random seeks across the timeline
    const testFrames = [0, 45, 120, 250, 400, 600];
    for (const f of testFrames) {
      const res = preview.seek(f);
      expect(res.frame).toBe(f);
      expect(res.renderScale).toBe(0.5);
      expect(res.activeSequences.length).toBeGreaterThan(0);
      expect(res.latencyMs).toBeLessThan(16.0); // Sub-16ms interactive threshold
    }
  });

  it('mixes decoupled audio streams with dynamic ducking', async () => {
    const storyConfigPath = path.resolve('sample-story/story-config.json');
    const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
    const irDoc = StoryConfigToUniversalIRAdapter.adapt(rawJson);

    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(irDoc);

    const mixer = new DecoupledAudioMixer(48000, 2);
    const audioRes = await mixer.mix(timeline);

    expect(audioRes.sampleRate).toBe(48000);
    expect(audioRes.channels).toBe(2);
    expect(audioRes.totalSamples).toBeGreaterThan(0);
    expect(audioRes.buffer.length).toBe(audioRes.totalSamples * 2);
  });
});
