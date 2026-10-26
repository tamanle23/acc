import { describe, it, expect, beforeAll } from 'bun:test';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { bootstrapNode } from '@acc/core';
import {
  ModifierPluginRegistry,
  AutoReframeModifierPlugin,
  registerCoreModifierPlugins,
} from '@acc/ir';

describe('AutoReframeModifierPlugin Unit Suite', () => {
  beforeAll(async () => {
    await bootstrapNode();
  });

  it('registers vfx/auto_reframe in ModifierPluginRegistry automatically', () => {
    const registry = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(registry);

    expect(registry.has('vfx/auto_reframe')).toBe(true);
    const plugin = registry.get('vfx/auto_reframe');
    expect(plugin).toBeDefined();
    expect(plugin?.type).toBe('vfx/auto_reframe');
    expect(plugin?.targetPhase).toBe(2);
    expect(plugin?.targetScope).toBe('sequence');
  });

  it('validates and executes preflight context state successfully', async () => {
    const plugin = new AutoReframeModifierPlugin();
    const isValid = plugin.validate({ targetAspectRatio: '9:16', smoothingFactor: 0.8 });
    expect(isValid).toBe(true);

    const context: any = {
      canvas: UniversalCanvasProvider.createCanvas(1920, 1080),
      state: {},
    };

    await plugin.execute(context, {
      enabled: true,
      targetAspectRatio: '9:16',
      smoothingFactor: 0.8,
    });

    expect(context.state.autoReframe).toBeDefined();
    expect(context.state.autoReframe.targetAspectRatio).toBe('9:16');
    expect(context.state.autoReframe.smoothingFactor).toBe(0.8);
  });

  it('renders visual guide overlay without throwing on Canvas context', () => {
    const plugin = new AutoReframeModifierPlugin();
    const canvas = UniversalCanvasProvider.createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d');

    const renderCtx: any = {
      canvas,
      ctx,
      frame: 10,
      sequence: { id: 'seq-test-reframe' },
    };

    expect(() => {
      plugin.renderClipSpace(renderCtx, {
        enabled: true,
        targetAspectRatio: '9:16',
        visualGuide: true,
      });
    }).not.toThrow();
  });
});
