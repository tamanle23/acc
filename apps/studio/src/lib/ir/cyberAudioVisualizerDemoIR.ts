import type { VideoIRDocument } from '@acc/ir';

/**
 * cyberAudioVisualizerDemoIR:
 * High-energy cyber audio visualizer showcase featuring radial waveform rings,
 * dynamic equalizer spectrum bars, and hex energy shield lattice.
 */
export const cyberAudioVisualizerDemoIR: VideoIRDocument = {
  version: '1.0.0-stable',
  meta: {
    contentId: 'demo-cyber-audio-visualizer-v1',
    globalFps: 30,
    canvasSize: {
      w: 1920,
      h: 1080,
    },
    colorSpace: 'srgb',
    nextSequenceIndex: 8,
  },
  assets: {
    'asset-synth-loop': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/robot_code.ogg',
      type: 'audio',
    },
    'asset-bass-pulse': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_shut_down.ogg',
      type: 'audio',
    },
  },
  tracks: [
    // Video Track V1: Background Energy Shield Grid
    {
      id: 'track-v1',
      name: 'V1 - Hex Grid Ambient',
      type: 'video',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-energy-shield-bg',
          name: 'Energy Shield Matrix',
          type: 'overlay',
          time: {
            start: 0,
            duration: 300,
          },
          modifiers: [
            {
              type: 'time_space/energy_shield',
              target: ['video', 'overlay'],
              params: {
                boundary: 'loop',
                seed: 808,
                targetX: 0.0,
                targetY: 0.0,
                theme: 'synthwave_neon',
                speedMultiplier: 0.8,
                scale: 1.4,
                strokeWidth: 1.2,
              },
            },
          ],
        },
      ],
    },

    // Video Track V2: Procedural Audio Visualizers (Waveform & Spectrum)
    {
      id: 'track-v2',
      name: 'V2 - Procedural Audio Visualizers',
      type: 'video',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-waveform-ring',
          name: 'Radial Waveform Ring',
          type: 'overlay',
          time: {
            start: 0,
            duration: 150,
          },
          modifiers: [
            {
              type: 'time_space/audio_waveform',
              target: ['video', 'overlay'],
              params: {
                boundary: 'loop',
                seed: 101,
                targetX: 0.0,
                targetY: 0.0,
                density: 64,
                theme: 'cyberpunk',
                speedMultiplier: 1.2,
                scale: 1.1,
                strokeWidth: 2.0,
              },
            },
          ],
        },
        {
          id: 'seq-equalizer-spectrum',
          name: 'Equalizer Spectrum Bars',
          type: 'overlay',
          time: {
            start: 150,
            duration: 150,
          },
          modifiers: [
            {
              type: 'time_space/audio_spectrum',
              target: ['video', 'overlay'],
              params: {
                boundary: 'loop',
                seed: 202,
                targetX: 0.0,
                targetY: 0.35,
                density: 48,
                theme: 'solar_flare',
                speedMultiplier: 1.4,
                scale: 1.0,
              },
            },
          ],
        },
      ],
    },

    // Audio Track A1: Synth & Beat
    {
      id: 'track-a1',
      name: 'A1 - Master Synth Track',
      type: 'audio',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-synth-lead',
          name: 'Modular Synth Lead',
          type: 'audio',
          assetId: 'asset-synth-loop',
          time: {
            start: 0,
            duration: 300,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.95,
              },
            },
          ],
        },
      ],
    },

    // Subtitles Track: Track Metadata HUD
    {
      id: 'track-sub1',
      name: 'TXT - Audio HUD',
      type: 'timed_text',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-audio-hud-text',
          name: 'Track Telemetry',
          type: 'text',
          time: {
            start: 0,
            duration: 300,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 5000,
              text: 'AUDIO VISUALIZER // RADIAL FFT // 128 BPM',
            },
            {
              startOffsetMs: 5000,
              endOffsetMs: 10000,
              text: 'AUDIO EQUALIZER // GRAVITATIONAL PEAK HOLD // 48 BANDS',
            },
          ],
        },
      ],
    },
  ],
};
