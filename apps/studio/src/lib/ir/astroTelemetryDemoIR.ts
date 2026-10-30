import type { VideoIRDocument } from '@acc/ir';

/**
 * astroTelemetryDemoIR:
 * Astroscientific Deep Space Singularity & Planetary Topography project featuring:
 * 1. time_space/relativistic_blackhole (Einstein ring, Doppler beaming, photon sphere)
 * 2. time_space/topographic_contour (Turbulent curl isolines, planetary elevation)
 * 3. time_space/hyperbolic_poincare (Poincaré conformal disk hyperbolic tessellations)
 */
export const astroTelemetryDemoIR: VideoIRDocument = {
  version: '1.0.0-stable',
  meta: {
    contentId: 'demo-astro-telemetry-v1',
    globalFps: 30,
    canvasSize: {
      w: 1920,
      h: 1080,
    },
    colorSpace: 'srgb',
    nextSequenceIndex: 12,
  },
  assets: {
    'asset-deep-cosmos': {
      src: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
      type: 'image',
    },
    'asset-stellar-nursery': {
      src: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1920&q=80',
      type: 'image',
    },
    'asset-singularity-rumble': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_shut_down.ogg',
      type: 'audio',
    },
    'asset-pulsar-wind': {
      src: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
      type: 'audio',
    },
  },
  tracks: [
    // Track V1: Deep Space Imagery
    {
      id: 'track-v1-astro',
      name: 'V1 - Deep Space Imagery',
      type: 'video',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-cosmos-background',
          name: 'Cosmic Microwave Background',
          type: 'image',
          assetId: 'asset-deep-cosmos',
          time: {
            start: 0,
            duration: 180,
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 0.9,
                contrast: 1.3,
                saturation: 0.9,
                temperature: -0.15,
                lut: 'teal_orange',
              },
            },
          ],
        },
        {
          id: 'seq-nebula-background',
          name: 'Stellar Accretion Nursery',
          type: 'image',
          assetId: 'asset-stellar-nursery',
          time: {
            start: {
              after: 'seq-cosmos-background',
            },
            duration: 180,
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 0.95,
                contrast: 1.25,
                saturation: 1.05,
                temperature: 0.1,
                lut: 'cool_steel',
              },
            },
          ],
        },
      ],
    },

    // Track V2: Astrophysical & Topological Field Generators
    {
      id: 'track-v2-timespace-astro',
      name: 'V2 - Spatio-Temporal Gravitation',
      type: 'video',
      muted: false,
      visible: true,
      sequences: [
        // Sequence 1: Relativistic Black Hole Singularity
        {
          id: 'seq-relativistic-blackhole',
          name: 'Kerr Singularity & Einstein Ring',
          type: 'overlay',
          time: {
            start: 0,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/relativistic_blackhole',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.0,
                targetY: 0.0,
                density: 56,
                theme: 'solar_flare',
                speedMultiplier: 1.0,
                scale: 1.2,
                strokeWidth: 1.8,
                boundary: 'loop',
                seed: 108,
              },
            },
            {
              type: 'time_space/hud_reticle',
              target: ['video', 'overlay'],
              params: {
                text: 'EVENT HORIZON // RS = 2GM/c²',
                targetX: 0.0,
                targetY: 0.0,
                theme: 'solar_flare',
                speedMultiplier: 0.7,
                scale: 1.35,
                strokeWidth: 1.5,
                boundary: 'loop',
              },
            },
          ],
        },

        // Sequence 2: Topographic Contour Isolines
        {
          id: 'seq-topographic-contour',
          name: 'Planetary Topographic Isolines',
          type: 'overlay',
          time: {
            start: 120,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/topographic_contour',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.0,
                targetY: 0.0,
                density: 48,
                theme: 'emerald_matrix',
                speedMultiplier: 1.0,
                scale: 1.1,
                strokeWidth: 1.6,
                boundary: 'loop',
                seed: 888,
              },
            },
            {
              type: 'time_space/callout_leader',
              target: ['video', 'overlay'],
              params: {
                text: 'ELEVATION ISOLINES // EQUIDISTANCE 500M',
                targetX: 0.2,
                targetY: -0.1,
                labelX: 0.65,
                labelY: -0.35,
                theme: 'emerald_matrix',
                speedMultiplier: 1.0,
                scale: 0.9,
                strokeWidth: 1.5,
                boundary: 'loop',
              },
            },
          ],
        },

        // Sequence 3: Hyperbolic Poincaré Disk Tessellation
        {
          id: 'seq-hyperbolic-poincare',
          name: 'Poincaré Conformal Disk',
          type: 'overlay',
          time: {
            start: 240,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/hyperbolic_poincare',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.0,
                targetY: 0.0,
                density: 48,
                theme: 'synthwave_neon',
                speedMultiplier: 1.0,
                scale: 1.15,
                strokeWidth: 1.5,
                boundary: 'loop',
                seed: 999,
              },
            },
            {
              type: 'time_space/cyber_lower_third',
              target: ['video', 'overlay'],
              params: {
                text: 'POINCARÉ HYPERBOLIC METRIC',
                subtitle: 'GAUSSIAN CURVATURE K = -1 // CONFORMAL ISOMETRY',
                targetX: 0.0,
                targetY: 0.65,
                theme: 'synthwave_neon',
                speedMultiplier: 1.0,
                scale: 1.0,
                strokeWidth: 1.5,
                boundary: 'loop',
              },
            },
          ],
        },
      ],
    },

    // Track T1: Astroscientific Subtitles & Equations
    {
      id: 'track-t1-astro-subs',
      name: 'T1 - Astroscientific Telemetry',
      type: 'timed_text',
      muted: false,
      visible: true,
      modifiers: [
        {
          type: 'timed_text/style',
          target: 'text',
          params: {
            fontSize: 32,
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#ffaa00',
            textAlign: 'center',
          },
        },
      ],
      sequences: [
        {
          id: 'seq-astro-caption-p1',
          name: 'Relativistic Caption',
          type: 'text',
          time: {
            start: 0,
            duration: 120,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'KERR BLACK HOLE: ASYMMETRIC DOPPLER ACCRETION & EINSTEIN RING',
            },
            {
              startOffsetMs: 2000,
              endOffsetMs: 4000,
              text: 'GEODESIC PHOTON DEFLECTION THROUGH EXTREME SPACETIME CURVATURE',
            },
          ],
          timedTextCues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'KERR BLACK HOLE: ASYMMETRIC DOPPLER ACCRETION & EINSTEIN RING',
            },
            {
              startOffsetMs: 2000,
              endOffsetMs: 4000,
              text: 'GEODESIC PHOTON DEFLECTION THROUGH EXTREME SPACETIME CURVATURE',
            },
          ],
        },
        {
          id: 'seq-astro-caption-p2',
          name: 'Topography Caption',
          type: 'text',
          time: {
            start: 120,
            duration: 120,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'MULTI-OCTAVE CURL TURBULENCE TOPOGRAPHIC CONTOUR EXTRACTION',
            },
            {
              startOffsetMs: 2000,
              endOffsetMs: 4000,
              text: 'SYNCHRONIZED EQUIDISTANT ISOLINES DERIVED FROM NOISE POTENTIALS',
            },
          ],
          timedTextCues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'MULTI-OCTAVE CURL TURBULENCE TOPOGRAPHIC CONTOUR EXTRACTION',
            },
            {
              startOffsetMs: 2000,
              endOffsetMs: 4000,
              text: 'SYNCHRONIZED EQUIDISTANT ISOLINES DERIVED FROM NOISE POTENTIALS',
            },
          ],
        },
        {
          id: 'seq-astro-caption-p3',
          name: 'Hyperbolic Caption',
          type: 'text',
          time: {
            start: 240,
            duration: 120,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'HYPERBOLIC TESSELLATION WITHIN POINCARÉ CONFORMAL DISK',
            },
            {
              startOffsetMs: 2000,
              endOffsetMs: 4000,
              text: 'MÖBIUS ISOMETRIES PRESERVING NON-EUCLIDEAN CONFORMAL ANGLES',
            },
          ],
          timedTextCues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'HYPERBOLIC TESSELLATION WITHIN POINCARÉ CONFORMAL DISK',
            },
            {
              startOffsetMs: 2000,
              endOffsetMs: 4000,
              text: 'MÖBIUS ISOMETRIES PRESERVING NON-EUCLIDEAN CONFORMAL ANGLES',
            },
          ],
        },
      ],
    },

    // Track A1: Deep Space Ambient Audio
    {
      id: 'track-a1-astro-audio',
      name: 'A1 - Singularity Acoustics',
      type: 'audio',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-audio-rumble',
          name: 'Gravitational Wave Infrasound',
          type: 'audio',
          assetId: 'asset-singularity-rumble',
          time: {
            start: 0,
            duration: 180,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.85,
                fadeInSec: 0.5,
                fadeOutSec: 1.0,
              },
            },
          ],
        },
        {
          id: 'seq-audio-pulsar',
          name: 'Magnetar Ion Wind Bed',
          type: 'audio',
          assetId: 'asset-pulsar-wind',
          time: {
            start: {
              after: 'seq-audio-rumble',
            },
            duration: 180,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.65,
                fadeInSec: 1.0,
                fadeOutSec: 1.5,
              },
            },
          ],
        },
      ],
    },
  ],
};
