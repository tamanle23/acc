import { describe, it, expect } from 'bun:test';
import { complexSciFiDemoIR } from '../apps/studio/src/lib/ir/complexSciFiDemoIR';
import { VideoIRSchemaValidator } from '../packages/ir/src/schema/VideoIRSchemaValidator';
import { RelationalDAGCompiler } from '../packages/ir/src/compiler/RelationalDAGCompiler';
import { BrowserAssetMetadataProber } from '../apps/studio/src/lib/ir/BrowserAssetMetadataProber';
import { IntervalTreeIndex } from '../packages/ir/src/compiler/IntervalTreeIndex';

describe('Complex Sci-Fi Cyberpunk Demo Multi-Track Validation & DAG Compilation', () => {
  it('strictly passes VideoIRSchemaValidator Draft-07 polymorphic validation', () => {
    const val = VideoIRSchemaValidator.validate(complexSciFiDemoIR);
    expect(val.valid).toBe(true);
    expect(val.errors.length).toBe(0);
  });

  it('compiles all tracks and relational sequences into immutable absolute frame timeline with rich VFX', async () => {
    const prober = new BrowserAssetMetadataProber();
    const compiler = new RelationalDAGCompiler({ prober });
    const timeline = await compiler.compile(complexSciFiDemoIR);

    expect(timeline.tracks.size).toBe(complexSciFiDemoIR.tracks.length);
    expect(timeline.tracks.size).toBeGreaterThanOrEqual(12);
    expect(timeline.totalFrames).toBeGreaterThan(300);

    // Verify IntervalTreeIndex queries across video, 3d depth, audio, and subtitles
    const allSequences = Array.from(timeline.sequences.values());
    const intervalTree = new IntervalTreeIndex(allSequences);

    // At frame 50: V1 (city), V2 (holo), V3 (rain), V4 (hud), V5 (spotlight), A1 (pilot), A4 (bgm), Timed Text (subs & hud)
    const activeAt50 = intervalTree.queryActive(50);
    expect(activeAt50.length).toBeGreaterThanOrEqual(6);

    const hasDepth = activeAt50.some((s) => s.modifiers?.some((m) => m.type === 'vfx/depth3d'));
    expect(hasDepth).toBe(true);

    const hasDucking = activeAt50.some((s) => s.modifiers?.some((m) => m.type === 'sfx/dynamic_ducking'));
    expect(hasDucking).toBe(true);

    // Verify presence of rich VFX modifiers across the compiled timeline
    const allModifiers = allSequences.flatMap((s) => s.modifiers || []);
    expect(allModifiers.some((m) => m.type === 'vfx/color_grading')).toBe(true);
    expect(allModifiers.some((m) => m.type === 'overlay/canvas_particles')).toBe(true);
    expect(allModifiers.some((m) => m.type === 'overlay/hologram_hud')).toBe(true);
    expect(allModifiers.some((m) => m.type === 'vfx/partial')).toBe(true);
    expect(allModifiers.some((m) => m.type === 'transform')).toBe(true);
    expect(allModifiers.some((m) => m.type === 'transition/crossfade')).toBe(true);
    expect(allModifiers.some((m) => m.type === 'audio/filter')).toBe(true);
    expect(allModifiers.some((m) => m.type === 'audio/pan')).toBe(true);
  });
});
