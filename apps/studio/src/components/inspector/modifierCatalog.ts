import {
  Move,
  Layers,
  Sparkles,
  Camera,
  Crop,
  Palette,
  Type,
  Volume2,
  Music,
  Film,
  Clock,
  Monitor,
} from 'lucide-react';
import { ModifierPluginRegistry } from '@acc/ir';
export * from './ParameterControls';

export const PARTICLE_PRESET_DEFAULTS: Record<
  string,
  {
    intensity: number;
    speed: number;
    opacity: number;
    particleCount: number;
    bloomEnabled: boolean;
    bloomThreshold: number;
    bloomIntensity: number;
    chromaticAberrationEnabled: boolean;
    chromaticAberrationOffset: number;
  }
> = {
  cyber_sparks: {
    intensity: 1.2,
    speed: 1.8,
    opacity: 0.9,
    particleCount: 1500,
    bloomEnabled: true,
    bloomThreshold: 0.6,
    bloomIntensity: 1.5,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 2.5,
  },
  embers: {
    intensity: 1.0,
    speed: 0.8,
    opacity: 0.85,
    particleCount: 800,
    bloomEnabled: true,
    bloomThreshold: 0.7,
    bloomIntensity: 1.2,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 1.0,
  },
  dust: {
    intensity: 0.6,
    speed: 0.4,
    opacity: 0.5,
    particleCount: 400,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.5,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 0.0,
  },
  rain: {
    intensity: 1.5,
    speed: 2.2,
    opacity: 0.7,
    particleCount: 1200,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.5,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 1.2,
  },
  snow: {
    intensity: 0.8,
    speed: 0.5,
    opacity: 0.75,
    particleCount: 600,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.5,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 0.0,
  },
  bokeh: {
    intensity: 0.9,
    speed: 0.3,
    opacity: 0.6,
    particleCount: 300,
    bloomEnabled: true,
    bloomThreshold: 0.5,
    bloomIntensity: 1.8,
    chromaticAberrationEnabled: false,
    chromaticAberrationOffset: 0.5,
  },
  matrix_rain: {
    intensity: 1.3,
    speed: 1.6,
    opacity: 0.85,
    particleCount: 1800,
    bloomEnabled: true,
    bloomThreshold: 0.65,
    bloomIntensity: 1.4,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 2.0,
  },
  digital_glitch: {
    intensity: 1.4,
    speed: 2.0,
    opacity: 0.9,
    particleCount: 1000,
    bloomEnabled: true,
    bloomThreshold: 0.5,
    bloomIntensity: 2.0,
    chromaticAberrationEnabled: true,
    chromaticAberrationOffset: 4.0,
  },
};

export type ModifierCategory =
  | 'motion'
  | 'vfx'
  | 'transitions'
  | 'audio'
  | 'text'
  | 'custom';

export type ModifierIconComponent = React.ComponentType<{ className?: string }>;

export interface AvailableModifierDef {
  type: string;
  name: string;
  category: ModifierCategory;
  icon: ModifierIconComponent;
  supportedTrackTypes: Array<'video' | 'audio' | 'timed_text' | 'data'>;
  defaultParams: Record<string, unknown>;
}

export const MODIFIER_PRESENTATION_CATALOG: Record<
  string,
  {
    name: string;
    category: ModifierCategory;
    icon: ModifierIconComponent;
    supportedTrackTypes: Array<'video' | 'audio' | 'timed_text' | 'data'>;
    defaultParams: Record<string, unknown>;
  }
> = {
  transform: {
    name: 'In-Canvas Transform',
    category: 'motion',
    icon: Move,
    supportedTrackTypes: ['video', 'timed_text'],
    defaultParams: {
      x: 0,
      y: 0,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      ease: 'power2.out',
    },
  },
  'motion/gsap': {
    name: 'GSAP Motions & Easings',
    category: 'motion',
    icon: Sparkles,
    supportedTrackTypes: ['video', 'timed_text', 'audio'],
    defaultParams: {
      enabled: true,
      preset: 'pop_in',
      ease: 'power2.out',
      introDurationSec: 0.4,
      outroDurationSec: 0.3,
    },
  },
  'overlay/canvas_particles': {
    name: 'Particle VFX & Shaders',
    category: 'vfx',
    icon: Layers,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      type: 'cyber_sparks',
      preset: 'cyber_sparks',
      intensity: 1.0,
      speed: 1.0,
      opacity: 0.8,
      particleCount: 1500,
      gravity: -1.2,
      drag: 0.15,
      turbulence: 1.0,
      bloomThreshold: 0.7,
      chromaticAberration: 2.0,
      shaders: {
        bloom: { enabled: true, threshold: 0.7, intensity: 1.0 },
        chromaticAberration: { enabled: true, offsetPx: 2.0 },
      },
    },
  },
  'overlay/hologram_hud': {
    name: 'Hologram HUD',
    category: 'vfx',
    icon: Monitor,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      ringRadiusNorm: 0.35,
      scanlineDensity: 40,
      color: '#00ffff',
      rotationSpeed: 0.5,
    },
  },
  'vfx/depth_relighting': {
    name: '3D Relighting',
    category: 'vfx',
    icon: Sparkles,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      lightColor: '#00d4ff',
      lightX: 2.0,
      lightY: 2.0,
      lightZ: 5.0,
      diffuse: 1.0,
      specular: 1.2,
      shininess: 32,
      rimIntensity: 0.5,
    },
  },
  'vfx/depth3d': {
    name: 'Depth 3D & Parallax',
    category: 'vfx',
    icon: Sparkles,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      mode: 'parallax_25d',
      popOutIntensity: 1.25,
      autoSegment: true,
      autoDepth: true,
      depthStrategy: 'heuristic',
      segmentationStrategy: 'grabcut-fallback',
    },
  },
  'vfx/auto_reframe': {
    name: 'Smart Auto-Reframe',
    category: 'vfx',
    icon: Crop,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      targetAspectRatio: '9:16',
      smoothingFactor: 0.85,
      motionDamping: true,
      visualGuide: false,
      strategyId: 'grabcut-fallback',
    },
  },
  'vfx/camera_3d': {
    name: '3D Camera & Lens',
    category: 'vfx',
    icon: Camera,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      eyeX: 0.0,
      eyeY: 0.0,
      eyeZ: 10.0,
      targetX: 0.0,
      targetY: 0.0,
      targetZ: 0.0,
      fov: 45,
      roll: 0,
      focalDistance: 2.5,
      focalRange: 1.0,
      bokehRadius: 6.0,
    },
  },
  'camera/3d': {
    name: '3D Camera & Lens',
    category: 'vfx',
    icon: Camera,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      eyeX: 0.0,
      eyeY: 0.0,
      eyeZ: 10.0,
      targetX: 0.0,
      targetY: 0.0,
      targetZ: 0.0,
      fov: 45,
      roll: 0,
      focalDistance: 2.5,
      focalRange: 1.0,
      bokehRadius: 6.0,
    },
  },
  'vfx/color_grading': {
    name: 'Color Grading',
    category: 'vfx',
    icon: Palette,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      contrast: 1.0,
      saturation: 1.0,
      exposure: 0.0,
      vignette: 0.35,
    },
  },
  'text/style': {
    name: 'Typography & Karaoke Glow',
    category: 'text',
    icon: Type,
    supportedTrackTypes: ['timed_text'],
    defaultParams: {
      enabled: true,
      fontFamily: 'Inter',
      fontSize: 28,
      fontWeight: 600,
      letterSpacing: 0,
      fillColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 2,
      shadowBlur: 6,
      glowColor: '#00d4ff',
      activeWordHighlight: {
        enabled: true,
        fillColor: '#facc15',
        scale: 1.15,
        glowColor: '#00d4ff',
        glowBlur: 12,
        animationPreset: 'pop',
      },
    },
  },
  'sfx/dynamic_ducking': {
    name: 'Audio Ducking & Pan',
    category: 'audio',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      duckVolume: 0.25,
      attackMs: 150,
      releaseMs: 300,
      stereoPan: 0.0,
      targetBus: 'track-a2',
    },
  },
  'audio/volume': {
    name: 'Volume & Gain DSP',
    category: 'audio',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      volume: 1.0,
      gainDb: 0.0,
    },
  },
  'audio/pan': {
    name: 'Stereo Panner DSP',
    category: 'audio',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      pan: 0.0,
    },
  },
  'audio/filter': {
    name: 'Equalizer / Filter DSP',
    category: 'audio',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      filterType: 'lowpass',
      cutoffHz: 12000,
      resonance: 1.0,
    },
  },
  'audio/pitch': {
    name: 'Pitch Shift DSP',
    category: 'audio',
    icon: Volume2,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      pitchSemitones: 0,
      playbackRate: 1.0,
    },
  },
  'sfx/procedural': {
    name: 'Procedural Audio Synthesizer',
    category: 'audio',
    icon: Music,
    supportedTrackTypes: ['audio'],
    defaultParams: {
      enabled: true,
      synthType: 'impact',
      durationSec: 1.5,
      duckingFactor: 0.75,
      label: 'IMPACT',
    },
  },
  'editorial/split_edit': {
    name: 'L/J Cut Split Edit',
    category: 'transitions',
    icon: Film,
    supportedTrackTypes: ['video', 'audio'],
    defaultParams: {
      enabled: true,
      audioLeadFrames: 15,
      videoLagFrames: 0,
    },
  },
  'editorial/transition_crossfade': {
    name: 'Transition Crossfade',
    category: 'transitions',
    icon: Film,
    supportedTrackTypes: ['video', 'audio'],
    defaultParams: {
      enabled: true,
      durationFrames: 15,
      transitionType: 'crossfade',
      alignment: 'center_on_cut',
      ease: 'linear',
    },
  },
  'transition/crossfade': {
    name: 'Transition Crossfade (Dissolve)',
    category: 'transitions',
    icon: Film,
    supportedTrackTypes: ['video', 'audio'],
    defaultParams: {
      enabled: true,
      durationFrames: 15,
      transitionType: 'crossfade',
      alignment: 'center_on_cut',
      ease: 'linear',
    },
  },
  'transition/wipe': {
    name: 'Transition Wipe',
    category: 'transitions',
    icon: Film,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      durationFrames: 15,
      transitionType: 'wipe',
      direction: 'left',
      alignment: 'center_on_cut',
      ease: 'linear',
    },
  },
  'transition/push': {
    name: 'Transition Push (Slide)',
    category: 'transitions',
    icon: Film,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      durationFrames: 15,
      transitionType: 'push',
      direction: 'left',
      alignment: 'center_on_cut',
      ease: 'linear',
    },
  },
  'transition/zoom': {
    name: 'Transition Whip Zoom',
    category: 'transitions',
    icon: Film,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      durationFrames: 15,
      transitionType: 'zoom',
      alignment: 'center_on_cut',
      ease: 'ease_in_out',
    },
  },
  'transition/dip': {
    name: 'Transition Dip to Color',
    category: 'transitions',
    icon: Film,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      durationFrames: 15,
      transitionType: 'dip',
      dipColor: '#000000',
      alignment: 'center_on_cut',
      ease: 'linear',
    },
  },
  'transition/glitch': {
    name: 'Transition Glitch',
    category: 'transitions',
    icon: Film,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      durationFrames: 12,
      transitionType: 'glitch',
      alignment: 'center_on_cut',
      ease: 'linear',
    },
  },
  'overlay/blend_mode': {
    name: 'Blend Mode Composite',
    category: 'vfx',
    icon: Layers,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      mode: 'screen',
      opacity: 1.0,
    },
  },
  'vfx/partial': {
    name: 'Partial Region VFX & Lens',
    category: 'vfx',
    icon: Sparkles,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      regions: [
        {
          id: 'reg-default-1',
          shape: 'circle',
          x: 0.5,
          y: 0.5,
          radius: 0.28,
          feather: 0.12,
          effect: 'spotlight',
          intensity: 1.4,
          color: '#00f0ff',
        },
      ],
    },
  },
  'shape/draw': {
    name: 'Vector Shape & Callout',
    category: 'text',
    icon: Layers,
    supportedTrackTypes: ['video', 'timed_text'],
    defaultParams: {
      enabled: true,
      shapeType: 'rect',
      x: 100,
      y: 100,
      width: 240,
      height: 120,
      fillColor: 'transparent',
      strokeColor: '#00f0ff',
      strokeWidth: 2,
      opacity: 1.0,
    },
  },
  time_space: {
    name: 'Time-Space Motion Graphic',
    category: 'motion',
    icon: Sparkles,
    supportedTrackTypes: ['video', 'overlay', 'image'],
    defaultParams: {
      templateId: 'callout_leader',
      boundary: 'loop',
      seed: 1337,
      params: {
        text: 'TARGET ACQUIRED',
        targetX: 0.0,
        targetY: 0.0,
        labelX: 0.35,
        labelY: -0.25,
      },
    },
  },
};

export function getAvailableModifiersFromRegistry(
  registry: ModifierPluginRegistry = ModifierPluginRegistry.getInstance()
): AvailableModifierDef[] {
  const registeredPlugins = registry.listPlugins();
  const result: AvailableModifierDef[] = [];
  const processedTypes = new Set<string>();

  for (const plugin of registeredPlugins) {
    processedTypes.add(plugin.type);
    const catalogEntry = MODIFIER_PRESENTATION_CATALOG[plugin.type];

    if (catalogEntry) {
      result.push({
        type: plugin.type,
        name: catalogEntry.name,
        category: catalogEntry.category || 'vfx',
        icon: catalogEntry.icon,
        supportedTrackTypes: catalogEntry.supportedTrackTypes,
        defaultParams: { ...catalogEntry.defaultParams },
      });
    } else {
      const isAudio = plugin.targetScope === 'audio';
      const defaultSupportedTrackTypes: Array<'video' | 'audio' | 'timed_text' | 'data'> = isAudio
        ? ['audio']
        : plugin.targetScope === 'both'
        ? ['video', 'audio', 'timed_text']
        : ['video'];

      const rawName = plugin.type.split('/').pop() || plugin.type;
      const formattedName = rawName
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      result.push({
        type: plugin.type,
        name: formattedName,
        category: 'custom',
        icon: isAudio ? Volume2 : Sparkles,
        supportedTrackTypes: defaultSupportedTrackTypes,
        defaultParams: { enabled: true },
      });
    }
  }

  for (const [type, entry] of Object.entries(MODIFIER_PRESENTATION_CATALOG)) {
    if (!processedTypes.has(type)) {
      result.push({
        type,
        name: entry.name,
        category: entry.category || 'custom',
        icon: entry.icon,
        supportedTrackTypes: entry.supportedTrackTypes,
        defaultParams: { ...entry.defaultParams },
      });
    }
  }

  return result;
}

export const ALL_AVAILABLE_MODIFIERS: AvailableModifierDef[] = getAvailableModifiersFromRegistry();

export const AVAILABLE_MODIFIERS: AvailableModifierDef[] = [
  {
    type: 'overlay/hologram_hud',
    name: 'Hologram HUD',
    category: 'vfx',
    icon: Monitor,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      ringRadiusNorm: 0.35,
      scanlineDensity: 40,
      color: '#00ffff',
      rotationSpeed: 0.5,
    },
  },
  {
    type: 'overlay/canvas_particles',
    name: 'Particle VFX & Shaders',
    category: 'vfx',
    icon: Layers,
    supportedTrackTypes: ['video'],
    defaultParams: {
      enabled: true,
      type: 'cyber_sparks',
      preset: 'cyber_sparks',
      intensity: 1.0,
      speed: 1.0,
      opacity: 0.8,
      particleCount: 1500,
      gravity: -1.2,
      drag: 0.15,
      turbulence: 1.0,
      bloomThreshold: 0.7,
      chromaticAberration: 2.0,
      shaders: {
        bloom: { enabled: true, threshold: 0.7, intensity: 1.0 },
        chromaticAberration: { enabled: true, offsetPx: 2.0 },
      },
    },
  },
];

export function formatTimecode(frames: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 30;
  const safeFrames = Math.max(0, Math.round(frames));
  const totalSeconds = Math.floor(safeFrames / safeFps);
  const f = safeFrames % safeFps;
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export function getSectionIdForModifierType(type: string): string {
  switch (type) {
    case 'transform':
      return 'transform';
    case 'motion/gsap':
      return 'motion_gsap';
    case 'vfx/depth_relighting':
    case 'vfx/depth3d_relighting':
    case 'vfx/depth3d':
      return 'relighting';
    case 'vfx/auto_reframe':
      return 'auto_reframe';
    case 'vfx/camera_3d':
    case 'camera/3d':
    case 'camera/path':
      return 'camera';
    case 'overlay/hologram_hud':
      return 'hologram_hud';
    case 'overlay/canvas_particles':
      return 'particles';
    case 'vfx/color_grading':
      return 'color';
    case 'text/style':
      return 'typography';
    case 'sfx/dynamic_ducking':
    case 'audio/volume':
    case 'audio/pan':
    case 'audio/filter':
    case 'audio/pitch':
      return 'audio';
    case 'sfx/procedural':
      return 'procedural_sfx';
    case 'transition/crossfade':
    case 'transition/wipe':
    case 'transition/push':
    case 'transition/zoom':
    case 'transition/dip':
    case 'transition/glitch':
    case 'transition/light_leak':
    case 'transition/radial_wipe':
    case 'transition/iris':
      return 'transitions';
    default:
      return `generic_${type.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  }
}
