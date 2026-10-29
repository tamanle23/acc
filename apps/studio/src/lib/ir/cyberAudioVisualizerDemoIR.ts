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
      volume: 1.0,
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-energy-shield-bg',
          trackId: 'track-v1',
          name: 'Energy Shield Matrix',
          type: 'overlay',
          timing: {
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
      volume: 1.0,
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-waveform-ring',
          trackId: 'track-v2',
          name: 'Radial Waveform Ring',
          type: 'overlay',
          timing: {
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
          trackId: 'track-v2',
          name: 'Equalizer Spectrum Bars',
          type: 'overlay',
          timing: {
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
      volume: 1.0,
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-synth-lead',
          trackId: 'track-a1',
          name: 'Modular Synth Lead',
          type: 'audio',
          assetId: 'asset-synth-loop',
          timing: {
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
      volume: 1.0,
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-audio-hud-text',
          trackId: 'track-sub1',
          name: 'Track Telemetry',
          type: 'timed_text',
          timing: {
            start: 0,
            duration: 300,
          },
          cues: [
            {
              id: 'cue-audio-1',
              start: 0,
              end: 150,
              text: 'AUDIO VISUALIZER // RADIAL FFT // 128 BPM',
            },
            {
              id: 'cue-audio-2',
              start: 150,
              end: 300,
              text: 'AUDIO EQUALIZER // GRAVITATIONAL PEAK HOLD // 48 BANDS',
            },
          ],
        },
      ],
    },
  ],
};
