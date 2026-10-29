import { describe, it, expect } from 'bun:test';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  CalloutLeaderPlugin,
  CalloutMultiTargetPlugin,
  HUDReticlePlugin,
  KineticTitlePlugin,
  CyberLowerThirdPlugin,
  CountdownPlugin,
  NetworkPlexusPlugin,
  AudioWaveformPlugin,
  AudioSpectrumPlugin,
  SuperformulaPlugin,
  EnergyShieldPlugin,
  GlitchDataStreamPlugin,
  VideoIRSchemaValidator,
  type VideoIRDocument,
} from '@acc/ir';
import { broadcastNewsDemoIR } from '../apps/studio/src/lib/ir/broadcastNewsDemoIR';
import { cyberAudioVisualizerDemoIR } from '../apps/studio/src/lib/ir/cyberAudioVisualizerDemoIR';

describe('Discrete time_space/* Motion Graphic Plugins Suite', () => {
  const discreteTypes = [
    'time_space/callout_leader',
    'time_space/callout_multitarget',
    'time_space/hud_reticle',
    'time_space/kinetic_title',
    'time_space/cyber_lower_third',
    'time_space/countdown',
    'time_space/network_plexus',
    'time_space/audio_waveform',
    'time_space/audio_spectrum',
    'time_space/superformula',
    'time_space/energy_shield',
    'time_space/glitch_data_stream',
  ] as const;

  const createMockContext = () => {
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
      clearRect: () => {},
      rect: () => {},
      closePath: () => {},
      strokeRect: () => {},
      fillRect: () => {},
      setLineDash: () => {},
    };

    return mockCtx;
  };

  it('registers all 12 discrete time_space/* plugins in ModifierPluginRegistry', () => {
    const registry = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(registry);

    for (const pluginType of discreteTypes) {
      expect(registry.has(pluginType)).toBe(true);
      const plugin = registry.get(pluginType);
      expect(plugin).toBeDefined();
      expect(plugin?.type).toBe(pluginType);
      expect(plugin?.schema).toBeDefined();
    }
  });

  it('enforces schema isolation between textual callouts and procedural visualizers', () => {
    const textPluginTypes = [
      'time_space/callout_leader',
      'time_space/callout_multitarget',
      'time_space/hud_reticle',
      'time_space/kinetic_title',
      'time_space/cyber_lower_third',
    ];

    const visualizerPluginTypes = [
      'time_space/network_plexus',
      'time_space/audio_waveform',
      'time_space/audio_spectrum',
      'time_space/superformula',
      'time_space/energy_shield',
      'time_space/glitch_data_stream',
      'time_space/countdown',
    ];

    const registry = ModifierPluginRegistry.createIsolated();
    registerCoreModifierPlugins(registry);

    for (const type of textPluginTypes) {
      const schema = registry.getSchema(type);
      expect(schema?.fields.text).toBeDefined();
    }

    for (const type of visualizerPluginTypes) {
      const schema = registry.getSchema(type);
      expect(schema?.fields.text).toBeUndefined();
    }
  });

  it('renders all 12 discrete plugins across frames 0, 15, and 30 without throwing', () => {
    const plugins = [
      new CalloutLeaderPlugin(),
      new CalloutMultiTargetPlugin(),
      new HUDReticlePlugin(),
      new KineticTitlePlugin(),
      new CyberLowerThirdPlugin(),
      new CountdownPlugin(),
      new NetworkPlexusPlugin(),
      new AudioWaveformPlugin(),
      new AudioSpectrumPlugin(),
      new SuperformulaPlugin(),
      new EnergyShieldPlugin(),
      new GlitchDataStreamPlugin(),
    ];

    const mockCtx = createMockContext();
    const testFrames = [0, 15, 30];

    for (const plugin of plugins) {
      const sequenceHolder: any = { id: `seq_${plugin.templateId}`, fps: 30 };

      for (const frame of testFrames) {
        const clipCtx: any = {
          ctx: mockCtx,
          frame,
          localFrame: frame,
          width: 1920,
          height: 1080,
          sequence: sequenceHolder,
        };

        expect(() => {
          plugin.renderClipSpace(clipCtx, {
            seed: 42,
            theme: 'cyberpunk',
            speedMultiplier: 1.0,
            scale: 1.0,
          } as any);
        }).not.toThrow();

        const masterCtx: any = {
          ctx: mockCtx,
          frame,
          width: 1920,
          height: 1080,
        };

        expect(() => {
          plugin.renderMasterComposite(masterCtx, {
            seed: 42,
            theme: 'solar_flare',
            speedMultiplier: 1.2,
            scale: 1.0,
          } as any);
        }).not.toThrow();
      }
    }
  });

  it('invalidates and regenerates state-machine cache upon parameter mutation', () => {
    const plugin = new CalloutLeaderPlugin();
    const holder: any = { id: 'seq_cache_test', fps: 30 };
    const mockCtx = createMockContext();

    const clipCtx: any = {
      ctx: mockCtx,
      frame: 10,
      localFrame: 10,
      width: 1920,
      height: 1080,
      sequence: holder,
    };

    // First render pass
    plugin.renderClipSpace(clipCtx, {
      text: 'ALPHA',
      theme: 'cyberpunk',
      speedMultiplier: 1.0,
      scale: 1.0,
    } as any);

    const initialMachine = holder._timeSpaceMachine;
    expect(initialMachine).toBeDefined();

    // Re-render with same parameters -> cache hit
    plugin.renderClipSpace(clipCtx, {
      text: 'ALPHA',
      theme: 'cyberpunk',
      speedMultiplier: 1.0,
      scale: 1.0,
    } as any);

    expect(holder._timeSpaceMachine).toBe(initialMachine);

    // Re-render with changed parameters -> cache invalidated & rebuilt
    plugin.renderClipSpace(clipCtx, {
      text: 'BETA',
      theme: 'emerald_matrix',
      speedMultiplier: 2.0,
      scale: 1.5,
    } as any);

    expect(holder._timeSpaceMachine).not.toBe(initialMachine);
  });

  it('validates VideoIRDocument with discrete time_space/* modifier nodes', () => {
    const doc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'discrete-timespace-doc',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track-vfx',
          type: 'video',
          sequences: [
            {
              id: 'seq-1',
              type: 'overlay',
              time: { start: 0, duration: 90 },
              modifiers: [
                {
                  type: 'time_space/callout_leader',
                  target: 'overlay',
                  params: {
                    text: 'TARGET ACQUIRED',
                    targetX: 0.2,
                    targetY: -0.1,
                    theme: 'cyberpunk',
                    speedMultiplier: 1.0,
                    boundary: 'loop',
                  },
                },
                {
                  type: 'time_space/audio_waveform',
                  target: 'overlay',
                  params: {
                    density: 48,
                    theme: 'synthwave_neon',
                    boundary: 'loop',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const val = VideoIRSchemaValidator.validate(doc);
    expect(val.valid).toBe(true);
    expect(val.errors).toEqual([]);
  });

  it('validates broadcastNewsDemoIR without schema errors', () => {
    const val = VideoIRSchemaValidator.validate(broadcastNewsDemoIR);
    expect(val.valid).toBe(true);
    expect(val.errors).toEqual([]);
  });

  it('validates cyberAudioVisualizerDemoIR without schema errors', () => {
    const val = VideoIRSchemaValidator.validate(cyberAudioVisualizerDemoIR);
    expect(val.valid).toBe(true);
    expect(val.errors).toEqual([]);
  });
});
