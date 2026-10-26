import { describe, it, expect, beforeAll } from 'bun:test';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { bootstrapNode } from '@acc/core';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '@acc/ir';
import { resolveParamControlStrategy } from '../apps/studio/src/components/inspector/ModifierControlStrategies';

describe('Studio Vision UI Wiring & Strategy Resolution Suite', () => {
  beforeAll(async () => {
    await bootstrapNode();
  });

  it('resolves vision strategy control for vision_depth_strategy descriptor', () => {
    const descriptor: any = {
      key: 'depthStrategy',
      label: 'Depth Strategy',
      type: 'vision_depth_strategy',
      defaultValue: 'heuristic',
    };

    const strategyComponent = resolveParamControlStrategy(descriptor);
    expect(strategyComponent).toBeDefined();
    expect(typeof strategyComponent).toBe('function');
  });

  it('resolves vision strategy control for vision_segmentation_strategy descriptor', () => {
    const descriptor: any = {
      key: 'segmentationStrategy',
      label: 'Segmentation Strategy',
      type: 'vision_segmentation_strategy',
      defaultValue: 'grabcut-fallback',
    };

    const strategyComponent = resolveParamControlStrategy(descriptor);
    expect(strategyComponent).toBeDefined();
    expect(typeof strategyComponent).toBe('function');
  });

  it('Depth3DPlugin schema contains vision strategy field descriptors', () => {
    const registry = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(registry);

    const plugin = registry.get('vfx/depth3d');
    expect(plugin).toBeDefined();
    const schema = (plugin as any).schema;
    expect(schema).toBeDefined();
    expect(schema.fields.depthStrategy).toBeDefined();
    expect(schema.fields.depthStrategy.type).toBe('vision_depth_strategy');
    expect(schema.fields.segmentationStrategy).toBeDefined();
    expect(schema.fields.segmentationStrategy.type).toBe('vision_segmentation_strategy');
  });

  it('AutoReframeModifierPlugin schema contains segmentation strategy field descriptor', () => {
    const registry = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(registry);

    const plugin = registry.get('vfx/auto_reframe');
    expect(plugin).toBeDefined();
    const schema = (plugin as any).schema;
    expect(schema).toBeDefined();
    expect(schema.fields.strategyId).toBeDefined();
    expect(schema.fields.strategyId.type).toBe('vision_segmentation_strategy');
  });
});
