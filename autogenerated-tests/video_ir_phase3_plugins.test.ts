import { describe, it, expect } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  Depth3DPlugin,
  DynamicDuckingPlugin,
  SplitEditPlugin,
  TransitionCrossfadePlugin,
  BlendModePlugin,
  MacroRenderCommand,
  type RenderCommand,
  type ModifierContext,
} from '../packages/effect-engines/src';
import type { ResolvedTrack, ResolvedSequence } from '@acc/ir';

describe('Video IR Phase 3: Modifier Plugin Registry & Extensible Bridges', () => {
  it('registers all core plugins and confirms listTypes', () => {
    const registry = registerCoreModifierPlugins();
    const types = registry.listTypes();

    expect(types).toContain('vfx/depth3d');
    expect(types).toContain('sfx/dynamic_ducking');
    expect(types).toContain('editorial/split_edit');
    expect(types).toContain('transition/crossfade');
    expect(types).toContain('overlay/blend_mode');
  });

  it('executes Depth3DPlugin and updates modifier context state', async () => {
    const registry = ModifierPluginRegistry.getInstance();
    const mockSeq: ResolvedSequence = {
      id: 'seq_1',
      trackId: 'v1',
      startFrame: 0,
      endFrame: 90,
      durationFrames: 90,
    };

    const ctx: ModifierContext = {
      targetType: 'sequence',
      targetEntity: mockSeq,
      timeline: new Map([['seq_1', mockSeq]]),
      fps: 30,
      canvas: { width: 1920, height: 1080 },
    };

    await registry.executeModifier(ctx, {
      type: 'vfx/depth3d',
      params: { mode: 'frame_breaker', frameStyle: 'polaroid', popOutIntensity: 1.5 },
    });

    expect(ctx.state).toBeDefined();
    expect(ctx.state!.depth3d).toEqual({
      mode: 'frame_breaker',
      frameStyle: 'polaroid',
      popOutIntensity: 1.5,
      active: true,
    });
  });

  it('executes DynamicDuckingPlugin and updates audio ducking state', async () => {
    const registry = ModifierPluginRegistry.getInstance();
    const mockTrack: ResolvedTrack = {
      id: 'track_bgm',
      type: 'audio',
      sequences: [],
    };

    const ctx: ModifierContext = {
      targetType: 'track',
      targetEntity: mockTrack,
      timeline: new Map(),
      fps: 30,
      canvas: { width: 1920, height: 1080 },
    };

    await registry.executeModifier(ctx, {
      type: 'sfx/dynamic_ducking',
      params: { controlTrackId: 'track_voiceover', attenuationDb: -18.0, attackMs: 30 },
    });

    expect(ctx.state?.audioDucking).toEqual({
      controlTrackId: 'track_voiceover',
      attenuationDb: -18.0,
      attackMs: 30,
      holdMs: 250,
      releaseMs: 500,
      active: true,
    });
  });

  it('bypasses unknown modifiers gracefully without throwing (Defensive OCP)', async () => {
    const registry = ModifierPluginRegistry.getInstance();
    const mockSeq: ResolvedSequence = {
      id: 'seq_1',
      trackId: 'v1',
      startFrame: 0,
      endFrame: 90,
      durationFrames: 90,
    };

    const ctx: ModifierContext = {
      targetType: 'sequence',
      targetEntity: mockSeq,
      timeline: new Map(),
      fps: 30,
      canvas: { width: 1920, height: 1080 },
    };

    // Should not throw
    await registry.executeModifier(ctx, {
      type: 'vfx/unknown_experimental_shader',
      params: { intensity: 2.0 },
    });
  });

  it('validates and executes dry-runnable MacroRenderCommand (Command Pattern)', async () => {
    let executedA = false;
    let executedB = false;

    const cmdA: RenderCommand = {
      id: 'cmd_a',
      name: 'DepthMapExtract',
      dryRunValidate: () => ({ valid: true }),
      execute: async () => {
        executedA = true;
        return { success: true, durationMs: 5 };
      },
    };

    const cmdB: RenderCommand = {
      id: 'cmd_b',
      name: 'ChromaKeyDespill',
      dryRunValidate: () => ({ valid: true }),
      execute: async () => {
        executedB = true;
        return { success: true, durationMs: 8 };
      },
    };

    const macro = new MacroRenderCommand('macro_1', '3DPopoutPipeline', [cmdA, cmdB]);
    expect(macro.dryRunValidate().valid).toBe(true);

    const result = await macro.execute();
    expect(result.success).toBe(true);
    expect(executedA).toBe(true);
    expect(executedB).toBe(true);
  });
});
