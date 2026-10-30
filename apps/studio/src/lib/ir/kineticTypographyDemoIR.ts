import type { VideoIRDocument } from '@acc/ir';

/**
 * kineticTypographyDemoIR:
 * Motion Graphics & Parametric Geometry Showcase.
 * Demonstrates:
 * - Dynamic kinetic title sequences (time_space/kinetic_title)
 * - Multi-target telemetry callouts (time_space/callout_multitarget)
 * - Neural network particle plexus graph (time_space/network_plexus)
 * - Matrix hex datastream telemetry (time_space/glitch_datastream)
 * - Gielis superformula parametric geometry (time_space/superformula)
 * - Universal spatial transforms (transform) and GSAP animations (motion/gsap)
 */
export const kineticTypographyDemoIR: VideoIRDocument = {
  version: '1.0.0-stable',
  meta: {
    contentId: 'demo-kinetic-typography-v1',
    globalFps: 30,
    canvasSize: {
      w: 1920,
      h: 1080,
    },
    colorSpace: 'srgb',
    nextSequenceIndex: 10,
  },
  assets: {
    'asset-dark-grid-bg': {
      src: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&q=80',
      type: 'image',
    },
    'asset-techno-bgm': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/deep_hum.ogg',
      type: 'audio',
    },
  },
  tracks: [
    // Track V1: Visual Dark Grid Foundation
    {
      id: 'track-v1-foundation',
      name: 'V1 - Dark Grid Canvas',
      type: 'video',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-bg-canvas',
          name: 'Foundation Dark Grid',
          type: 'image',
          assetId: 'asset-dark-grid-bg',
          time: {
            start: 0,
            duration: 360,
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 0.8,
                contrast: 1.3,
                saturation: 0.7,
                lut: 'cool_steel',
              },
            },
          ],
        },
      ],
    },

    // Track V2: Mathematical & Network Morphing Geometry
    {
      id: 'track-v2-geometry',
      name: 'V2 - Parametric Geometry & Network Plexus',
      type: 'video',
      blendMode: 'screen',
      muted: false,
      visible: true,
      sequences: [
        // Sequence 1: Gielis Superformula Morphing
        {
          id: 'seq-superformula-morph',
          name: 'Gielis Superformula Morphology',
          type: 'overlay',
          time: {
            start: 0,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/superformula',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.0,
                targetY: 0.0,
                density: 64,
                theme: 'synthwave_neon',
                speedMultiplier: 1.0,
                scale: 1.25,
                strokeWidth: 2.0,
                boundary: 'loop',
                seed: 42,
              },
            },
          ],
        },

        // Sequence 2: Interactive Neural Network Plexus
        {
          id: 'seq-network-plexus',
          name: 'Neural Network Plexus Graph',
          type: 'overlay',
          time: {
            start: 120,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/network_plexus',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.0,
                targetY: 0.0,
                density: 50,
                theme: 'emerald_matrix',
                speedMultiplier: 1.0,
                scale: 1.2,
                strokeWidth: 1.5,
                boundary: 'loop',
                seed: 2026,
              },
            },
          ],
        },

        // Sequence 3: Matrix Hex Datastream
        {
          id: 'seq-glitch-datastream',
          name: 'Hexadecimal Telemetry Stream',
          type: 'overlay',
          time: {
            start: 240,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/glitch_datastream',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.0,
                targetY: 0.0,
                density: 40,
                theme: 'solar_flare',
                speedMultiplier: 1.2,
                scale: 1.1,
                strokeWidth: 1.5,
                boundary: 'loop',
                seed: 777,
              },
            },
          ],
        },
      ],
    },

    // Track V3: Kinetic Typography & Multi-Target Callouts
    {
      id: 'track-v3-typography',
      name: 'V3 - Kinetic Titles & Multi-Target Callouts',
      type: 'video',
      blendMode: 'normal',
      muted: false,
      visible: true,
      sequences: [
        // Sequence 1: Kinetic Impact Title
        {
          id: 'seq-kinetic-title',
          name: 'Title: PARAMETRIC DYNAMICS',
          type: 'overlay',
          time: {
            start: 15,
            duration: 105,
          },
          modifiers: [
            {
              type: 'time_space/kinetic_title',
              target: ['video', 'overlay'],
              params: {
                text: 'PARAMETRIC DYNAMICS',
                targetX: 0.0,
                targetY: -0.3,
                theme: 'synthwave_neon',
                speedMultiplier: 1.0,
                scale: 1.2,
                strokeWidth: 2.0,
                boundary: 'once',
                seed: 101,
              },
            },
          ],
        },

        // Sequence 2: Multi-Target Telemetry Node Callout
        {
          id: 'seq-callout-multitarget',
          name: 'Callout: Neural Cluster Nodes',
          type: 'overlay',
          time: {
            start: 135,
            duration: 105,
          },
          modifiers: [
            {
              type: 'time_space/callout_multitarget',
              target: ['video', 'overlay'],
              params: {
                text: 'SYNAPTIC WEIGHT CONVERGENCE',
                targetX: 0.0,
                targetY: 0.0,
                labelX: 0.6,
                labelY: -0.3,
                theme: 'emerald_matrix',
                speedMultiplier: 1.0,
                scale: 1.0,
                strokeWidth: 1.5,
                boundary: 'loop',
                seed: 888,
              },
            },
          ],
        },

        // Sequence 3: Lower-Third Matrix Descriptor
        {
          id: 'seq-cyber-lower-third-geo',
          name: 'Lower Third: Quantum Encryption Stream',
          type: 'overlay',
          time: {
            start: 255,
            duration: 105,
          },
          modifiers: [
            {
              type: 'time_space/cyber_lower_third',
              target: ['video', 'overlay'],
              params: {
                text: 'QUANTUM KEY DISTRIBUTION',
                subtitle: 'ENTROPY 0.9998 // SECURE CHANNEL ESTABLISHED',
                targetX: 0.0,
                targetY: 0.65,
                theme: 'solar_flare',
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

    // Audio Track A1: Deep Techno Drone
    {
      id: 'track-a1-bgm',
      name: 'A1 - Master Cyber BGM',
      type: 'audio',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-audio-techno',
          name: 'Deep Techno Cyber Pulse',
          type: 'audio',
          assetId: 'asset-techno-bgm',
          time: {
            start: 0,
            duration: 360,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.85,
              },
            },
          ],
        },
      ],
    },

    // Timed Text Track: Annotation Stream
    {
      id: 'track-subtitles',
      name: 'T1 - Technical Telemetry Subtitles',
      type: 'timed_text',
      muted: false,
      visible: true,
      modifiers: [
        {
          type: 'timed_text/style',
          target: 'timed_text',
          params: {
            fontSize: 22,
            fontFamily: 'Inter, monospace',
            textColor: '#00ffff',
            backgroundColor: 'rgba(5, 10, 20, 0.75)',
            position: 'bottom',
          },
        },
      ],
      sequences: [
        {
          id: 'seq-sub-1',
          name: 'Cue: Parametric Morphology',
          type: 'text',
          time: {
            start: 10,
            duration: 90,
          },
          text: 'INITIALIZING NON-EUCLIDEAN TOPOLOGY ENGINE...',
        },
        {
          id: 'seq-sub-2',
          name: 'Cue: Neural Plexus',
          type: 'text',
          time: {
            start: 130,
            duration: 90,
          },
          text: '50-NODE DIRECTED GRAPH COUPLING COMPLETE.',
        },
        {
          id: 'seq-sub-3',
          name: 'Cue: Quantum Encryption',
          type: 'text',
          time: {
            start: 250,
            duration: 90,
          },
          text: 'BROADCASTING ENCRYPTED TELEMETRY TO ALL ORBITAL RELAYS.',
        },
      ],
    },
  ],
};
