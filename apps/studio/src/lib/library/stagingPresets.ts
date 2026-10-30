import type { IRSequence, SequenceType } from '@acc/ir';
import { ModifierPluginRegistry } from '@acc/ir';
import { SFX_LIBRARY_CATALOG, convertSFXToPreset, SFX_PRESETS } from './sfxBank';
import { TYPOGRAPHY_PRESETS } from './typographyBank';
import { SHAPE_PRESETS } from './shapesBank';
import { VFX_PRESETS } from './vfxBank';
import { VIDEO_FOOTAGE_PRESETS } from './footageBank';
import { AUDIO_FOOTAGE_PRESETS } from './audioFootageBank';

export type PresetCategory = 'text' | 'shape' | 'vfx' | 'overlay' | 'sfx' | 'video' | 'audio';

export interface StagingPreset {
  id: string;
  category: PresetCategory;
  name: string;
  badge: string;
  description: string;
  iconName:
    | 'Type'
    | 'Square'
    | 'Circle'
    | 'ArrowUpRight'
    | 'Sparkles'
    | 'Eye'
    | 'Sun'
    | 'Zap'
    | 'Volume2'
    | 'Music'
    | 'Radio'
    | 'Video'
    | 'Film'
    | 'Play';
  targetTrackId: string;
  targetTrackType: 'timed_text' | 'video' | 'audio';
  targetTrackName: string;
  type?: SequenceType;
  assetId?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  bpm?: number;
  createSequence: (opts: {
    startFrame: number;
    durationFrames?: number;
    normX?: number; // 0..1
    normY?: number; // 0..1
  }) => IRSequence;
}

export const STAGING_PRESETS: StagingPreset[] = [
  // ==========================================
  // 1. TEXT PRESETS
  // ==========================================
  {
    id: 'text_title',
    category: 'text',
    name: 'Cinematic Title',
    badge: 'Heading',
    description: 'Bold typographic title with cinematic tracking and cold cyan glow',
    iconName: 'Type',
    targetTrackId: 'track-text-overlay',
    targetTrackType: 'timed_text',
    targetTrackName: 'Text Overlays',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.4 }) => ({
      id: `seq-title-${Date.now()}`,
      type: 'text',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      cues: [
        {
          startOffsetMs: 0,
          endOffsetMs: (durationFrames / 30) * 1000,
          text: 'NEURAL HORIZON 2099',
        },
      ],
      modifiers: [
        {
          type: 'transform',
          target: 'text',
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
          },
        },
        {
          type: 'timed_text/style',
          target: 'text',
          params: {
            fontFamily: 'Cinzel',
            fontSize: 54,
            fontWeight: 800,
            textColor: '#ffffff',
            glowColor: '#00d4ff',
            letterSpacing: 4,
          },
        },
      ],
    }),
  },
  {
    id: 'text_lower_third',
    category: 'text',
    name: 'Cyberpunk Lower Third',
    badge: 'Lower 3rd',
    description: 'Dual-row presenter tag with illuminated indigo accent bar',
    iconName: 'Type',
    targetTrackId: 'track-text-overlay',
    targetTrackType: 'timed_text',
    targetTrackName: 'Text Overlays',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.3, normY = 0.82 }) => ({
      id: `seq-lowerthird-${Date.now()}`,
      type: 'text',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      cues: [
        {
          startOffsetMs: 0,
          endOffsetMs: (durationFrames / 30) * 1000,
          text: 'DR. AELIA VEX // QUANTUM ARCHITECT',
        },
      ],
      modifiers: [
        {
          type: 'transform',
          target: 'text',
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 0.85,
            rotation: 0,
          },
        },
        {
          type: 'timed_text/style',
          target: 'text',
          params: {
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 600,
            textColor: '#e2e8f0',
            glowColor: '#6366f1',
            letterSpacing: 1.5,
          },
        },
      ],
    }),
  },
  {
    id: 'text_badge',
    category: 'text',
    name: 'Status Telemetry Badge',
    badge: 'Badge',
    description: 'Compact monospace status pill with emerald glow and live telemetry bracket',
    iconName: 'Zap',
    targetTrackId: 'track-hud-data',
    targetTrackType: 'timed_text',
    targetTrackName: 'HUD Callouts',
    createSequence: ({ startFrame, durationFrames = 120, normX = 0.8, normY = 0.15 }) => ({
      id: `seq-badge-${Date.now()}`,
      type: 'text',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      cues: [
        {
          startOffsetMs: 0,
          endOffsetMs: (durationFrames / 30) * 1000,
          text: 'STATUS: QUANTUM LOCK ACTIVE [99.8%]',
        },
      ],
      modifiers: [
        {
          type: 'transform',
          target: 'text',
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 0.8,
            rotation: 0,
          },
        },
        {
          type: 'timed_text/style',
          target: 'text',
          params: {
            fontFamily: 'Fira Code',
            fontSize: 14,
            fontWeight: 700,
            textColor: '#10b981',
            glowColor: '#10b981',
            letterSpacing: 1,
          },
        },
      ],
    }),
  },
  {
    id: 'text_callout',
    category: 'text',
    name: 'HUD Callout Tag',
    badge: 'Callout',
    description: 'Target reticle callout banner with amber bracketed telemetry',
    iconName: 'Type',
    targetTrackId: 'track-hud-data',
    targetTrackType: 'timed_text',
    targetTrackName: 'HUD Callouts',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.25 }) => ({
      id: `seq-callout-${Date.now()}`,
      type: 'text',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      cues: [
        {
          startOffsetMs: 0,
          endOffsetMs: (durationFrames / 30) * 1000,
          text: 'TARGET ACQUIRED: PARALLAX 3D BREACH DETECTED',
        },
      ],
      modifiers: [
        {
          type: 'transform',
          target: 'text',
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 0.9,
            rotation: 0,
          },
        },
        {
          type: 'timed_text/style',
          target: 'text',
          params: {
            fontFamily: 'Fira Code',
            fontSize: 16,
            fontWeight: 700,
            textColor: '#f59e0b',
            glowColor: '#f59e0b',
            letterSpacing: 2,
          },
        },
      ],
    }),
  },

  // ==========================================
  // 2. VECTOR SHAPES PRESETS
  // ==========================================
  {
    id: 'shape_rect',
    category: 'shape',
    name: 'Vector Bounding Box',
    badge: 'Shape',
    description: 'Translucent wireframe bounding box with neon borders',
    iconName: 'Square',
    targetTrackId: 'track-shapes',
    targetTrackType: 'video',
    targetTrackName: 'Vector Shapes',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-shape-rect-${Date.now()}`,
      type: 'overlay',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
          },
        },
        {
          type: 'shape/vector',
          target: 'overlay',
          params: {
            geometry: 'rounded_rect',
            cornerRadius: 4,
            width: 320,
            height: 180,
            strokeColor: '#818cf8',
            fillColor: 'rgba(99, 102, 241, 0.12)',
            strokeWidth: 2,
          },
        },
      ],
    }),
  },
  {
    id: 'shape_rounded_box',
    category: 'shape',
    name: 'Frosted Glass Panel',
    badge: 'Shape',
    description: 'Sleek rounded backdrop container for HUD cards and telemetry panels',
    iconName: 'Square',
    targetTrackId: 'track-shapes',
    targetTrackType: 'video',
    targetTrackName: 'Vector Shapes',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-shape-panel-${Date.now()}`,
      type: 'overlay',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
          },
        },
        {
          type: 'shape/vector',
          target: 'overlay',
          params: {
            geometry: 'rounded_rect',
            cornerRadius: 14,
            width: 360,
            height: 220,
            strokeColor: 'rgba(255, 255, 255, 0.25)',
            fillColor: 'rgba(15, 23, 42, 0.75)',
            strokeWidth: 1.5,
          },
        },
      ],
    }),
  },
  {
    id: 'shape_circle',
    category: 'shape',
    name: 'HUD Reticle Ring',
    badge: 'Shape',
    description: 'Dashed targeting circle with cyan laser boundary',
    iconName: 'Circle',
    targetTrackId: 'track-shapes',
    targetTrackType: 'video',
    targetTrackName: 'Vector Shapes',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-shape-circle-${Date.now()}`,
      type: 'overlay',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
          },
        },
        {
          type: 'shape/vector',
          target: 'overlay',
          params: {
            geometry: 'circle',
            width: 180,
            height: 180,
            strokeColor: '#06b6d4',
            fillColor: 'rgba(6, 182, 212, 0.08)',
            strokeWidth: 2,
            isDashed: true,
          },
        },
      ],
    }),
  },
  {
    id: 'shape_arrow',
    category: 'shape',
    name: 'Vector Direction Arrow',
    badge: 'Shape',
    description: 'Neon chevron pointer indicator pointing to target coordinate',
    iconName: 'ArrowUpRight',
    targetTrackId: 'track-shapes',
    targetTrackType: 'video',
    targetTrackName: 'Vector Shapes',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-shape-arrow-${Date.now()}`,
      type: 'overlay',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
          },
        },
        {
          type: 'shape/vector',
          target: 'overlay',
          params: {
            geometry: 'arrow',
            width: 120,
            height: 80,
            strokeColor: '#f43f5e',
            fillColor: '#f43f5e',
            strokeWidth: 3,
          },
        },
      ],
    }),
  },

  // ==========================================
  // 3. PARTIAL VFX PRESETS
  // ==========================================
  {
    id: 'vfx_regional_blur',
    category: 'vfx',
    name: 'Regional Blur / Pixelate',
    badge: 'Partial VFX',
    description: 'Localized frosted privacy blur or sensor pixelation box',
    iconName: 'Eye',
    targetTrackId: 'track-partial-vfx',
    targetTrackType: 'video',
    targetTrackName: 'Partial VFX Overlays',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-vfx-blur-${Date.now()}`,
      type: 'overlay',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
          },
        },
        {
          type: 'vfx/partial',
          target: 'overlay',
          params: {
            regions: [
              {
                type: 'blur',
                x: normX,
                y: normY,
                width: 0.35,
                height: 0.25,
                intensity: 16,
              },
            ],
            label: 'REGIONAL BLUR',
          },
        },
      ],
    }),
  },
  {
    id: 'vfx_spotlight',
    category: 'vfx',
    name: 'Spotlight / Radial Relight',
    badge: 'Partial VFX',
    description: 'Localized dynamic spotlight illumination cone with soft feathering',
    iconName: 'Sun',
    targetTrackId: 'track-partial-vfx',
    targetTrackType: 'video',
    targetTrackName: 'Partial VFX Overlays',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-vfx-spotlight-${Date.now()}`,
      type: 'overlay',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
          },
        },
        {
          type: 'vfx/partial',
          target: 'overlay',
          params: {
            regions: [
              {
                type: 'spotlight',
                x: normX,
                y: normY,
                radius: 160,
                intensity: 1.8,
                color: '#00d4ff',
              },
            ],
            label: 'SPOTLIGHT CONE',
          },
        },
      ],
    }),
  },
  {
    id: 'vfx_regional_glitch',
    category: 'vfx',
    name: 'Regional Glitch & RGB Shift',
    badge: 'Partial VFX',
    description: 'Localized digital glitch artifact block with chromatic displacement',
    iconName: 'Zap',
    targetTrackId: 'track-partial-vfx',
    targetTrackType: 'video',
    targetTrackName: 'Partial VFX Overlays',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-vfx-glitch-${Date.now()}`,
      type: 'overlay',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
          },
        },
        {
          type: 'vfx/partial',
          target: 'overlay',
          params: {
            regions: [
              {
                type: 'glitch',
                x: normX,
                y: normY,
                width: 0.35,
                height: 0.2,
                intensity: 0.85,
              },
            ],
            label: 'RGB TEAR',
          },
        },
      ],
    }),
  },
  {
    id: 'vfx_point_emitter',
    category: 'vfx',
    name: 'Point Particle Emitter',
    badge: 'Partial VFX',
    description: 'Radial particle generator bursting neon sparks from an anchor point',
    iconName: 'Sparkles',
    targetTrackId: 'track-partial-vfx',
    targetTrackType: 'video',
    targetTrackName: 'Partial VFX Overlays',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-vfx-emitter-${Date.now()}`,
      type: 'overlay',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
          },
        },
        {
          type: 'vfx/partial',
          target: 'overlay',
          params: {
            regions: [
              {
                type: 'point_emitter',
                x: normX,
                y: normY,
                intensity: 1.5,
                color: '#ec4899',
              },
            ],
            label: 'PARTICLE BURST',
          },
        },
      ],
    }),
  },

  // ==========================================
  // 4. OVERLAY VFX PRESETS
  // ==========================================
  {
    id: 'overlay_particles_sparks',
    category: 'overlay',
    name: 'Cyber Sparks Particle Overlay',
    badge: 'VFX Overlay',
    description: 'Autonomous floating spark swarm with bloom and gravitational drift',
    iconName: 'Sparkles',
    targetTrackId: 'track-overlay-vfx',
    targetTrackType: 'video',
    targetTrackName: 'VFX Overlays',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-overlay-sparks-${Date.now()}`,
      type: 'overlay',
      blendMode: 'screen',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
            opacity: 1.0,
          },
        },
        {
          type: 'overlay/canvas_particles',
          target: ['video', 'overlay'],
          params: {
            enabled: true,
            type: 'cyber_sparks',
            preset: 'cyber_sparks',
            intensity: 1.0,
            speed: 1.0,
            opacity: 0.85,
            particleCount: 1500,
            shaders: {
              bloom: { enabled: true, threshold: 0.7, intensity: 1.2 },
              chromaticAberration: { enabled: true, offsetPx: 2.0 },
            },
          },
        },
      ],
    }),
  },
  {
    id: 'overlay_particles_snow',
    category: 'overlay',
    name: 'Atmospheric Snow / Embers Overlay',
    badge: 'VFX Overlay',
    description: 'Gentle falling particle field simulating atmospheric snow or embers',
    iconName: 'Sparkles',
    targetTrackId: 'track-overlay-vfx',
    targetTrackType: 'video',
    targetTrackName: 'VFX Overlays',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-overlay-snow-${Date.now()}`,
      type: 'overlay',
      blendMode: 'screen',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
            opacity: 1.0,
          },
        },
        {
          type: 'overlay/canvas_particles',
          target: ['video', 'overlay'],
          params: {
            enabled: true,
            type: 'cosmic_dust',
            preset: 'cosmic_dust',
            intensity: 0.85,
            speed: 0.7,
            opacity: 0.75,
            particleCount: 1200,
          },
        },
      ],
    }),
  },
  {
    id: 'overlay_hologram_hud',
    category: 'overlay',
    name: 'Sci-Fi Hologram HUD Overlay',
    badge: 'VFX Overlay',
    description: 'Rotating targeting reticle ring and scanline diagnostic HUD',
    iconName: 'Eye',
    targetTrackId: 'track-overlay-vfx',
    targetTrackType: 'video',
    targetTrackName: 'VFX Overlays',
    createSequence: ({ startFrame, durationFrames = 90, normX = 0.5, normY = 0.5 }) => ({
      id: `seq-overlay-hud-${Date.now()}`,
      type: 'overlay',
      blendMode: 'screen',
      time: {
        start: startFrame,
        duration: durationFrames,
      },
      modifiers: [
        {
          type: 'transform',
          target: ['video', 'overlay'],
          params: {
            normX,
            normY,
            x: (normX - 0.5) * 600,
            y: (normY - 0.5) * 400,
            scale: 1.0,
            rotation: 0,
            opacity: 1.0,
          },
        },
        {
          type: 'overlay/hologram_hud',
          target: ['video', 'overlay'],
          params: {
            enabled: true,
            ringRadiusNorm: 0.35,
            scanlineDensity: 40,
            color: '#00ffff',
            rotationSpeed: 0.5,
          },
        },
      ],
    }),
  },

  // ==========================================
  // 5. EXPANDED TYPOGRAPHY BANK
  // ==========================================
  ...TYPOGRAPHY_PRESETS,

  // ==========================================
  // 6. EXPANDED DESIGNER SHAPES BANK
  // ==========================================
  ...SHAPE_PRESETS,

  // ==========================================
  // 7. EXPANDED ATMOSPHERIC & CINEMATIC VFX
  // ==========================================
  ...VFX_PRESETS,

  // ==========================================
  // 8. PROCEDURAL SFX PRESETS (104 Curated Sounds across 6 Banks + Legacy Aliases)
  // ==========================================
  ...SFX_PRESETS,

  // ==========================================
  // 9. VIDEO FOOTAGE PRESETS (Curated Royalty-Free Plates)
  // ==========================================
  ...VIDEO_FOOTAGE_PRESETS,

  // ==========================================
  // 10. AUDIO FOOTAGE PRESETS (Curated Royalty-Free Scores)
  // ==========================================
  ...AUDIO_FOOTAGE_PRESETS,
];

export const PRESET_LIBRARY = STAGING_PRESETS;

export function getPresetsByCategory(category: PresetCategory): StagingPreset[] {
  return STAGING_PRESETS.filter((p) => p.category === category || (category === 'vfx' && p.category === 'overlay'));
}

export function getDynamicStagingPresets(): StagingPreset[] {
  const dynamicGenerators = ModifierPluginRegistry.getInstance().getGeneratorsForLibrary();
  const existingIds = new Set(STAGING_PRESETS.map((p) => p.id));
  const dynamicPresets: StagingPreset[] = [];

  for (const plugin of dynamicGenerators) {
    const safeId = `gen_${plugin.type.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    if (existingIds.has(safeId)) continue;

    const catStr = plugin.schema?.category;
    const category: PresetCategory =
      catStr === 'audio' ? 'audio' : catStr === 'shapes' ? 'shape' : catStr === 'typography' || catStr === 'text' ? 'text' : 'vfx';

    const rawName = plugin.type.split('/').pop() || plugin.type;
    const formattedName =
      plugin.schema?.displayName ||
      rawName
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    dynamicPresets.push({
      id: safeId,
      name: formattedName,
      category,
      badge: 'GENERATOR',
      description: plugin.schema?.displayName || `Procedural ${plugin.type} generator`,
      iconName: category === 'audio' ? 'Volume2' : category === 'shape' ? 'Square' : 'Sparkles',
      targetTrackId: category === 'audio' ? 'track-a1' : 'track-v1',
      targetTrackType: category === 'audio' ? 'audio' : 'video',
      targetTrackName: category === 'audio' ? 'Audio Track' : 'VFX Overlay Track',
      type: category === 'audio' ? 'audio' : 'overlay',
      createSequence: (opts) => ({
        id: `seq_${safeId}_${Date.now().toString(36)}`,
        name: formattedName,
        type: (category === 'audio' ? 'audio' : 'overlay') as SequenceType,
        startFrame: opts.startFrame,
        durationFrames: opts.durationFrames || 90,
        timelineStartFrame: opts.startFrame,
        time: { start: opts.startFrame, duration: opts.durationFrames || 90 },
        modifiers: [
          {
            type: plugin.type,
            target: (category === 'audio' ? 'audio' : 'overlay') as SequenceType,
            params: { ...(plugin.schema?.resetDefaults || {}) },
          },
          {
            type: 'transform',
            target: (category === 'audio' ? 'audio' : 'overlay') as SequenceType,
            params: { normX: opts.normX ?? 0.5, normY: opts.normY ?? 0.5 },
          },
        ],
      }),
    });
  }

  return [...STAGING_PRESETS, ...dynamicPresets];
}

