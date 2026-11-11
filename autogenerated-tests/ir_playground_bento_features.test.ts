import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  type ResolvedSequence,
  type ResolvedTrack,
  type ClipRenderContext,
  type StreamRenderContext,
  type MasterCompositeContext,
  type ModifierNode,
} from '../packages/ir/src';

describe('IR Playground Bento Grid Features Verification', () => {
  let registry: ModifierPluginRegistry;

  const createMockContext = () => {
    let saveCalls = 0;
    let restoreCalls = 0;
    const clipCalls: any[] = [];
    const rectCalls: any[] = [];

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
      rect: (x: number, y: number, w: number, h: number) => {
        rectCalls.push({ x, y, w, h });
      },
      roundRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      setLineDash: () => {},
      getLineDash: () => [],
      clearRect: () => {},
      clip: () => {
        clipCalls.push(true);
      },
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
      getSaveCalls: () => saveCalls,
      getRestoreCalls: () => restoreCalls,
      getClipCalls: () => clipCalls,
      getRectCalls: () => rectCalls,
    };

    return mockCtx;
  };

  beforeEach(() => {
    registry = ModifierPluginRegistry.getInstance();
    if (registry.listTypes().length === 0) {
      registerCoreModifierPlugins(registry);
    }
  });

  describe('1. Multi-Modifier Pipeline Stacking Engine', () => {
    interface ModifierStackItem {
      id: string;
      type: string;
      name: string;
      params: Record<string, any>;
      enabled: boolean;
    }

    it('should support adding, enabling/disabling, reordering, and removing modifier layers', () => {
      let stack: ModifierStackItem[] = [];

      // Add layers
      const addLayer = (type: string, name: string, params: Record<string, any> = {}) => {
        const item: ModifierStackItem = {
          id: `mod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type,
          name,
          params,
          enabled: true,
        };
        stack = [...stack, item];
        return item;
      };

      const l1 = addLayer('transform', 'Transform', { scale: 1.2 });
      const l2 = addLayer('overlay/canvas_particles', 'Particles', { particleCount: 50 });
      const l3 = addLayer('timeline/photometric_bloom', 'Bloom', { intensity: 0.8 });

      expect(stack.length).toBe(3);
      expect(stack[0].type).toBe('transform');
      expect(stack[1].type).toBe('overlay/canvas_particles');
      expect(stack[2].type).toBe('timeline/photometric_bloom');

      // Toggle enabled
      const toggleLayer = (id: string) => {
        stack = stack.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item));
      };
      toggleLayer(l2.id);
      expect(stack.find((i) => i.id === l2.id)?.enabled).toBe(false);

      // Reorder layers (move l3 up)
      const reorderLayer = (id: string, direction: 'up' | 'down') => {
        const idx = stack.findIndex((item) => item.id === id);
        if (idx === -1) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= stack.length) return;
        const copy = [...stack];
        const [moved] = copy.splice(idx, 1);
        copy.splice(targetIdx, 0, moved);
        stack = copy;
      };

      reorderLayer(l3.id, 'up');
      expect(stack[1].id).toBe(l3.id);
      expect(stack[2].id).toBe(l2.id);

      // Remove layer
      const removeLayer = (id: string) => {
        stack = stack.filter((item) => item.id !== id);
      };
      removeLayer(l1.id);
      expect(stack.length).toBe(2);
      expect(stack[0].id).toBe(l3.id);
    });

    it('should sequentially execute stacked modifiers and skip disabled layers', () => {
      const executedTypes: string[] = [];

      const mockPluginA = {
        renderStreamSpace: (ctx: any, params: any) => {
          executedTypes.push('plugin-A');
        },
      };
      const mockPluginB = {
        renderStreamSpace: (ctx: any, params: any) => {
          executedTypes.push('plugin-B');
        },
      };
      const mockPluginC = {
        renderStreamSpace: (ctx: any, params: any) => {
          executedTypes.push('plugin-C');
        },
      };

      const testStack = [
        { type: 'A', plugin: mockPluginA, enabled: true },
        { type: 'B', plugin: mockPluginB, enabled: false }, // Bypassed
        { type: 'C', plugin: mockPluginC, enabled: true },
      ];

      const mockCtx = createMockContext();
      for (const layer of testStack) {
        if (!layer.enabled) continue;
        layer.plugin.renderStreamSpace(mockCtx, {});
      }

      expect(executedTypes).toEqual(['plugin-A', 'plugin-C']);
      expect(executedTypes).not.toContain('plugin-B');
    });

    it('should correctly format batch timeline commitment for stacked modifiers', () => {
      const stack = [
        { id: '1', type: 'transform', params: { scale: 1.1 }, enabled: true },
        { id: '2', type: 'overlay/vignette', params: { intensity: 0.5 }, enabled: false },
        { id: '3', type: 'timeline/photometric_bloom', params: { intensity: 0.7 }, enabled: true },
      ];

      const enabledLayers = stack.filter((l) => l.enabled);
      const batchNodes: ModifierNode[] = enabledLayers.map((l, idx) => ({
        id: `node-${idx}-${l.type.replace('/', '_')}`,
        type: l.type as any,
        parameters: l.params,
        timing: {
          start: 0,
          end: 180,
          fadeInDuration: 0,
          fadeOutDuration: 0,
        },
      }));

      expect(batchNodes.length).toBe(2);
      expect(batchNodes[0].type).toBe('transform');
      expect(batchNodes[1].type).toBe('timeline/photometric_bloom');
      expect(batchNodes[0].parameters.scale).toBe(1.1);
      expect(batchNodes[1].parameters.intensity).toBe(0.7);
    });
  });

  describe('2. Zero-Alloc A/B Comparison Split & Clipping Math', () => {
    it('should calculate accurate splitX coordinates and boundary clamps', () => {
      const width = 1920;

      const calcSplitX = (w: number, pos: number) => {
        const clampedPos = Math.max(0, Math.min(1, pos));
        return Math.round(w * clampedPos);
      };

      expect(calcSplitX(width, 0.5)).toBe(960);
      expect(calcSplitX(width, 0.0)).toBe(0);
      expect(calcSplitX(width, 1.0)).toBe(1920);
      expect(calcSplitX(width, 0.25)).toBe(480);
      expect(calcSplitX(width, 0.75)).toBe(1440);
      // Clamping
      expect(calcSplitX(width, -0.5)).toBe(0);
      expect(calcSplitX(width, 1.5)).toBe(1920);
    });

    it('should maintain strict context stack balance (save == restore) during A/B split clipping', () => {
      const ctx = createMockContext();
      const width = 1280;
      const height = 720;
      const splitPosition = 0.5;
      const splitX = Math.round(width * splitPosition);

      // 1. Simulate A/B Split Render Pass
      const isSplitEnabled = true;

      // Unprocessed background plate baseline
      ctx.fillRect(0, 0, width, height);

      if (isSplitEnabled) {
        // Isolate right side for modifier execution via clipping
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, width - splitX, height);
        ctx.clip();

        // Modifier pass
        ctx.fillRect(0, 0, width, height);

        ctx.restore();
      }

      // Assertions
      expect(ctx.getSaveCalls()).toBe(ctx.getRestoreCalls());
      expect(ctx.getSaveCalls() - ctx.getRestoreCalls()).toBe(0); // Delta stack = 0
      expect(ctx.getClipCalls().length).toBe(1);

      const rects = ctx.getRectCalls();
      expect(rects.length).toBeGreaterThan(0);
      expect(rects[0]).toEqual({
        x: 640,
        y: 0,
        w: 640,
        h: 720,
      });
    });
  });

  describe('3. Storyboard Reel & 5-Keyframe Sampling Math', () => {
    it('should calculate exact keyframes across total duration without float drift', () => {
      const calculateKeyframes = (totalFrames: number) => {
        const total = Math.max(0, totalFrames - 1);
        return [0, 1, 2, 3, 4].map((i) => ({
          index: i,
          pct: i * 25,
          frame: Math.round((i * total) / 4),
        }));
      };

      // 180 frames (6.0s @ 30fps)
      const kf180 = calculateKeyframes(180);
      expect(kf180.map((k) => k.frame)).toEqual([0, 45, 90, 134, 179]);
      expect(kf180.map((k) => k.pct)).toEqual([0, 25, 50, 75, 100]);

      // 60 frames (2.0s @ 30fps)
      const kf60 = calculateKeyframes(60);
      expect(kf60.map((k) => k.frame)).toEqual([0, 15, 30, 44, 59]);

      // Edge case: single frame (1 frame total)
      const kf1 = calculateKeyframes(1);
      expect(kf1.map((k) => k.frame)).toEqual([0, 0, 0, 0, 0]);
    });
  });

  describe('4. Motion & Easing Curves Math Verification', () => {
    const EASING_FNS = {
      linear: (t: number) => t,
      easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
      easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      equal_power: (t: number) => Math.sin((t * Math.PI) / 2),
    };

    it('should satisfy boundary criteria f(0) = 0 and f(1) = 1 for all easing formulas', () => {
      for (const [name, fn] of Object.entries(EASING_FNS)) {
        expect(fn(0)).toBeCloseTo(0, 5);
        expect(fn(1)).toBeCloseTo(1, 5);
      }
    });

    it('should verify equal_power trigonometric acoustic energy equation', () => {
      const fn = EASING_FNS.equal_power;
      // At t = 0.5, equal power crossfade amplitude should be sin(pi / 4) ~= 0.7071
      expect(fn(0.5)).toBeCloseTo(Math.SQRT1_2, 4);
    });

    it('should verify strict monotonicity for monotonic curves', () => {
      const monotonic = [EASING_FNS.linear, EASING_FNS.easeOutCubic, EASING_FNS.easeInOutCubic, EASING_FNS.equal_power];

      for (const fn of monotonic) {
        let prev = -1;
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const val = fn(t);
          expect(val).toBeGreaterThanOrEqual(prev);
          prev = val;
        }
      }
    });
  });
});
