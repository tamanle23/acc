import { describe, it, expect } from 'bun:test';
import { ModifierPluginRegistry } from '../packages/ir/src/plugins/ModifierPluginRegistry';
import { registerCoreModifierPlugins } from '../packages/ir/src/plugins';
import { VideoIRSchemaValidator } from '../packages/ir/src/schema/VideoIRSchemaValidator';
import type { VideoIRDocument } from '../packages/ir/src/types/VideoIR';
import modifiersSchema from '../schema/modifiers.schema.json';
import videoIRSchema from '../schema/video-ir.schema.json';
import { runSchemaSync } from '../scripts/generate-ir-schemas';

describe('Schema-First Modifier Parity & Synchronization Verification', () => {
  const registry = registerCoreModifierPlugins(new ModifierPluginRegistry());
  const plugins = registry.listPlugins();

  it('should verify schema/video-ir.schema.json and schema/modifiers.schema.json load valid Draft-07 schemas', () => {
    expect(videoIRSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(videoIRSchema.$id).toBe('https://acc.io/schemas/video-ir.schema.json');
    expect(modifiersSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(modifiersSchema.$id).toBe('http://universal-video-ir.schema.org/modifiers.schema.json');
  });

  it('should verify that runSchemaSync runs in check mode with zero drift', () => {
    expect(() => runSchemaSync({ checkOnly: true })).not.toThrow();
  });

  it('should verify all 53 registered plugins exist in ModifierTypeEnum in modifiers.schema.json', () => {
    const enumTypes: string[] = (modifiersSchema.definitions as any).ModifierTypeEnum.enum;
    expect(enumTypes).toHaveLength(53);

    for (const plugin of plugins) {
      expect(enumTypes).toContain(plugin.type);
    }
  });

  it('should validate modernized ColorGradingModifierParams in schema and VideoIRSchemaValidator', () => {
    const colorGradingDef = (modifiersSchema.definitions as any).ColorGradingModifierParams;
    expect(colorGradingDef).toBeDefined();
    expect(colorGradingDef.properties.temperature).toBeDefined();
    expect(colorGradingDef.properties.tint).toBeDefined();
    expect(colorGradingDef.properties.exposure).toBeDefined();
    expect(colorGradingDef.properties.contrast).toBeDefined();
    expect(colorGradingDef.properties.pivot).toBeDefined();
    expect(colorGradingDef.properties.highlights).toBeDefined();
    expect(colorGradingDef.properties.shadows).toBeDefined();
    expect(colorGradingDef.properties.whites).toBeDefined();
    expect(colorGradingDef.properties.blacks).toBeDefined();
    expect(colorGradingDef.properties.vibrance).toBeDefined();
    expect(colorGradingDef.properties.vignetteAmount).toBeDefined();
    expect(colorGradingDef.properties.colorWheels).toBeDefined();

    const validDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'color-grading-test',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'v1',
          type: 'video',
          sequences: [
            {
              id: 'seq1',
              type: 'video',
              time: { start: 0, duration: 60 },
              modifiers: [
                {
                  type: 'vfx/color_grading',
                  target: 'video',
                  params: {
                    temperature: 15,
                    tint: -5,
                    exposure: 0.5,
                    contrast: 1.1,
                    pivot: 0.45,
                    highlights: 10,
                    shadows: -10,
                    whites: 5,
                    blacks: -5,
                    vibrance: 20,
                    vignetteAmount: 0.3,
                    colorWheels: {
                      lift: { x: 0.01, y: -0.02, yLevel: -0.05 },
                    },
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
    expect(result.errors).toEqual([]);
  });

  it('should validate time-space generator modifier parameters in VideoIRSchemaValidator', () => {
    const validDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'timespace-test',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'v1',
          type: 'video',
          sequences: [
            {
              id: 'seq1',
              type: 'overlay',
              time: { start: 0, duration: 60 },
              modifiers: [
                {
                  type: 'time_space/callout_leader',
                  target: 'overlay',
                  params: {
                    text: 'DATA NODE 01',
                    targetX: 0.1,
                    targetY: 0.2,
                    labelX: 0.3,
                    labelY: 0.4,
                    theme: 'cyberpunk',
                    speedMultiplier: 1.2,
                    scale: 1.0,
                    strokeWidth: 2,
                    boundary: 'loop',
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
    expect(result.errors).toEqual([]);
  });

  it('should reject invalid modifier parameters with specific error messages', () => {
    const invalidDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'invalid-test',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'v1',
          type: 'video',
          sequences: [
            {
              id: 'seq1',
              type: 'video',
              time: { start: 0, duration: 60 },
              modifiers: [
                {
                  type: 'vfx/color_grading',
                  target: 'video',
                  params: {
                    contrast: 'high' as any, // Should be number
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = VideoIRSchemaValidator.validate(invalidDoc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('param "contrast" must be a number'))).toBe(true);
  });
});
