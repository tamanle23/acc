import type { ModifierParameterSchema } from '@acc/ir';

export interface PluginPresetDefinition {
  name: string;
  description: string;
  params: Record<string, any>;
}

/**
 * Curated production presets for IR modifier plugins to instantly showcase
 * visual capabilities, shader pipelines, and aesthetic variety in the Playground.
 */
export const PLAYGROUND_PRESETS: Record<string, PluginPresetDefinition[]> = {
  'overlay/canvas_particles': [
    {
      name: 'Cyber Sparks',
      description: 'High-speed luminous embers with bloom and chromatic aberration',
      params: {
        type: 'embers',
        intensity: 1.5,
        speed: 1.8,
        opacity: 0.85,
        particleCount: 1200,
        useSIMD: true,
        shaders: {
          bloom: { enabled: true, threshold: 0.65, intensity: 1.2 },
          chromaticAberration: { enabled: true, offsetPx: 2.5 },
        },
      },
    },
    {
      name: 'Cinematic Snow',
      description: 'Gentle drifting atmospheric particles with soft depth blur',
      params: {
        type: 'snow',
        intensity: 0.8,
        speed: 0.6,
        opacity: 0.7,
        particleCount: 800,
        useSIMD: false,
        shaders: {
          bloom: { enabled: true, threshold: 0.8, intensity: 0.6 },
        },
      },
    },
    {
      name: 'Digital Glitch Stream',
      description: 'Corrupted scanline artifacts and digital slicing',
      params: {
        type: 'digital_glitch',
        intensity: 1.4,
        speed: 2.0,
        opacity: 0.9,
        particleCount: 1500,
        useSIMD: true,
        shaders: {
          chromaticAberration: { enabled: true, offsetPx: 4.0 },
        },
      },
    },
    {
      name: 'Sci-Fi HUD Dust',
      description: 'Floating micro-debris illuminated by ambient cockpit glow',
      params: {
        type: 'dust',
        intensity: 0.6,
        speed: 0.4,
        opacity: 0.5,
        particleCount: 500,
        useSIMD: false,
      },
    },
  ],

  'time_space/strange_attractor': [
    {
      name: 'Lorenz Chaos Butterfly',
      description: 'Three-dimensional nonlinear chaotic flow with dual lobes',
      params: {
        density: 1.2,
        primaryColor: '#00f0ff',
        accentColor: '#ff0077',
        speedMultiplier: 1.0,
        scale: 1.0,
        boundary: 'soft',
        targetX: 0.5,
        targetY: 0.5,
      },
    },
    {
      name: 'Aizawa Spiral Core',
      description: 'Spherical attractor with orbital rotation and radiant core',
      params: {
        density: 1.5,
        primaryColor: '#7928ca',
        accentColor: '#00dfd8',
        speedMultiplier: 1.4,
        scale: 1.2,
        boundary: 'wrap',
        targetX: 0.5,
        targetY: 0.5,
      },
    },
  ],

  'time_space/relativistic_blackhole': [
    {
      name: 'Singularity & Accretion Disk',
      description: 'Gravitational light bending, photon sphere, and relativistic Doppler beaming',
      params: {
        scale: 1.1,
        speedMultiplier: 1.0,
        primaryColor: '#ff6600',
        accentColor: '#3b82f6',
        density: 1.4,
        targetX: 0.5,
        targetY: 0.5,
      },
    },
    {
      name: 'Supermassive Shadow',
      description: 'Deep event horizon with high-energy magnetic coronal arches',
      params: {
        scale: 1.5,
        speedMultiplier: 0.7,
        primaryColor: '#ef4444',
        accentColor: '#f59e0b',
        density: 1.8,
        targetX: 0.5,
        targetY: 0.5,
      },
    },
  ],

  'time_space/callout_leader': [
    {
      name: 'Tactical Target Acquired',
      description: 'HUD tracking line, coordinates, and bounding reticle',
      params: {
        text: 'TARGET ACQUIRED: UNIT-01',
        targetX: 0.35,
        targetY: 0.4,
        labelX: 0.3,
        labelY: -0.2,
        primaryColor: '#00f0ff',
        accentColor: '#ff007f',
        speedMultiplier: 1.0,
        scale: 1.0,
        strokeWidth: 2,
      },
    },
    {
      name: 'Architectural Spec',
      description: 'Subtle technical dimension line with callout readout',
      params: {
        text: 'ELEVATION: +142.5m [VERIFIED]',
        targetX: 0.6,
        targetY: 0.65,
        labelX: -0.25,
        labelY: -0.15,
        primaryColor: '#ffffff',
        accentColor: '#10b981',
        speedMultiplier: 0.8,
        scale: 0.9,
        strokeWidth: 1.5,
      },
    },
  ],

  'time_space/cyber_lower_third': [
    {
      name: 'Cyberpunk Broadcast',
      description: 'Angled glass banner, hex accents, and animated telemetry bar',
      params: {
        title: 'DR. VALERIA REYES',
        subtitle: 'CHIEF QUANTUM SYSTEMS ARCHITECT',
        primaryColor: '#00f0ff',
        accentColor: '#ff0055',
        speedMultiplier: 1.0,
        scale: 1.0,
        targetX: 0.5,
        targetY: 0.82,
      },
    },
    {
      name: 'Tech Minimalist',
      description: 'Clean typography with subtle glowing underline',
      params: {
        title: 'NEURAL RENDERING LABS',
        subtitle: 'STREAM PHASE 04 - SYNCHRONIZED',
        primaryColor: '#ffffff',
        accentColor: '#6366f1',
        speedMultiplier: 1.0,
        scale: 0.95,
        targetX: 0.5,
        targetY: 0.82,
      },
    },
  ],

  'time_space/glitch_data_stream': [
    {
      name: 'Kernel Panic Stream',
      description: 'Hexadecimal memory dump with stochastic line displacements',
      params: {
        density: 1.4,
        speedMultiplier: 2.0,
        primaryColor: '#22c55e',
        accentColor: '#ef4444',
        scale: 1.0,
        targetX: 0.5,
        targetY: 0.5,
      },
    },
    {
      name: 'Hyper-Speed Telemetry',
      description: 'Monospace flight avionics cascade',
      params: {
        density: 0.9,
        speedMultiplier: 1.5,
        primaryColor: '#06b6d4',
        accentColor: '#3b82f6',
        scale: 1.1,
        targetX: 0.5,
        targetY: 0.5,
      },
    },
  ],

  'time_space/cymatic_chladni': [
    {
      name: 'Harmonic 432 Hz Resonance',
      description: 'Acoustic sand dispersion forming standing nodal lines',
      params: {
        density: 1.2,
        speedMultiplier: 1.0,
        primaryColor: '#e0e7ff',
        accentColor: '#6366f1',
        scale: 1.0,
        targetX: 0.5,
        targetY: 0.5,
      },
    },
  ],

  'time_space/superformula': [
    {
      name: 'Star Polyhedron',
      description: 'Gielis superformula polar curve with rotational symmetry',
      params: {
        density: 1.3,
        speedMultiplier: 0.9,
        primaryColor: '#f43f5e',
        accentColor: '#fbbf24',
        scale: 1.2,
        targetX: 0.5,
        targetY: 0.5,
      },
    },
  ],

  'time_space/hud_reticle': [
    {
      name: 'Lock-On Combat Reticle',
      description: 'Concentric rotating degree rings with target tracking ticks',
      params: {
        targetX: 0.5,
        targetY: 0.5,
        scale: 1.2,
        speedMultiplier: 1.2,
        primaryColor: '#10b981',
        accentColor: '#ef4444',
        strokeWidth: 2,
      },
    },
  ],

  'vfx/color_grading': [
    {
      name: 'Cinematic Teal & Orange',
      description: 'Warm skin tone highlights paired with cool shadow splits',
      params: {
        exposure: 0.1,
        contrast: 1.25,
        temperature: -15,
        tint: 10,
        highlights: 1.15,
        shadows: 0.85,
        whites: 1.05,
        blacks: 0.9,
        saturation: 1.15,
        vibrance: 1.2,
        vignetteAmount: 0.35,
        vignetteFeather: 0.5,
      },
    },
    {
      name: 'Bleach Bypass Moody',
      description: 'High contrast silver-halide retention with desaturated tones',
      params: {
        exposure: -0.05,
        contrast: 1.45,
        temperature: 5,
        tint: -5,
        highlights: 1.3,
        shadows: 0.75,
        saturation: 0.5,
        vibrance: 0.6,
        vignetteAmount: 0.45,
      },
    },
    {
      name: 'Monochrome Noir Film',
      description: 'Deep obsidian blacks with sharp highlight roll-off',
      params: {
        contrast: 1.35,
        exposure: 0.0,
        saturation: 0.0,
        vibrance: 0.0,
        highlights: 1.2,
        shadows: 0.7,
        vignetteAmount: 0.5,
      },
    },
  ],

  'vfx/partial': [
    {
      name: 'Cinematic Center Spotlight',
      description: 'Radial brightness elevation with feathered dark vignette',
      params: {
        effectType: 'spotlight',
        centerX: 0.5,
        centerY: 0.5,
        radius: 0.45,
        feather: 0.3,
        intensity: 1.4,
      },
    },
    {
      name: 'Edge Defocus Blur',
      description: 'Keeps subject sharp while softening outer peripheral frame',
      params: {
        effectType: 'blur',
        centerX: 0.5,
        centerY: 0.5,
        radius: 0.5,
        feather: 0.25,
        intensity: 8.0,
      },
    },
  ],

  'transform': [
    {
      name: 'Ken Burns Pan & Zoom',
      description: 'Slow push-in with gentle rotational drift',
      params: {
        scale: 1.15,
        rotation: 1.5,
        x: 15,
        y: -10,
        opacity: 1.0,
      },
    },
  ],

  'transition/crossfade': [
    {
      name: 'Equal-Power Dissolve',
      description: 'Constant photometric luminance quarter-sine crossfade',
      params: {
        durationFrames: 30,
        curve: 'equal_power',
      },
    },
  ],

  'transition/wipe': [
    {
      name: 'Horizontal Angular Wipe',
      description: 'Linear sweep transition with soft feathered boundary edge',
      params: {
        transitionType: 'wipe',
        durationFrames: 30,
        direction: 'right',
        featherPx: 16,
      },
    },
  ],

  'timeline/photometric_bloom': [
    {
      name: 'Anamorphic Dream Glow',
      description: 'Thresholded diffuse luminance halo with chromatic bleed',
      params: {
        threshold: 0.7,
        intensity: 1.3,
        radius: 24,
      },
    },
  ],

  'overlay/hologram_hud': [
    {
      name: 'Tactical Grid Overlay',
      description: 'Isometric scanlines, crosshairs, and digital telemetry scrim',
      params: {
        gridDensity: 24,
        scanlineSpeed: 1.5,
        primaryColor: '#00f0ff',
        opacity: 0.65,
      },
    },
  ],
};

/**
 * Extracts default parameter values from a ModifierParameterSchema
 */
export function extractSchemaDefaults(schema?: ModifierParameterSchema): Record<string, any> {
  const defaults: Record<string, any> = {};
  if (!schema?.fields) return defaults;

  for (const [key, field] of Object.entries(schema.fields)) {
    if (field.defaultValue !== undefined) {
      defaults[key] = field.defaultValue;
    } else {
      switch (field.type) {
        case 'number':
          defaults[key] = field.min ?? 0;
          break;
        case 'boolean':
          defaults[key] = false;
          break;
        case 'string':
          defaults[key] = '';
          break;
        case 'select':
          defaults[key] = field.options?.[0]?.value ?? '';
          break;
        case 'color':
          defaults[key] = '#00f0ff';
          break;
        case 'curve':
          defaults[key] = 'easeInOutCubic';
          break;
        default:
          defaults[key] = null;
      }
    }
  }

  if (schema.resetDefaults) {
    Object.assign(defaults, schema.resetDefaults);
  }

  return defaults;
}

/**
 * Resolves presets for a given modifier plugin type.
 * Returns curated presets if registered, otherwise synthesizes a Default Preset.
 */
export function getPresetsForPlugin(
  pluginType: string,
  schema?: ModifierParameterSchema
): PluginPresetDefinition[] {
  if (PLAYGROUND_PRESETS[pluginType] && PLAYGROUND_PRESETS[pluginType].length > 0) {
    return PLAYGROUND_PRESETS[pluginType];
  }

  const defaults = extractSchemaDefaults(schema);
  return [
    {
      name: 'Default Parameters',
      description: 'Standard baseline values defined in plugin schema',
      params: defaults,
    },
  ];
}
