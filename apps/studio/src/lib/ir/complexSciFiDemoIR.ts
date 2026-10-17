import type { VideoIRDocument } from '@acc/ir';

/**
 * complexSciFiDemoIR:
 * Comprehensive, production-grade 9-track Sci-Fi Cyberpunk Epic VideoIR Document.
 * Demonstrates:
 * - 4 Video Tracks (V1 Plate, V2 3D Depth Parallax, V3 Volumetric Particles, V4 HUD)
 * - 3 Audio Tracks (A1 Dialogue Voiceover, A2 Impact SFX, A3 Synthwave BGM)
 * - 2 Timed Text Tracks (Subtitles, HUD Telemetry)
 * - All core modifiers: vfx/color_grading, vfx/depth3d, overlay/canvas_particles, sfx/dynamic_ducking, transition/crossfade
 */
export const complexSciFiDemoIR: VideoIRDocument = {
  version: '1.0.0-stable',
  meta: {
    contentId: 'sci-fi-cyberpunk-epic-2099',
    globalFps: 30,
    canvasSize: {
      w: 1920,
      h: 1080,
    },
    colorSpace: 'srgb',
  },
  assets: {
    'asset-cyber-city': {
      src: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1920&q=80',
      type: 'image',
    },
    'asset-neon-warrior': {
      src: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1920&q=80',
      type: 'image',
    },
    'asset-matrix-core': {
      src: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&q=80',
      type: 'image',
    },
    'asset-voice-pilot': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/ringing_ambient_background.ogg',
      type: 'audio',
    },
    'asset-laser-impact': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/windchime_drone.ogg',
      type: 'audio',
    },
    'asset-synth-bgm': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/electric_ring_long.ogg',
      type: 'audio',
    },
  },
  tracks: [
    {
      id: 'track-v1',
      type: 'video',
      name: 'V1: Cyberpunk Plate',
      sequences: [
        {
          id: 'seq-city-intro',
          type: 'image',
          assetId: 'asset-cyber-city',
          time: {
            start: 0,
            duration: 120, // 4s
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: ['video', 'image', 'overlay'],
              params: {
                contrast: 1.25,
                saturation: 1.4,
                exposure: 0.1,
              },
            },
          ],
        },
        {
          id: 'seq-core-reveal',
          type: 'image',
          assetId: 'asset-matrix-core',
          time: {
            start: {
              after: 'seq-city-intro',
              offsetFrames: 0,
            },
            duration: 150, // 5s
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: ['video', 'image', 'overlay'],
              params: {
                contrast: 1.15,
                saturation: 1.2,
                exposure: -0.05,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-v2',
      type: 'video',
      name: 'V2: 3D Depth Hologram',
      blendMode: 'screen',
      sequences: [
        {
          id: 'seq-holo-subject',
          type: 'image',
          assetId: 'asset-neon-warrior',
          time: {
            start: 30,
            duration: 180,
          },
          modifiers: [
            {
              type: 'vfx/depth3d',
              target: ['video', 'image'],
              params: {
                mode: 'frame_breaker',
                popOutIntensity: 1.35,
                floatMotion: true,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-v3',
      type: 'video',
      name: 'V3: Volumetric VFX',
      blendMode: 'screen',
      sequences: [
        {
          id: 'seq-matrix-rain',
          type: 'overlay',
          time: {
            start: 0,
            duration: 270,
          },
          modifiers: [
            {
              type: 'overlay/canvas_particles',
              target: ['video', 'overlay'],
              params: {
                type: 'matrix_rain',
                intensity: 1.2,
                opacity: 0.55,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-v4',
      type: 'video',
      name: 'V4: HUD Telemetry',
      blendMode: 'screen',
      sequences: [
        {
          id: 'seq-hud-tactical',
          type: 'overlay',
          time: {
            start: 45,
            duration: 210,
          },
          modifiers: [
            {
              type: 'overlay/canvas_particles',
              target: ['video', 'overlay'],
              params: {
                type: 'sci_fi_hud',
                intensity: 0.9,
                opacity: 0.75,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-a1',
      type: 'audio',
      name: 'A1: Pilot Dialogue',
      sequences: [
        {
          id: 'seq-pilot-comm',
          type: 'audio',
          assetId: 'asset-voice-pilot',
          time: {
            start: 20,
            duration: 150,
          },
          modifiers: [
            {
              type: 'sfx/dynamic_ducking',
              target: 'audio',
              params: {
                duckVolume: 0.2,
                attackMs: 120,
                releaseMs: 250,
                targetBus: 'track-a3',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-a2',
      type: 'audio',
      name: 'A2: Impact SFX',
      sequences: [
        {
          id: 'seq-laser-hit',
          type: 'audio',
          assetId: 'asset-laser-impact',
          time: {
            start: 90,
            duration: 60,
          },
        },
      ],
    },
    {
      id: 'track-a3',
      type: 'audio',
      name: 'A3: Synthwave BGM',
      sequences: [
        {
          id: 'seq-synth-score',
          type: 'audio',
          assetId: 'asset-synth-bgm',
          time: {
            start: 0,
            duration: {
              matchLengthOf: 'seq-core-reveal',
              paddingFrames: 30,
            },
          },
        },
      ],
    },
    {
      id: 'track-subtitles',
      type: 'timed_text',
      name: 'Subtitles',
      sequences: [
        {
          id: 'seq-dialogue-1',
          type: 'text',
          time: {
            start: 20,
            duration: 70,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2300,
              text: 'Protocol 2099 initiated. Neural handshake stabilized.',
            },
          ],
        },
        {
          id: 'seq-dialogue-2',
          type: 'text',
          time: {
            start: 95,
            duration: 75,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2500,
              text: 'Visual Storytelling Generator core online.',
            },
          ],
        },
      ],
    },
    {
      id: 'track-hud-data',
      type: 'timed_text',
      name: 'HUD Callouts',
      sequences: [
        {
          id: 'seq-hud-callout',
          type: 'text',
          time: {
            start: 45,
            duration: 150,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 5000,
              text: 'TARGET ACQUIRED: PARALLAX 3D BREACH DETECTED',
            },
          ],
        },
      ],
    },
  ],
};
