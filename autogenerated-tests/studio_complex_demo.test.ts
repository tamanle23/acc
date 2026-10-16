import { describe, it, expect } from 'bun:test';
import { complexSciFiDemoIR } from '../apps/studio/src/lib/ir/complexSciFiDemoIR';
import { VideoIRSchemaValidator } from '../packages/ir/src/schema/VideoIRSchemaValidator';
import { RelationalDAGCompiler } from '../packages/ir/src/compiler/RelationalDAGCompiler';
import { BrowserAssetMetadataProber } from '../apps/studio/src/lib/ir/BrowserAssetMetadataProber';
import { IntervalTreeIndex } from '../packages/ir/src/compiler/IntervalTreeIndex';

describe('Complex Sci-Fi Cyberpunk Demo 9-Track Validation & DAG Compilation', () => {
  it('strictly passes VideoIRSchemaValidator Draft-07 polymorphic validation', () => {
    const val = VideoIRSchemaValidator.validate(complexSciFiDemoIR);
    expect(val.valid).toBe(true);
    expect(val.errors.length).toBe(0);
  });

  it('compiles all 9 tracks and 25 relational sequences into immutable absolute frame timeline', async () => {
    const prober = new BrowserAssetMetadataProber();
    const compiler = new RelationalDAGCompiler({ prober });
    const timeline = await compiler.compile(complexSciFiDemoIR);

    expect(timeline.tracks.size).toBe(complexSciFiDemoIR.tracks.length);
    expect(timeline.totalFrames).toBeGreaterThan(200);

    // Verify IntervalTreeIndex queries across video, 3d depth, audio, and subtitles
    const allSequences = Array.from(timeline.sequences.values());
    const intervalTree = new IntervalTreeIndex(allSequences);

    // At frame 50: V1 (city), V2 (holo), V3 (rain), V4 (hud), A1 (pilot), A3 (bgm), Timed Text (subs & hud)
    const activeAt50 = intervalTree.queryActive(50);
    expect(activeAt50.length).toBeGreaterThanOrEqual(6);

    const hasDepth = activeAt50.some((s) => s.modifiers?.some((m) => m.type === 'vfx/depth3d'));
    expect(hasDepth).toBe(true);

    const hasDucking = activeAt50.some((s) => s.modifiers?.some((m) => m.type === 'sfx/dynamic_ducking'));
    expect(hasDucking).toBe(true);
  });
});
