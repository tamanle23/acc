import type { VideoIRDocument } from '@acc/ir';

/**
 * broadcastNewsDemoIR:
 * Broadcast News Matrix project featuring procedural cyber lower-thirds,
 * countdown sequences, and dynamic audio telemetry.
 */
export const broadcastNewsDemoIR: VideoIRDocument = {
  version: '1.0.0-stable',
  meta: {
    contentId: 'demo-broadcast-news-v1',
    globalFps: 30,
    canvasSize: {
      w: 1920,
      h: 1080,
    },
    colorSpace: 'srgb',
    nextSequenceIndex: 10,
  },
  assets: {
    'asset-studio-anchor': {
      src: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1920&q=80',
      type: 'image',
    },
    'asset-satellite-feed': {
      src: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
      type: 'image',
    },
    'asset-news-intro': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_shut_down.ogg',
      type: 'audio',
    },
    'asset-news-bed': {
      src: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
      type: 'audio',
    },
  },
  tracks: [
    // Video Track V1: Main Broadcast Feeds
    {
      id: 'track-v1',
      name: 'V1 - Main Camera',
      type: 'video',
      volume: 1.0,
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-anchor-intro',
          trackId: 'track-v1',
          name: 'Main Anchor Desk',
          type: 'image',
          assetId: 'asset-studio-anchor',
          timing: {
            start: 0,
            duration: 150,
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 1.05,
                contrast: 1.15,
                saturation: 1.1,
                temperature: 0.05,
                lut: 'neutral',
              },
            },
          ],
        },
        {
          id: 'seq-satellite-broll',
          trackId: 'track-v1',
          name: 'Orbital Telemetry Feed',
          type: 'image',
          assetId: 'asset-satellite-feed',
          timing: {
            after: 'seq-anchor-intro',
            duration: 150,
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 0.95,
                contrast: 1.25,
                saturation: 0.85,
                temperature: -0.2,
                lut: 'teal_orange',
              },
            },
          ],
        },
      ],
    },

    // Video Track V2: Procedural Broadcast Overlays (Lower-Third & Countdown)
    {
      id: 'track-v2',
      name: 'V2 - Broadcast Graphics',
      type: 'video',
      volume: 1.0,
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-lower-third',
          trackId: 'track-v2',
          name: 'Cyber Lower-Third',
          type: 'overlay',
          timing: {
            start: 15,
            duration: 120,
          },
          modifiers: [
            {
              type: 'time_space/cyber_lower_third',
              target: ['video', 'overlay'],
              params: {
                boundary: 'loop',
                seed: 2026,
                text: 'ELENA VANCE // CHIEF ASTRONOMER',
                subtitle: 'NEO ORBITAL OBSERVATORY // DEPT 4',
                targetX: 0.0,
                targetY: 0.65,
                theme: 'emerald_matrix',
                speedMultiplier: 1.0,
                scale: 1.0,
                strokeWidth: 2.0,
              },
            },
          ],
        },
        {
          id: 'seq-countdown-overlay',
          trackId: 'track-v2',
          name: 'Orbital Insertion Countdown',
          type: 'overlay',
          timing: {
            start: 150,
            duration: 150,
          },
          modifiers: [
            {
              type: 'time_space/countdown',
              target: ['video', 'overlay'],
              params: {
                boundary: 'once',
                seed: 777,
                targetX: 0.0,
                targetY: 0.0,
                theme: 'solar_flare',
                speedMultiplier: 1.0,
                scale: 1.2,
                strokeWidth: 2.5,
              },
            },
          ],
        },
      ],
    },

    // Audio Track A1: Broadcast News Bed & SFX
    {
      id: 'track-a1',
      name: 'A1 - Studio Audio Bed',
      type: 'audio',
      volume: 0.75,
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-news-intro-sfx',
          trackId: 'track-a1',
          name: 'News Stinger SFX',
          type: 'audio',
          assetId: 'asset-news-intro',
          timing: {
            start: 0,
            duration: 60,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.9,
              },
            },
          ],
        },
        {
          id: 'seq-news-bed-loop',
          trackId: 'track-a1',
          name: 'News Ambient Bed',
          type: 'audio',
          assetId: 'asset-news-bed',
          timing: {
            start: 0,
            duration: 300,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.4,
              },
            },
          ],
        },
      ],
    },

    // Subtitles Track: Breaking News Ticker
    {
      id: 'track-sub1',
      name: 'TXT - News Ticker',
      type: 'timed_text',
      volume: 1.0,
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-ticker-1',
          trackId: 'track-sub1',
          name: 'Breaking Headline',
          type: 'timed_text',
          timing: {
            start: 0,
            duration: 150,
          },
          cues: [
            {
              id: 'cue-news-1',
              start: 0,
              end: 150,
              text: 'BREAKING: DEEP SPACE TELEMETRY CONFIRMS ANOMALOUS SIGNAL FROM SECTOR 9',
            },
          ],
        },
        {
          id: 'seq-ticker-2',
          trackId: 'track-sub1',
          name: 'Secondary Report',
          type: 'timed_text',
          timing: {
            start: 150,
            duration: 150,
          },
          cues: [
            {
              id: 'cue-news-2',
              start: 150,
              end: 300,
              text: 'COUNTDOWN INITIATED FOR HIGH-ALTITUDE PROBE ORBITAL INSERTION',
            },
          ],
        },
      ],
    },
  ],
};
