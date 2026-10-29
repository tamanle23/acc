import { describe, it, expect } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  CymaticChladniPlugin,
  StrangeAttractorPlugin,
  RelativisticBlackHolePlugin,
  TopographicContourPlugin,
  HyperbolicPoincarePlugin,
  KineticHarmonographPlugin,
  VideoIRSchemaValidator,
} from '@acc/ir';
import { TimeSpaceRegistry } from '@acc/core-isomorphic';
import { quantumPhysicsDemoIR } from '../apps/studio/src/lib/ir/quantumPhysicsDemoIR';
import { astroTelemetryDemoIR } from '../apps/studio/src/lib/ir/astroTelemetryDemoIR';

describe('Advanced Spatio-Temporal Generators & 6 New Plugins Suite', () => {
  const newPluginTypes = [
    'time_space/cymatic_chladni',
    'time_space/strange_attractor',
    'time_space/relativistic_blackhole',
    'time_space/topographic_contour',
    'time_space/hyperbolic_poincare',
    'time_space/kinetic_harmonograph',
  ] as const;

  const createMockContext = () => ({
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
    clearRect: () => {},
    rect: () => {},
    closePath: () => {},
    strokeRect: () => {},
    fillRect: () => {},
    setLineDash: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
  });

  it('registers all 6 new plugins in ModifierPluginRegistry', () => {
    const registry = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(registry);

    for (const type of newPluginTypes) {
      expect(registry.has(type)).toBe(true);
      const plugin = registry.get(type);
      expect(plugin).toBeDefined();
      expect(plugin?.type).toBe(type);
      expect(plugin?.schema).toBeDefined();
      expect(plugin?.schema.fields.boundary).toBeDefined();
      expect(plugin?.schema.fields.theme).toBeDefined();
    }
  });

  it('verifies all 6 mathematical generator factories in TimeSpaceRegistry', () => {
    const factories = [
      'cymatic_chladni',
      'strange_attractor',
      'relativistic_blackhole',
      'topographic_contour',
      'hyperbolic_poincare',
      'kinetic_harmonograph',
    ];

    for (const name of factories) {
      expect(TimeSpaceRegistry.has(name)).toBe(true);
      const machine = TimeSpaceRegistry.instantiate(name, { boundary: 'loop' });
      expect(machine).toBeDefined();

      const snapshot = machine.seek(1.5, { width: 1920, height: 1080 });
      expect(snapshot).toBeDefined();
      expect(snapshot.timeSec).toBe(1.5);
      expect(snapshot.geometry).toBeDefined();
    }
  });

  it('renders all 6 new plugins across frames 0, 15, and 30 without throwing', () => {
    const plugins = [
      new CymaticChladniPlugin(),
      new StrangeAttractorPlugin(),
      new RelativisticBlackHolePlugin(),
      new TopographicContourPlugin(),
      new HyperbolicPoincarePlugin(),
      new KineticHarmonographPlugin(),
    ];

    const mockCtx = createMockContext();
    const width = 1920;
    const height = 1080;
    const fps = 30;

    for (const plugin of plugins) {
      for (const frame of [0, 15, 30]) {
        expect(() => {
          plugin.renderClipSpace(
            mockCtx as unknown as CanvasRenderingContext2D,
            {
              targetX: 0.0,
              targetY: 0.0,
              theme: 'cyberpunk',
              speedMultiplier: 1.0,
              scale: 1.0,
              strokeWidth: 1.5,
              boundary: 'loop',
            },
            {
              clipFrame: frame,
              clipDuration: 90,
              sequence: {
                id: `seq-${plugin.type}`,
                name: 'Test Sequence',
                type: 'overlay',
                time: { start: 0, duration: 90 },
                modifiers: [],
              },
              canvasWidth: width,
              canvasHeight: height,
              fps,
            }
          );
        }).not.toThrow();
      }
    }
  });

  it('re-creates time-space machine on param mutation', () => {
    const plugin = new CymaticChladniPlugin();
    const mockCtx = createMockContext();
    const renderCtx = {
      clipFrame: 10,
      clipDuration: 60,
      sequence: {
        id: 'test-seq',
        name: 'Test Sequence',
        type: 'overlay' as const,
        time: { start: 0, duration: 60 },
        modifiers: [],
      },
      canvasWidth: 1920,
      canvasHeight: 1080,
      fps: 30,
    };

    plugin.renderClipSpace(mockCtx as unknown as CanvasRenderingContext2D, { theme: 'solar_flare' }, renderCtx);
    const m1 = plugin.getActiveMachine();
    expect(m1).toBeDefined();

    plugin.renderClipSpace(mockCtx as unknown as CanvasRenderingContext2D, { theme: 'cyberpunk' }, renderCtx);
    const m2 = plugin.getActiveMachine();
    expect(m2).toBeDefined();
    expect(m2).not.toBe(m1);
  });

  it('validates quantumPhysicsDemoIR against VideoIRSchemaValidator with zero errors', () => {
    const result = VideoIRSchemaValidator.validate(quantumPhysicsDemoIR);
    if (!result.valid) {
      console.error('Validation errors for quantumPhysicsDemoIR:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates astroTelemetryDemoIR against VideoIRSchemaValidator with zero errors', () => {
    const result = VideoIRSchemaValidator.validate(astroTelemetryDemoIR);
    if (!result.valid) {
      console.error('Validation errors for astroTelemetryDemoIR:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
