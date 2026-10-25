import { describe, it, expect } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  TimeSpaceModifierPlugin,
  VideoIRSchemaValidator,
  type VideoIRDocument,
} from '@acc/ir';

describe('TimeSpaceModifierPlugin & VideoIR Integration Suite', () => {
  it('registers TimeSpaceModifierPlugin in isolated and global registries', () => {
    const registry = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(registry);

    expect(registry.has('time_space')).toBe(true);
    const plugin = registry.get('time_space');
    expect(plugin).toBeDefined();
    expect(plugin?.type).toBe('time_space');
  });

  it('renders procedural time_space templates onto canvas context', () => {
    const plugin = new TimeSpaceModifierPlugin();
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillText: () => {},
      measureText: () => ({ width: 100 }),
      roundRect: () => {},
      translate: () => {},
      scale: () => {},
    };

    const clipCtx: any = {
      ctx: mockCtx,
      frame: 15,
      localFrame: 15,
      width: 1920,
      height: 1080,
      sequence: { id: 'seq_callout_1', type: 'overlay' },
    };

    // Render callout_leader
    expect(() => {
      plugin.renderClip(clipCtx, {
        templateId: 'callout_leader',
        seed: 1337,
        params: { targetX: 0, targetY: 0, text: 'TRACKED_01' },
      });
    }).not.toThrow();

    // Render kinetic_title
    expect(() => {
      plugin.renderClip(clipCtx, {
        templateId: 'kinetic_title',
        seed: 42,
        params: { text: 'STUDIO PREVIEW' },
      });
    }).not.toThrow();
  });

  it('validates VideoIRDocument containing time_space modifier according to schema', () => {
    const validDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'story_timespace_01',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track_overlay_vfx',
          type: 'video',
          sequences: [
            {
              id: 'seq_timespace_vfx',
              type: 'overlay',
              time: { start: 0, duration: 5 },
              modifiers: [
                {
                  type: 'time_space',
                  target: 'overlay',
                  params: {
                    templateId: 'callout_leader',
                    seed: 777,
                    boundary: 'loop',
                    renderMode: 'canvas2d',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = VideoIRSchemaValidator.validate(validDoc);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});
