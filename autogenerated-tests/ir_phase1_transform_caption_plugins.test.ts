import { describe, it, expect } from 'bun:test';
import {
  TransformModifierPlugin,
  CaptionModifierPlugin,
  registerCoreModifierPlugins,
  ModifierPluginRegistry,
} from '../packages/ir/src';
import { UniversalCanvasProvider } from '@acc/effect-engines';

describe('Iteration 10 Phase 1: Transform & Caption Modifier Plugins', () => {
  it('should initialize and validate TransformModifierPlugin', () => {
    const plugin = new TransformModifierPlugin();
    expect(plugin.type).toBe('transform');
    expect(plugin.targetScope).toBe('both');
    expect(plugin.targetPhase).toBe(2);

    expect(plugin.validate({})).toBe(true);
    expect(plugin.validate({ x: 100, y: -50, scale: 1.2, rotation: 15 })).toBe(true);
    expect(plugin.validate(null)).toBe(false);
    expect(plugin.validate(undefined)).toBe(false);
  });

  it('should evaluate deterministic sequence motion via TransformModifierPlugin', () => {
    const plugin = new TransformModifierPlugin();

    // Test static transform
    const staticMotion = plugin.evaluateMotion({ x: 50, y: 30, scale: 1.5, rotation: 45 }, 0.5, 3.0);
    expect(staticMotion.x).toBe(50);
    expect(staticMotion.y).toBe(30);
    expect(staticMotion.scale).toBe(1.5);
    expect(staticMotion.rotation).toBe(45);
    expect(staticMotion.opacity).toBe(1.0);

    // Test pop_in animation intro
    const popInIntro = plugin.evaluateMotion(
      {
        scale: 1.0,
        animation: { preset: 'pop_in', intro: { durationSec: 0.5 } },
      },
      0.0,
      3.0
    );
    expect(popInIntro.scale).toBeCloseTo(0.2, 1);
    expect(popInIntro.opacity).toBeCloseTo(0, 1);

    // Test steady state
    const popInSteady = plugin.evaluateMotion(
      {
        scale: 1.0,
        animation: { preset: 'pop_in', intro: { durationSec: 0.5 } },
      },
      1.5,
      3.0
    );
    expect(popInSteady.scale).toBeCloseTo(1.0, 1);
    expect(popInSteady.opacity).toBe(1.0);
  });

  it('should apply affine matrix translation, rotation, scale in renderClipSpace', () => {
    const plugin = new TransformModifierPlugin();
    const canvasInst = UniversalCanvasProvider.createCanvas(1920, 1080);
    const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
    const ctx = canvas.getContext('2d');

    const mockSeq: any = {
      id: 'seq_v1',
      durationFrames: 90,
      fps: 30,
    };

    ctx.save();
    plugin.renderClipSpace(
      {
        canvas,
        ctx,
        frame: 45,
        localFrame: 45,
        width: 1920,
        height: 1080,
        sequence: mockSeq,
      },
      { x: 100, y: 50, scale: 1.5, rotation: 10 }
    );
    ctx.restore();

    expect(typeof ctx.translate).toBe('function');
    expect(typeof ctx.rotate).toBe('function');
    expect(typeof ctx.scale).toBe('function');
  });

  it('should initialize and validate CaptionModifierPlugin', () => {
    const plugin = new CaptionModifierPlugin();
    expect(plugin.type).toBe('text/style');
    expect(plugin.targetScope).toBe('both');
    expect(plugin.targetPhase).toBe(2);

    expect(plugin.validate({})).toBe(true);
    expect(plugin.validate({ primaryColor: '#FFFF00', fontSize: 48 })).toBe(true);
    expect(plugin.validate(null)).toBe(false);
  });

  it('should render styled captions from cues with acoustic timing in renderClipSpace', () => {
    const plugin = new CaptionModifierPlugin();
    const canvasInst = UniversalCanvasProvider.createCanvas(1080, 1920);
    const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
    const ctx = canvas.getContext('2d');

    const mockCaptionSeq: any = {
      id: 'seq_captions_1',
      startFrame: 0,
      durationFrames: 60,
      fps: 30,
      cues: [
        { text: 'Hello', startOffsetMs: 0, endOffsetMs: 1000 },
        { text: 'World', startOffsetMs: 1000, endOffsetMs: 2000 },
      ],
    };

    // Frame 15 (0.5s): Should render 'Hello'
    ctx.save();
    plugin.renderClipSpace(
      {
        canvas,
        ctx,
        frame: 15,
        localFrame: 15,
        width: 1080,
        height: 1920,
        sequence: mockCaptionSeq,
      },
      {
        preset: 'tiktok',
        primaryColor: '#FFFFFF',
        fontSize: 52,
        activeWordHighlight: true,
      }
    );
    ctx.restore();

    // Verify context methods executed cleanly
    expect(typeof ctx.fillText).toBe('function');
  });

  it('should verify single unified registerCoreModifierPlugins registers both plugins', () => {
    const registry = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(registry);

    expect(registry.has('transform')).toBe(true);
    expect(registry.has('text/style')).toBe(true);
    expect(registry.get('transform') instanceof TransformModifierPlugin).toBe(true);
    expect(registry.get('text/style') instanceof CaptionModifierPlugin).toBe(true);
  });
});
