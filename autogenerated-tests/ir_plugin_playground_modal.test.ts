import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  type ResolvedSequence,
  type ResolvedTrack,
  type ClipRenderContext,
  type StreamRenderContext,
  type ModifierNode,
} from '../packages/ir/src';
import {
  PLAYGROUND_PRESETS,
  getPresetsForPlugin,
  extractSchemaDefaults,
} from '../apps/studio/src/components/debugger/playground/playgroundPresets';

describe('IR Plugin & Modifier Visual Playground Verification', () => {
  let registry: ModifierPluginRegistry;

  beforeEach(() => {
    registry = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(registry);
  });

  describe('1. Plugin Discovery & Categorization', () => {
    it('should register and discover 40+ modifier plugins in the isolated registry', () => {
      const types = registry.listTypes();
      expect(types.length).toBeGreaterThanOrEqual(40);
    });

    it('should correctly cover all major functional families', () => {
      const types = registry.listTypes();
      const hasVFX = types.some((t) => t.startsWith('vfx/'));
      const hasOverlay = types.some((t) => t.startsWith('overlay/'));
      const hasTimeSpace = types.some((t) => t.startsWith('time_space'));
      const hasMotion = types.some((t) => t.startsWith('motion/') || t === 'transform');
      const hasText = types.some((t) => t.startsWith('text/') || t.startsWith('timed_text/'));
      const hasEditorial = types.some((t) => t.startsWith('transition/') || t.startsWith('editorial/'));
      const hasAudio = types.some((t) => t.startsWith('audio/') || t.startsWith('sfx/'));

      expect(hasVFX).toBe(true);
      expect(hasOverlay).toBe(true);
      expect(hasTimeSpace).toBe(true);
      expect(hasMotion).toBe(true);
      expect(hasText).toBe(true);
      expect(hasEditorial).toBe(true);
      expect(hasAudio).toBe(true);
    });
  });

  describe('2. Curated Presets & Schema Defaults Extraction', () => {
    it('should have production curated presets for core complex plugins', () => {
      expect(PLAYGROUND_PRESETS['overlay/canvas_particles']).toBeDefined();
      expect(PLAYGROUND_PRESETS['overlay/canvas_particles'].length).toBeGreaterThanOrEqual(3);

      expect(PLAYGROUND_PRESETS['time_space/strange_attractor']).toBeDefined();
      expect(PLAYGROUND_PRESETS['time_space/relativistic_blackhole']).toBeDefined();
      expect(PLAYGROUND_PRESETS['vfx/color_grading']).toBeDefined();
    });

    it('should synthesize valid default presets for all 50+ registered plugins without throwing', () => {
      const types = registry.listTypes();
      for (const type of types) {
        const plugin = registry.get(type);
        expect(plugin).toBeDefined();

        const presets = getPresetsForPlugin(type, plugin?.schema);
        expect(presets.length).toBeGreaterThanOrEqual(1);
        expect(presets[0].name).toBeDefined();
        expect(typeof presets[0].params).toBe('object');
      }
    });

    it('should extract correct default types from schema fields', () => {
      const plugin = registry.get('overlay/canvas_particles');
      const defaults = extractSchemaDefaults(plugin?.schema);

      expect(defaults).toBeDefined();
      expect(typeof defaults).toBe('object');
      expect(defaults.type).toBeDefined();
    });
  });

  describe('3. Polymorphic Execution & Context Stack Delta Auditor', () => {
    // Synthetic mock canvas 2D context
    const createMockContext = () => {
      let saveCalls = 0;
      let restoreCalls = 0;

      const mockCtx: any = {
        save: () => {
          saveCalls++;
        },
        restore: () => {
          restoreCalls++;
        },
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        rect: () => {},
        roundRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        setLineDash: () => {},
        getLineDash: () => [],
        clearRect: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        strokeText: () => {},
        measureText: () => ({ width: 100 }),
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        transform: () => {},
        setTransform: () => {},
        resetTransform: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        drawImage: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(400) }),
        putImageData: () => {},
        canvas: { width: 640, height: 360 },
      };

      return {
        ctx: mockCtx,
        getStackDelta: () => saveCalls - restoreCalls,
      };
    };

    it('should execute renderClipSpace on TimeSpace plugins with zero stack leaks (Δ = 0)', () => {
      const timeSpaceTypes = [
        'time_space/callout_leader',
        'time_space/strange_attractor',
        'time_space/cyber_lower_third',
        'time_space/hud_reticle',
        'time_space/superformula',
        'time_space/relativistic_blackhole',
      ];

      for (const type of timeSpaceTypes) {
        const plugin = registry.get(type);
        if (!plugin || typeof (plugin as any).renderClipSpace !== 'function') continue;

        const { ctx, getStackDelta } = createMockContext();
        const presets = getPresetsForPlugin(type, plugin.schema);
        const params = presets[0].params;

        const clipCtx: ClipRenderContext = {
          canvas: ctx.canvas,
          ctx,
          frame: 30,
          localFrame: 30,
          width: 640,
          height: 360,
          sequence: {
            id: 'seq-test',
            trackId: 'track-test',
            type: 'overlay',
            startFrame: 0,
            endFrame: 180,
            durationFrames: 180,
          },
        };

        (plugin as any).renderClipSpace(clipCtx, params);

        expect(getStackDelta()).toBe(0);
      }
    });

    it('should execute particle overlay rendering with zero stack leaks', () => {
      const plugin = registry.get('overlay/canvas_particles');
      expect(plugin).toBeDefined();

      const { ctx, getStackDelta } = createMockContext();
      const presets = getPresetsForPlugin('overlay/canvas_particles', plugin?.schema);

      const clipCtx: ClipRenderContext = {
        canvas: ctx.canvas,
        ctx,
        frame: 45,
        localFrame: 45,
        width: 640,
        height: 360,
        sequence: {
          id: 'seq-particles',
          trackId: 'track-test',
          type: 'overlay',
          startFrame: 0,
          endFrame: 180,
          durationFrames: 180,
        },
      };

      (plugin as any).renderClipSpace(clipCtx, presets[0].params);
      expect(getStackDelta()).toBe(0);
    });

    it('should execute color grading without throwing exceptions', () => {
      const plugin = registry.get('vfx/color_grading');
      expect(plugin).toBeDefined();

      const { ctx } = createMockContext();
      const presets = getPresetsForPlugin('vfx/color_grading', plugin?.schema);

      const clipCtx: ClipRenderContext = {
        canvas: ctx.canvas,
        ctx,
        frame: 15,
        localFrame: 15,
        width: 640,
        height: 360,
        sequence: {
          id: 'seq-cg',
          trackId: 'track-test',
          type: 'video',
          startFrame: 0,
          endFrame: 180,
          durationFrames: 180,
        },
      };

      expect(() => {
        (plugin as any).renderClipSpace(clipCtx, presets[0].params);
      }).not.toThrow();
    });
  });

  describe('4. ModifierNode Generation & Schema Parity', () => {
    it('should generate valid ModifierNode objects matching IR contracts', () => {
      const types = ['overlay/canvas_particles', 'vfx/color_grading', 'time_space/strange_attractor'];

      for (const type of types) {
        const plugin = registry.get(type)!;
        const presets = getPresetsForPlugin(type, plugin.schema);
        const node: ModifierNode = {
          type,
          target: (plugin.defaultTarget || plugin.allowedSequenceTypes?.[0] || 'overlay') as any,
          params: presets[0].params,
        };

        expect(node.type).toBe(type);
        expect(node.target).toBeDefined();
        expect(node.params).toBeDefined();

        const jsonStr = JSON.stringify(node);
        const parsed = JSON.parse(jsonStr);
        expect(parsed.type).toBe(type);
      }
    });

    it('should correctly handle all 15 ParamFieldType types without throwing', () => {
      const fieldTypes = [
        'number',
        'boolean',
        'string',
        'select',
        'color',
        'curve',
        'motion_lifecycle',
        'shader_group',
        'karaoke_group',
        'sfx_actions',
        'regions_array',
        'vision_depth_strategy',
        'vision_segmentation_strategy',
        'light_vector',
        'group',
      ] as const;

      const mockSchema = {
        displayName: 'Test All Fields Plugin',
        fields: Object.fromEntries(
          fieldTypes.map((t) => [
            `field_${t}`,
            {
              key: `field_${t}`,
              label: `Field ${t}`,
              type: t,
              defaultValue: t === 'number' ? 42 : t === 'boolean' ? true : 'test',
            },
          ])
        ),
      };

      const defaults = extractSchemaDefaults(mockSchema as any);
      expect(defaults.field_number).toBe(42);
      expect(defaults.field_boolean).toBe(true);
      expect(defaults.field_string).toBe('test');
      expect(Object.keys(defaults).length).toBe(15);
    });
  });
});
