import { describe, it, expect } from 'bun:test';
import {
  VideoIRSchemaValidator,
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  UniversalTransitionPlugin,
  calculateTransitionProgress,
  type TransitionModifierParams,
  type VideoIRDocument,
} from '@acc/ir';

describe('Studio Pillar 1: Dedicated Transition System Suite', () => {
  it('1. Schema Validation: Validates all extended transition modifier types and parameters', () => {
    const validDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'test_transitions_doc',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track-v1',
          type: 'video',
          sequences: [
            {
              id: 'seq-a',
              type: 'video',
              time: { start: 0, duration: 60 },
            },
            {
              id: 'seq-b',
              type: 'video',
              time: { start: 45, duration: 60 },
              modifiers: [
                {
                  type: 'transition/wipe',
                  target: 'video',
                  params: {
                    transitionType: 'wipe',
                    durationFrames: 15,
                    direction: 'left',
                    alignment: 'center_on_cut',
                    ease: 'ease_in_out',
                    outgoingSeqId: 'seq-a',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const res = VideoIRSchemaValidator.validate(validDoc);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('2. Schema Validation: Rejects invalid transition parameters', () => {
    const invalidDoc: any = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'test_invalid_transition',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track-v1',
          type: 'video',
          sequences: [
            {
              id: 'seq-1',
              type: 'video',
              time: { start: 0, duration: 60 },
              modifiers: [
                {
                  type: 'transition/crossfade',
                  target: 'video',
                  params: {
                    durationFrames: -5, // Invalid negative duration
                    alignment: 'invalid_align', // Invalid alignment
                    direction: 'sideways', // Invalid direction
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const res = VideoIRSchemaValidator.validate(invalidDoc);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('transition duration must be a non-negative number'))).toBe(true);
    expect(res.errors.some((e) => e.includes('alignment must be'))).toBe(true);
    expect(res.errors.some((e) => e.includes('direction must be'))).toBe(true);
  });

  it('3. Plugin Registration: Ensures all 9 transition modifier types are registered in registry', () => {
    const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
    const expectedTypes = [
      'transition/crossfade',
      'transition/wipe',
      'transition/push',
      'transition/zoom',
      'transition/dip',
      'transition/glitch',
      'transition/light_leak',
      'transition/radial_wipe',
      'transition/iris',
    ];

    for (const t of expectedTypes) {
      const plugin = registry.get(t);
      expect(plugin).toBeDefined();
      expect(plugin?.targetPhase).toBe(2);
      expect(plugin?.targetScope).toBe('sequence');
    }
  });

  it('4. Deterministic Easing Math: Correctly calculates transition progress curve values', () => {
    expect(calculateTransitionProgress(0, 'linear')).toBe(0);
    expect(calculateTransitionProgress(1, 'linear')).toBe(1);
    expect(calculateTransitionProgress(0.5, 'linear')).toBe(0.5);

    // Ease In (quadratic)
    expect(calculateTransitionProgress(0.5, 'ease_in')).toBeCloseTo(0.25, 2);

    // Ease Out
    expect(calculateTransitionProgress(0.5, 'ease_out')).toBeCloseTo(0.75, 2);

    // Clamping bounds
    expect(calculateTransitionProgress(-0.5, 'linear')).toBe(0);
    expect(calculateTransitionProgress(1.5, 'linear')).toBe(1);
  });

  it('5. Render Clip Space: UniversalTransitionPlugin executes multi-mode canvas transformations', () => {
    const plugin = new UniversalTransitionPlugin('transition/wipe');
    let alphaSet = 1.0;
    let clipCalled = false;
    let translateCalled = false;
    let rectArgs: any[] = [];

    const mockCtx: any = {
      globalAlpha: 1.0,
      beginPath: () => {},
      rect: (...args: any[]) => {
        rectArgs = args;
      },
      clip: () => {
        clipCalled = true;
      },
      translate: () => {
        translateCalled = true;
      },
      scale: () => {},
      arc: () => {},
      moveTo: () => {},
      closePath: () => {},
      fillRect: () => {},
      save: () => {},
      restore: () => {},
    };

    // Test Wipe (left at frame 5 of 10) -> progress = 0.5
    plugin.renderClipSpace(
      {
        canvas: {},
        ctx: mockCtx,
        frame: 105,
        localFrame: 5,
        width: 1000,
        height: 500,
        sequence: { id: 'seq-b' } as any,
      },
      {
        transitionType: 'wipe',
        durationFrames: 10,
        direction: 'left',
      }
    );

    expect(clipCalled).toBe(true);
    expect(rectArgs[2]).toBe(500); // 1000 * 0.5 = 500

    // Test Push
    const pushPlugin = new UniversalTransitionPlugin('transition/push');
    let pushedX = 0;
    mockCtx.translate = (x: number, y: number) => {
      pushedX = x;
    };

    pushPlugin.renderClipSpace(
      {
        canvas: {},
        ctx: mockCtx,
        frame: 102,
        localFrame: 2,
        width: 1000,
        height: 500,
        sequence: { id: 'seq-b' } as any,
      },
      {
        transitionType: 'push',
        durationFrames: 10,
        direction: 'left',
      }
    );

    // At progress = 0.2, translateX = 1000 * (1 - 0.2) = 800
    expect(pushedX).toBeCloseTo(800, 1);
  });
});
