import { describe, it, expect } from 'bun:test';
import path from 'path';
import fs from 'fs';
import {
  StoryConfigToUniversalIRAdapter,
  VideoIRSchemaValidator,
  RelationalDAGCompiler,
  AssetMetadataProber,
  type LegacyStoryConfig,
} from '../packages/ir/src';

describe('Pioneer E2E Verification: sample-story/story-config.json Adaptation & DAG Resolution', () => {
  it('loads sample-story/story-config.json and compiles into a fully resolved timeline', async () => {
    const storyConfigPath = path.resolve('sample-story/story-config.json');
    expect(fs.existsSync(storyConfigPath)).toBe(true);

    const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;
    const irDoc = StoryConfigToUniversalIRAdapter.adapt(rawJson);

    // 1. Schema Validation
    const validation = VideoIRSchemaValidator.validate(irDoc);
    expect(validation.valid).toBe(true);
    expect(irDoc.tracks.length).toBeGreaterThanOrEqual(3);

    // Verify tracks exist
    const vTrack = irDoc.tracks.find(t => t.id === 'track_v1_main');
    const aTrack = irDoc.tracks.find(t => t.id === 'track_a1_voiceover');
    expect(vTrack).toBeDefined();
    expect(aTrack).toBeDefined();
    expect(vTrack!.sequences.length).toBe(rawJson.scenes!.length);
    expect(aTrack!.sequences.length).toBe(rawJson.scenes!.length);

    // 2. DAG Compilation with Asset Metadata Prober
    const prober = new AssetMetadataProber(path.resolve('sample-story'));
    const compiler = new RelationalDAGCompiler({ prober });
    const timeline = await compiler.compile(irDoc);

    expect(timeline.totalFrames).toBeGreaterThan(0);
    expect(timeline.durationSeconds).toBeGreaterThan(0);

    // 3. Audio-Anchor Invariant check:
    // Scene 1 video and voiceover start at 0
    const vSeq1 = timeline.sequences.get('seq_1_vis')!;
    const aSeq1 = timeline.sequences.get('seq_1_vo')!;
    expect(vSeq1).toBeDefined();
    expect(aSeq1).toBeDefined();
    expect(vSeq1.startFrame).toBe(0);
    expect(aSeq1.startFrame).toBe(0);

    // All sequences exist and have positive durations
    for (let i = 1; i <= rawJson.scenes!.length; i++) {
      const vSeq = timeline.sequences.get(`seq_${i}_vis`)!;
      const aSeq = timeline.sequences.get(`seq_${i}_vo`)!;
      expect(vSeq).toBeDefined();
      expect(aSeq).toBeDefined();
      expect(vSeq.durationFrames).toBeGreaterThan(0);
      expect(aSeq.durationFrames).toBeGreaterThan(0);
    }
  });
});
