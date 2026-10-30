import type { VideoIRDocument } from '@acc/ir';

/**
 * cinemaMasteringDemoIR:
 * Cinematic Post-Production & Timeline Mastering Showcase.
 * Demonstrates:
 * - Timeline-level master composite optics (timeline/photometric_bloom, timeline/anamorphic_glare)
 * - Multi-clip A/B editorial sequences with crossfade transitions (transition/crossfade)
 * - Track-level and clip-level color grading pipelines (vfx/color_grading)
 * - Audio narration and orchestral BGM with dynamic sidechain ducking (sfx/dynamic_ducking)
 */
export const cinemaMasteringDemoIR: VideoIRDocument = {
  version: '1.0.0-stable',
  meta: {
    contentId: 'demo-cinema-mastering-v1',
    globalFps: 30,
    canvasSize: {
      w: 1920,
      h: 1080,
    },
    colorSpace: 'srgb',
    nextSequenceIndex: 12,
  },
  assets: {
    'asset-scene-a': {
      src: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&q=80',
      type: 'image',
    },
    'asset-scene-b': {
      src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
      type: 'image',
    },
    'asset-scene-c': {
      src: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1920&q=80',
      type: 'image',
    },
    'asset-narration': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/robot_code.ogg',
      type: 'audio',
    },
    'asset-orchestral-bgm': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/deep_hum.ogg',
      type: 'audio',
    },
  },
  modifiers: [
    // Timeline-level Master Post-Processing Optics
    {
      type: 'timeline/photometric_bloom',
      target: 'timeline',
      params: {
        threshold: 0.72,
        intensity: 0.85,
        radius: 32,
        tint: '#fff4e0',
      },
    },
    {
      type: 'timeline/anamorphic_glare',
      target: 'timeline',
      params: {
        intensity: 0.6,
        streakLength: 0.75,
        color: '#4db8ff',
      },
    },
  ],
  tracks: [
    // Track V1: Primary A-Roll Camera Reel
    {
      id: 'track-v1-aroll',
      name: 'V1 - A-Roll Master Reel',
      type: 'video',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-camera-a',
          name: 'Scene A: Dawn Horizon',
          type: 'image',
          assetId: 'asset-scene-a',
          time: {
            start: 0,
            duration: 150,
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 1.0,
                contrast: 1.18,
                saturation: 1.1,
                exposure: 0.05,
                lut: 'cool_steel',
              },
            },
          ],
        },
        {
          id: 'seq-camera-b',
          name: 'Scene B: Ocean Expanse',
          type: 'image',
          assetId: 'asset-scene-b',
          time: {
            start: {
              after: 'seq-camera-a',
              offsetFrames: -25, // 25-frame editorial crossfade overlap
            },
            duration: 150,
          },
          modifiers: [
            {
              type: 'transition/crossfade',
              target: 'image',
              params: {
                durationSec: 0.833,
                type: 'dissolve',
                alignment: 'center',
              },
            },
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 0.95,
                contrast: 1.25,
                saturation: 0.95,
                exposure: -0.05,
                lut: 'bleach_bypass',
              },
            },
          ],
        },
        {
          id: 'seq-camera-c',
          name: 'Scene C: Dusk Twilight',
          type: 'image',
          assetId: 'asset-scene-c',
          time: {
            start: {
              after: 'seq-camera-b',
              offsetFrames: -20,
            },
            duration: 150,
          },
          modifiers: [
            {
              type: 'transition/crossfade',
              target: 'image',
              params: {
                durationSec: 0.667,
                type: 'dissolve',
                alignment: 'center',
              },
            },
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 1.05,
                contrast: 1.15,
                saturation: 1.2,
                lut: 'warm_golden',
              },
            },
          ],
        },
      ],
    },

    // Track V2: Atmospheric Overlay Particles
    {
      id: 'track-v2-atmosphere',
      name: 'V2 - Cinematic Dust & Mist',
      type: 'video',
      blendMode: 'screen',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-ambient-dust-stream',
          name: 'Golden Hour Dust Particles',
          type: 'overlay',
          time: {
            start: 15,
            duration: 380,
          },
          modifiers: [
            {
              type: 'overlay/canvas_particles',
              target: ['video', 'overlay'],
              params: {
                type: 'dust',
                intensity: 1.1,
                speed: 0.6,
                opacity: 0.45,
              },
            },
          ],
        },
      ],
    },

    // Audio Track A1: Voiceover Narration (Ducking Trigger Source)
    {
      id: 'track-a1-dialogue',
      name: 'A1 - Master Voiceover',
      type: 'audio',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-vo-1',
          name: 'Narration Take 1',
          type: 'audio',
          assetId: 'asset-narration',
          time: {
            start: 30,
            duration: 120,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 1.0,
              },
            },
          ],
        },
        {
          id: 'seq-vo-2',
          name: 'Narration Take 2',
          type: 'audio',
          assetId: 'asset-narration',
          time: {
            start: 200,
            duration: 140,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 1.0,
              },
            },
          ],
        },
      ],
    },

    // Audio Track A2: Orchestral BGM (Sidechain Ducked by A1)
    {
      id: 'track-a2-bgm',
      name: 'A2 - Orchestral Soundscape',
      type: 'audio',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-bgm-orch',
          name: 'Symphonic Drone Movement',
          type: 'audio',
          assetId: 'asset-orchestral-bgm',
          time: {
            start: 0,
            duration: 400,
          },
          modifiers: [
            {
              type: 'sfx/dynamic_ducking',
              target: 'audio',
              params: {
                sourceTrackId: 'track-a1-dialogue',
                thresholdDb: -22,
                duckingDb: -14,
                attackMs: 25,
                releaseMs: 350,
              },
            },
            {
              type: 'audio/filter',
              target: 'audio',
              params: {
                type: 'lowpass',
                frequency: 8000,
                q: 0.707,
              },
            },
          ],
        },
      ],
    },

    // Timed Text Track: Narrative Film Subtitles
    {
      id: 'track-subtitles-cinema',
      name: 'T1 - Cinematic Dialogue Subtitles',
      type: 'timed_text',
      muted: false,
      visible: true,
      modifiers: [
        {
          type: 'timed_text/style',
          target: 'timed_text',
          params: {
            fontSize: 24,
            fontFamily: 'Georgia, serif',
            textColor: '#f5f5f5',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            position: 'bottom',
          },
        },
      ],
      sequences: [
        {
          id: 'seq-sub-cinema-1',
          name: 'Sub: In the quiet dawn',
          type: 'text',
          time: {
            start: 35,
            duration: 110,
          },
          text: 'In the quiet dawn, the world awakens with untold promise.',
        },
        {
          id: 'seq-sub-cinema-2',
          name: 'Sub: Across the waters',
          type: 'text',
          time: {
            start: 205,
            duration: 130,
          },
          text: 'Across the endless waters, memory echoes into tomorrow.',
        },
      ],
    },
  ],
};
