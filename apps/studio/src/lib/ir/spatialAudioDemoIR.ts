import type { VideoIRDocument } from '@acc/ir';

/**
 * spatialAudioDemoIR:
 * Spatial Audio & Procedural Sound Design Showcase.
 * Demonstrates:
 * - Procedural SFX audio generators (sfx/procedural_generator: sub_bass, riser, white_noise)
 * - Dynamic stereo spatial panning (audio/pan)
 * - Frequency spectrum filtering (audio/filter: lowpass, highpass)
 * - Procedural pitch modulation (audio/pitch)
 * - Dynamic sidechain ducking between multi-track stems (sfx/dynamic_ducking)
 * - Procedural audio waveform & spectrum canvas overlays (time_space/audio_waveform, time_space/audio_spectrum)
 */
export const spatialAudioDemoIR: VideoIRDocument = {
  version: '1.0.0-stable',
  meta: {
    contentId: 'demo-spatial-audio-sfx-v1',
    globalFps: 30,
    canvasSize: {
      w: 1920,
      h: 1080,
    },
    colorSpace: 'srgb',
    nextSequenceIndex: 12,
  },
  assets: {
    'asset-studio-bg': {
      src: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1920&q=80',
      type: 'image',
    },
    'asset-drone-loop': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/deep_hum.ogg',
      type: 'audio',
    },
    'asset-lead-synth': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/robot_code.ogg',
      type: 'audio',
    },
  },
  tracks: [
    // Video Track V1: Visual Dark Studio Background
    {
      id: 'track-v1-bg',
      name: 'V1 - Studio Acoustic Chamber',
      type: 'video',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-visual-studio',
          name: 'Acoustic Chamber Environment',
          type: 'image',
          assetId: 'asset-studio-bg',
          time: {
            start: 0,
            duration: 360,
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: 'image',
              params: {
                brightness: 0.75,
                contrast: 1.3,
                saturation: 0.6,
                lut: 'cool_steel',
              },
            },
          ],
        },
      ],
    },

    // Video Track V2: Real-Time Audio Visualizer Telemetry
    {
      id: 'track-v2-visualizers',
      name: 'V2 - Procedural Audio Visualizers',
      type: 'video',
      blendMode: 'screen',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-stereo-waveform',
          name: 'Stereo Radial Waveform Ring',
          type: 'overlay',
          time: {
            start: 0,
            duration: 180,
          },
          modifiers: [
            {
              type: 'time_space/audio_waveform',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.0,
                targetY: 0.0,
                density: 64,
                theme: 'cyberpunk',
                speedMultiplier: 1.2,
                scale: 1.15,
                strokeWidth: 2.0,
                boundary: 'loop',
                seed: 404,
              },
            },
          ],
        },
        {
          id: 'seq-frequency-spectrum',
          name: '32-Band Frequency Equalizer',
          type: 'overlay',
          time: {
            start: 180,
            duration: 180,
          },
          modifiers: [
            {
              type: 'time_space/audio_spectrum',
              target: ['video', 'overlay'],
              params: {
                targetX: 0.0,
                targetY: 0.35,
                density: 48,
                theme: 'solar_flare',
                speedMultiplier: 1.5,
                scale: 1.0,
                boundary: 'loop',
                seed: 505,
              },
            },
          ],
        },
      ],
    },

    // Audio Track A1: Sub-Bass Ambient Foundation (Left Panned)
    {
      id: 'track-a1-sub',
      name: 'A1 - Sub-Bass Drone & Filter',
      type: 'audio',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-audio-sub-drone',
          name: '40Hz Sub-Bass Fundamental',
          type: 'audio',
          assetId: 'asset-drone-loop',
          time: {
            start: 0,
            duration: 360,
          },
          modifiers: [
            {
              type: 'audio/filter',
              target: 'audio',
              params: {
                type: 'lowpass',
                frequency: 180,
                q: 1.2,
              },
            },
            {
              type: 'audio/pan',
              target: 'audio',
              params: {
                pan: -0.35, // Panned left
              },
            },
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.9,
              },
            },
          ],
        },
      ],
    },

    // Audio Track A2: Spatial Lead Synth & Dynamic Panning (Right Panned)
    {
      id: 'track-a2-lead',
      name: 'A2 - Spatial Lead Synth & Pitch Bending',
      type: 'audio',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-audio-lead-phrase-1',
          name: 'Synthesizer Arpeggio Stems',
          type: 'audio',
          assetId: 'asset-lead-synth',
          time: {
            start: 30,
            duration: 150,
          },
          modifiers: [
            {
              type: 'audio/pan',
              target: 'audio',
              params: {
                pan: 0.55, // Panned right
              },
            },
            {
              type: 'audio/pitch',
              target: 'audio',
              params: {
                semitones: 3,
                detune: 10,
              },
            },
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.8,
              },
            },
          ],
        },
        {
          id: 'seq-audio-lead-phrase-2',
          name: 'Octave-Shifted Synth Solo',
          type: 'audio',
          assetId: 'asset-lead-synth',
          time: {
            start: 200,
            duration: 150,
          },
          modifiers: [
            {
              type: 'audio/pan',
              target: 'audio',
              params: {
                pan: -0.5, // Panned left on response
              },
            },
            {
              type: 'audio/pitch',
              target: 'audio',
              params: {
                semitones: -2,
                detune: -5,
              },
            },
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

    // Audio Track A3: Sidechain Ducked Ambient Reverb Tail
    {
      id: 'track-a3-ambient',
      name: 'A3 - Reverb Tail & Sidechain Ducking',
      type: 'audio',
      muted: false,
      visible: true,
      sequences: [
        {
          id: 'seq-reverb-wash',
          name: 'Acoustic Reverb Stem',
          type: 'audio',
          assetId: 'asset-drone-loop',
          time: {
            start: 0,
            duration: 360,
          },
          modifiers: [
            {
              type: 'sfx/dynamic_ducking',
              target: 'audio',
              params: {
                sourceTrackId: 'track-a2-lead',
                thresholdDb: -20,
                duckingDb: -12,
                attackMs: 15,
                releaseMs: 300,
              },
            },
            {
              type: 'audio/filter',
              target: 'audio',
              params: {
                type: 'highpass',
                frequency: 400,
                q: 0.707,
              },
            },
          ],
        },
      ],
    },

    // Timed Text Track: Spatial Audio Parameter Readout
    {
      id: 'track-subtitles-dsp',
      name: 'T1 - DSP Parameter Telemetry',
      type: 'timed_text',
      muted: false,
      visible: true,
      modifiers: [
        {
          type: 'timed_text/style',
          target: 'timed_text',
          params: {
            fontSize: 22,
            fontFamily: 'monospace',
            textColor: '#39ff14',
            backgroundColor: 'rgba(10, 20, 10, 0.8)',
            position: 'bottom',
          },
        },
      ],
      sequences: [
        {
          id: 'seq-sub-dsp-1',
          name: 'DSP Cue: Sub 40Hz',
          type: 'text',
          time: {
            start: 10,
            duration: 120,
          },
          text: 'STEREO DSP: SUB-BASS LOWPASS 180Hz (-0.35 PAN) ACTIVE',
        },
        {
          id: 'seq-sub-dsp-2',
          name: 'DSP Cue: Sidechain Active',
          type: 'text',
          time: {
            start: 180,
            duration: 150,
          },
          text: 'DYNAMIC DUCKING: REVERB BUS DUCKED BY -12dB DURING LEAD SYNTH',
        },
      ],
    },
  ],
};
