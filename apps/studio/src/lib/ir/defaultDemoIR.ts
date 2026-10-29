import type { VideoIRDocument } from '@acc/ir';

/**
 * defaultDemoIR:
 * Canonical VideoIRDocument V1.0-Stable used as the initial demo project in Studio.
 * Complies strictly with VideoIRSchemaValidator and includes:
 * - 2 Video tracks (Primary Visuals with Color Grading & B-Roll / Overlay)
 * - 2 Audio tracks (Narration / Voiceover with dynamic ducking & Background Ambient Music)
 * - 1 Subtitles / Timed Text track
 * - Relational timings (after, matchLengthOf)
 */
export const defaultDemoIR: VideoIRDocument = {
  version: '1.0.0-stable',
  meta: {
    contentId: 'demo-cinematic-reel-v1',
    globalFps: 30,
    canvasSize: {
      w: 1920,
      h: 1080,
    },
    colorSpace: 'srgb',
    nextSequenceIndex: 8,
  },
  assets: {
    'asset-scene-1': {
      src: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&q=80',
      type: 'image',
    },
    'asset-scene-2': {
      src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
      type: 'image',
    },
    'asset-voiceover': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/robot_code.ogg',
      type: 'audio',
    },
    'asset-music': {
      src: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
      type: 'audio',
    },
  },
  tracks: [
    {
      id: 'track-v1',
      type: 'video',
      name: 'V1: Main Visual',
      sequences: [
        {
          id: 'seq-visual-1',
          name: 'Scene 1: Starlit Lake',
          type: 'image',
          assetId: 'asset-scene-1',
          time: {
            start: 0,
            duration: 90, // 3 seconds at 30fps
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: ['video', 'image', 'overlay'],
              params: {
                contrast: 1.15,
                saturation: 1.2,
                exposure: 0.05,
              },
            },
          ],
        },
        {
          id: 'seq-visual-2',
          name: 'Scene 2: Tropical Coast',
          type: 'image',
          assetId: 'asset-scene-2',
          time: {
            start: {
              after: 'seq-visual-1',
              offsetFrames: 0,
            },
            duration: 120, // 4 seconds at 30fps
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: ['video', 'image', 'overlay'],
              params: {
                contrast: 1.05,
                saturation: 0.95,
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
      name: 'V2: Overlays',
      blendMode: 'screen',
      sequences: [
        {
          id: 'seq-particle-overlay',
          name: 'Atmospheric Dust',
          type: 'overlay',
          time: {
            start: 30,
            duration: 150,
          },
          modifiers: [
            {
              type: 'overlay/canvas_particles',
              target: ['video', 'overlay'],
              params: {
                type: 'dust',
                intensity: 0.8,
                opacity: 0.4,
              },
            },
            {
              type: 'time_space',
              target: ['video', 'overlay'],
              params: {
                templateId: 'callout_leader',
                boundary: 'loop',
                seed: 1337,
                params: {
                  text: 'NATURE RESERVE',
                  targetX: -0.2,
                  targetY: 0.1,
                  labelX: 0.2,
                  labelY: -0.25,
                },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-a1',
      type: 'audio',
      name: 'A1: Voiceover',
      sequences: [
        {
          id: 'seq-narration',
          name: 'Robot Narration',
          type: 'audio',
          assetId: 'asset-voiceover',
          time: {
            start: 15,
            duration: 120,
          },
          modifiers: [
            {
              type: 'sfx/dynamic_ducking',
              target: 'audio',
              params: {
                duckVolume: 0.25,
                attackMs: 150,
                releaseMs: 300,
                targetBus: 'track-a2',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-a2',
      type: 'audio',
      name: 'A2: Ambient Music',
      sequences: [
        {
          id: 'seq-music-bg',
          name: 'Heavy Rain Ambience',
          type: 'audio',
          assetId: 'asset-music',
          time: {
            start: 0,
            duration: {
              matchLengthOf: 'seq-visual-2',
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
          id: 'seq-subs-1',
          name: 'Subtitle Line 1',
          type: 'text',
          time: {
            start: 15,
            duration: 60,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'In the vast silence of space, innovation begins.',
            },
          ],
        },
        {
          id: 'seq-subs-2',
          name: 'Subtitle Line 2',
          type: 'text',
          time: {
            start: 75,
            duration: 60,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2000,
              text: 'Visual Storytelling redefined by Universal Video IR.',
            },
          ],
        },
      ],
    },
  ],
};
