import type { VideoIRDocument } from '@acc/ir';

/**
 * quantumPhysicsDemoIR:
 * Quantum Physics & Cymatics Laboratory showcase featuring:
 * 1. time_space/cymatic_chladni (Standing acoustic waves & nodal particle clustering)
 * 2. time_space/strange_attractor (Clifford/De Jong chaotic non-linear dynamics)
 * 3. time_space/kinetic_harmonograph (Multi-pendulum epicyclic Lissajous orbits)
 */
export const quantumPhysicsDemoIR: VideoIRDocument = {
  version: '1.0.0-stable',
  meta: {
    contentId: 'demo-quantum-physics-lab-v1',
    globalFps: 30,
    canvasSize: {
      w: 1920,
      h: 1080,
    },
    colorSpace: 'srgb',
    nextSequenceIndex: 12,
  },
  assets: {
    'asset-quantum-lab': {
      src: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=1920&q=80',
      type: 'image',
    },
    'asset-particle-chamber': {
      src: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80',
      type: 'image',
    },
    'asset-resonance-audio': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_shut_down.ogg',
      type: 'audio',
    },
    'asset-subharmonic-drone': {
      src: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
      type: 'audio',
    },
  },
  tracks: [
    // Track V1: Visual Background Feeds
    {
      id: 'track-v1-quantum',
      name: 'V1 - Chamber Imagery',
      type: 'video',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-quantum-lab-bg',
          name: 'Quantum Optics Laboratory',
          type: 'image',
          assetId: 'asset-quantum-lab',
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
                contrast: 1.2,
                saturation: 0.8,
                temperature: -0.1,
                lut: 'cool_steel',
              },
            },
          ],
        },
        {
          id: 'seq-particle-chamber-bg',
          name: 'Subatomic Particle Vacuum Chamber',
          type: 'image',
          assetId: 'asset-particle-chamber',
          time: {
            start: {
              after: 'seq-quantum-lab-bg',
            },
            duration: 180,
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 0.85,
                contrast: 1.35,
                saturation: 1.1,
                temperature: 0.15,
                lut: 'teal_orange',
              },
            },
          ],
        },
      ],
    },

    // Track V2: Spatio-Temporal Mathematical Generators
    {
      id: 'track-v2-timespace',
      name: 'V2 - Spatio-Temporal Fields',
      type: 'video',
      muted: false,
      visible: true,
      sequences: [
        // Sequence 1: Cymatic Chladni Plate
        {
          id: 'seq-cymatics-chladni',
          name: 'Quantum Cymatics Nodal Lattice',
          type: 'overlay',
          time: {
            start: 0,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/cymatic_chladni',
              target: ['video', 'overlay'],
              params: {
                targetX: -0.25,
                targetY: 0.0,
                density: 56,
                theme: 'solar_flare',
                speedMultiplier: 1.0,
                scale: 1.15,
                strokeWidth: 1.8,
                boundary: 'loop',
                seed: 2026,
              },
            },
            {
              type: 'time_space/callout_leader',
              target: ['video', 'overlay'],
              params: {
                text: 'CHLADNI RESONANCE // MODE (5, 7)',
                targetX: -0.25,
                targetY: 0.0,
                labelX: -0.65,
                labelY: -0.35,
                theme: 'solar_flare',
                speedMultiplier: 1.0,
                scale: 0.9,
                strokeWidth: 1.5,
                boundary: 'loop',
              },
            },
          ],
        },

        // Sequence 2: Strange Attractor (Clifford Non-Linear Chaos)
        {
          id: 'seq-strange-attractor',
          name: 'Clifford Chaotic Strange Attractor',
          type: 'overlay',
          time: {
            start: 120,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/strange_attractor',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.0,
                targetY: 0.0,
                density: 64,
                theme: 'cyberpunk',
                speedMultiplier: 1.2,
                scale: 1.1,
                strokeWidth: 1.2,
                boundary: 'loop',
                seed: 1337,
              },
            },
            {
              type: 'time_space/hud_reticle',
              target: ['video', 'overlay'],
              params: {
                text: 'PHASE SPACE // LYAPUNOV EXPONENT +0.84',
                targetX: 0.0,
                targetY: 0.0,
                theme: 'cyberpunk',
                speedMultiplier: 0.8,
                scale: 1.2,
                strokeWidth: 1.5,
                boundary: 'loop',
              },
            },
          ],
        },

        // Sequence 3: Kinetic Harmonograph Epicycles
        {
          id: 'seq-kinetic-harmonograph',
          name: 'Damped Epicyclic Harmonograph',
          type: 'overlay',
          time: {
            start: 240,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/kinetic_harmonograph',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.15,
                targetY: 0.0,
                density: 50,
                theme: 'monochrome_titanium',
                speedMultiplier: 1.0,
                scale: 1.05,
                strokeWidth: 2.0,
                boundary: 'loop',
                seed: 42,
              },
            },
            {
              type: 'time_space/cyber_lower_third',
              target: ['video', 'overlay'],
              params: {
                text: 'FOUR-PENDULUM HARMONIC COUPLING',
                subtitle: 'RATIO 3:2:4:1 // PHASE OFFSET 0.785 RAD',
                targetX: 0.0,
                targetY: 0.65,
                theme: 'monochrome_titanium',
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

    // Track T1: Telemetry Subtitles & Scientific Annotations
    {
      id: 'track-t1-quantum-subs',
      name: 'T1 - Quantum Telemetry Annotations',
      type: 'timed_text',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-caption-part1',
          name: 'Cymatics Caption',
          type: 'text',
          time: {
            start: 0,
            duration: 120,
          },
          modifiers: [
            {
              type: 'text/style',
              target: 'text',
              params: {
                fontSize: 32,
                fontFamily: 'Inter, system-ui, sans-serif',
                color: '#ffffff',
                textAlign: 'center',
              },
            },
          ],
          timedTextCues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 1800,
              text: 'ACOUSTIC LEVITATION & STANDING NODAL WAVES',
            },
            {
              startOffsetMs: 1800,
              endOffsetMs: 4000,
              text: 'PARTICLES CONGREGATE ALONG 2D NODAL CURVATURE ZERO-CROSSINGS',
            },
          ],
        },
        {
          id: 'seq-caption-part2',
          name: 'Strange Attractor Caption',
          type: 'text',
          time: {
            start: 120,
            duration: 120,
          },
          modifiers: [
            {
              type: 'text/style',
              target: 'text',
              params: {
                fontSize: 32,
                fontFamily: 'Inter, system-ui, sans-serif',
                color: '#00f0ff',
                textAlign: 'center',
              },
            },
          ],
          timedTextCues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'DETERMINISTIC CHAOS: CLIFFORD-DE JONG STRANGE ATTRACTORS',
            },
            {
              startOffsetMs: 2000,
              endOffsetMs: 4000,
              text: 'FRACTAL RECURSION IN CONTINUOUS FOUR-DIMENSIONAL PARAMETER SPACE',
            },
          ],
        },
        {
          id: 'seq-caption-part3',
          name: 'Harmonograph Caption',
          type: 'text',
          time: {
            start: 240,
            duration: 120,
          },
          modifiers: [
            {
              type: 'text/style',
              target: 'text',
              params: {
                fontSize: 32,
                fontFamily: 'Inter, system-ui, sans-serif',
                color: '#e2e8f0',
                textAlign: 'center',
              },
            },
          ],
          timedTextCues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'QUAD-PENDULUM ROTATIONAL HARMONOGRAPH DYNAMICS',
            },
            {
              startOffsetMs: 2000,
              endOffsetMs: 4000,
              text: 'DAMPED HARMONIC RESONANCE FORMING ORTHOGONAL EPICYCLES',
            },
          ],
        },
      ],
    },

    // Track A1: Acoustic & Ambient Soundscape
    {
      id: 'track-a1-quantum-audio',
      name: 'A1 - Acoustic Resonance Bed',
      type: 'audio',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-audio-resonance',
          name: 'Resonant Acoustic Pulse',
          type: 'audio',
          assetId: 'asset-resonance-audio',
          time: {
            start: 0,
            duration: 180,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.8,
                fadeInSec: 0.5,
                fadeOutSec: 1.0,
              },
            },
          ],
        },
        {
          id: 'seq-audio-drone',
          name: 'Subharmonic Lab Drone',
          type: 'audio',
          assetId: 'asset-subharmonic-drone',
          time: {
            start: {
              after: 'seq-audio-resonance',
            },
            duration: 180,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.6,
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
