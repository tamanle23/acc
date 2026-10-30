import type { VideoIRDocument } from '@acc/ir';

/**
 * complexSciFiDemoIR:
 * Comprehensive, production-grade 12-track Sci-Fi Cyberpunk Epic VideoIR Document.
 *
 * Demonstrates:
 * - 6 Video & Visual Tracks:
 *   - V1: Cyberpunk Master Plates (Multi-shot establishing, core reveal, skyline finale with color grading & crossfade transitions)
 *   - V2: 3D Depth Hologram & Parallax (Pop-out frame breaker, silhouette rim lighting, floating organic motion)
 *   - V3: Volumetric Atmospheric VFX (Multi-layer matrix rain, neon embers, cyberspace warp speed lines)
 *   - V4: Cybernetic HUD Telemetry (Full tactical targeting reticle, scanlines, digital glitch data)
 *   - V5: High-Energy Localized VFX (Spotlight beams, chromatic slice glitch bursts, point particle emitters)
 *   - V6: Dynamic Motion Overlays & Lower-Third Callouts (Drift & overshoot kinetic transforms)
 * - 4 Audio Tracks:
 *   - A1: Pilot Dialogue Voiceover (Dynamic ducking, stereophonic presence, parametric filtering)
 *   - A2: Tactical AI Dispatch (L/R stereo panning, highpass radio intercom EQ)
 *   - A3: Kinetic Impact & Procedural SFX (Laser pulses, sub-bass riser transients, volume envelopes)
 *   - A4: Cyberpunk Synthwave BGM (Multi-movement ambient drone into driving synth score with fade curves)
 * - 2 Timed Text Tracks:
 *   - Subtitles: Dialog cues with kinetic typography, active-word glowing states, SafeZone compliance
 *   - HUD Telemetry Callouts: Real-time tactical diagnostics, mission telemetry coordinates, breach warnings
 *
 * Modifiers Demonstrated:
 * - vfx/color_grading, vfx/depth3d, overlay/canvas_particles, overlay/hologram_hud, vfx/partial
 * - transform, transition/crossfade, editorial/split_edit, timed_text/style
 * - sfx/dynamic_ducking, audio/volume, audio/pan, audio/filter, sfx/procedural
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
    nextSequenceIndex: 25,
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
      src: 'https://media.gettyimages.com/id/1340037487/video/the-matrix-reloaded-cast-interviews.mp4?s=mp4-640x640-gi&k=20&c=QmuoEVN4gNDv1DFmosfSTKNY5_OgW0MB29aWUAQw1nM=',
      type: 'video',
    },
    'asset-orbital-skyline': {
      src: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&q=80',
      type: 'image',
    },
    'asset-cyber-drone': {
      src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
      type: 'image',
    },
    'asset-voice-pilot': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/ringing_ambient_background.ogg',
      type: 'audio',
    },
    'asset-ai-dispatch': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/robot_code.ogg',
      type: 'audio',
    },
    'asset-laser-impact': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/windchime_drone.ogg',
      type: 'audio',
    },
    'asset-sub-bass-drop': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/deep_hum.ogg',
      type: 'audio',
    },
    'asset-synth-bgm': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/electric_ring_long.ogg',
      type: 'audio',
    },
    'asset-holo-globe': {
      src: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1920&q=80',
      type: 'video',
    },
    'asset-film-burn': {
      src: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&q=80',
      type: 'video',
    },
    'asset-synth-grid': {
      src: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&q=80',
      type: 'video',
    },
    'asset-lightning': {
      src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
      type: 'video',
    },
    'asset-ocean-caustics': {
      src: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1920&q=80',
      type: 'video',
    },
    'asset-bgm-synthwave': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/electric_ring_long.ogg',
      type: 'audio',
    },
    'asset-bgm-tension': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/deep_hum.ogg',
      type: 'audio',
    },
    'asset-bgm-sunset': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/ringing_ambient_background.ogg',
      type: 'audio',
    },
    'asset-bgm-ambient': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/windchime_drone.ogg',
      type: 'audio',
    },
    'asset-bgm-drumstep': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/robot_code.ogg',
      type: 'audio',
    },
    'asset-bgm-acoustic': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/ringing_ambient_background.ogg',
      type: 'audio',
    },
    'asset-bgm-retro': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/electric_ring_long.ogg',
      type: 'audio',
    },
    'asset-bgm-action': {
      src: 'https://actions.google.com/sounds/v1/science_fiction/deep_hum.ogg',
      type: 'audio',
    },
  },
  tracks: [
    // =========================================================================
    // VIDEO TRACKS (V1 to V6)
    // =========================================================================
    {
      id: 'track-v1',
      type: 'video',
      name: 'V1: Cyberpunk Plate',
      sequences: [
        {
          id: 'seq-city-intro',
          name: 'Establishing: Cyberpunk Metropolis',
          type: 'image',
          assetId: 'asset-cyber-city',
          time: {
            start: 0,
            duration: 120, // 4.0s @ 30fps
          },
          modifiers: [
            {
              type: 'vfx/color_grading',
              target: ['video', 'image', 'overlay'],
              params: {
                contrast: 1.25,
                saturation: 1.4,
                exposure: 0.1,
                temperature: -15,
                vignette: 0.35,
              },
            },
            {
              type: 'transform',
              target: ['video', 'image'],
              params: {
                scale: 1.05,
                animation: {
                  preset: 'drift',
                  intro: { durationSec: 0.8, ease: 'power2.out' },
                  steady: { type: 'drift' },
                },
              },
            },
          ],
        },
        {
          id: 'seq-core-reveal',
          name: 'Reveal: Matrix Core',
          type: 'video',
          assetId: 'asset-matrix-core',
          time: {
            start: {
              after: 'seq-city-intro',
              offsetFrames: -15, // 15-frame crossfade overlap
            },
            duration: 150, // 5.0s @ 30fps
          },
          modifiers: [
            {
              type: 'transition/crossfade',
              target: ['video', 'image'],
              params: {
                durationFrames: 15,
                overlapTarget: 'seq-city-intro',
              },
            },
            {
              type: 'vfx/color_grading',
              target: ['video', 'image', 'overlay'],
              params: {
                contrast: 1.2,
                saturation: 1.25,
                exposure: -0.05,
                tint: 10,
              },
            },
          ],
        },
        {
          id: 'seq-skyline-climax',
          name: 'Climax: Orbital Skyline',
          type: 'image',
          assetId: 'asset-orbital-skyline',
          time: {
            start: {
              after: 'seq-core-reveal',
              offsetFrames: -10, // 10-frame transition overlap
            },
            duration: 150, // 5.0s @ 30fps
          },
          modifiers: [
            {
              type: 'transition/crossfade',
              target: ['video', 'image'],
              params: {
                durationFrames: 10,
                overlapTarget: 'seq-core-reveal',
              },
            },
            {
              type: 'vfx/color_grading',
              target: ['video', 'image', 'overlay'],
              params: {
                contrast: 1.3,
                saturation: 1.45,
                exposure: 0.15,
                vignette: 0.45,
              },
            },
            {
              type: 'transform',
              target: ['video', 'image'],
              params: {
                scale: 1.1,
                animation: {
                  preset: 'overshoot',
                  intro: { durationSec: 0.6, ease: 'back.out' },
                  steady: { type: 'hold' },
                },
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
          name: 'Hologram: Neon Warrior',
          type: 'image',
          assetId: 'asset-neon-warrior',
          time: {
            start: 30,
            duration: 180, // 6.0s (frames 30..210)
          },
          modifiers: [
            {
              type: 'vfx/depth3d',
              target: ['video', 'image'],
              params: {
                mode: 'frame_breaker',
                popOutIntensity: 1.35,
                floatMotion: true,
                shadow: true,
                backdropBlur: 8,
              },
            },
            {
              type: 'transform',
              target: ['video', 'image'],
              params: {
                normX: 0.05,
                normY: -0.02,
                animation: {
                  preset: 'pop_in',
                  intro: { durationSec: 0.5, ease: 'elastic.out' },
                  steady: { type: 'drift' },
                },
              },
            },
          ],
        },
        {
          id: 'seq-holo-drone',
          name: 'Hologram: Cyber Drone',
          type: 'image',
          assetId: 'asset-cyber-drone',
          time: {
            start: {
              after: 'seq-holo-subject',
              offsetFrames: 15,
            },
            duration: 160, // 5.33s
          },
          modifiers: [
            {
              type: 'vfx/depth3d',
              target: ['video', 'image'],
              params: {
                mode: 'parallax_25d',
                popOutIntensity: 1.5,
                floatMotion: true,
                shadow: true,
              },
            },
            {
              type: 'transform',
              target: ['video', 'image'],
              params: {
                normX: -0.15,
                normY: 0.05,
                scale: 0.85,
                animation: {
                  preset: 'drift',
                  intro: { durationSec: 0.7, ease: 'power2.out' },
                  steady: { type: 'drift' },
                },
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
          name: 'VFX: Matrix Digital Rain',
          type: 'overlay',
          time: {
            start: 0,
            duration: 200,
          },
          modifiers: [
            {
              type: 'overlay/canvas_particles',
              target: ['video', 'overlay'],
              params: {
                type: 'matrix_rain',
                intensity: 1.25,
                speed: 1.1,
                opacity: 0.55,
              },
            },
          ],
        },
        {
          id: 'seq-neon-embers',
          name: 'VFX: Neon Embers',
          type: 'overlay',
          time: {
            start: {
              after: 'seq-matrix-rain',
              offsetFrames: -20, // Seamless crossfade blend
            },
            duration: 120,
          },
          modifiers: [
            {
              type: 'overlay/canvas_particles',
              target: ['video', 'overlay'],
              params: {
                type: 'embers',
                intensity: 1.4,
                speed: 0.9,
                opacity: 0.65,
              },
            },
          ],
        },
        {
          id: 'seq-warp-speed',
          name: 'VFX: Warp Speed Lines',
          type: 'overlay',
          time: {
            start: {
              after: 'seq-neon-embers',
              offsetFrames: -10,
            },
            duration: 110,
          },
          modifiers: [
            {
              type: 'overlay/canvas_particles',
              target: ['video', 'overlay'],
              params: {
                type: 'speed_lines',
                intensity: 1.7,
                speed: 2.0,
                opacity: 0.7,
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
          name: 'HUD: Tactical Targeting',
          type: 'overlay',
          time: {
            start: 45,
            duration: 180,
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
            {
              type: 'overlay/hologram_hud',
              target: ['video', 'overlay'],
              params: {
                color: '#00ffff',
                ringRadius: 0.35,
                scanlineDensity: 48,
                rotationSpeed: 0.75,
                glitchIntensity: 0.15,
              },
            },
          ],
        },
        {
          id: 'seq-hud-critical-lock',
          name: 'HUD: Critical Lock Warning',
          type: 'overlay',
          time: {
            start: {
              after: 'seq-hud-tactical',
              offsetFrames: 10,
            },
            duration: 150,
          },
          modifiers: [
            {
              type: 'overlay/hologram_hud',
              target: ['video', 'overlay'],
              params: {
                color: '#ff0055',
                ringRadius: 0.42,
                scanlineDensity: 64,
                rotationSpeed: 1.2,
                glitchIntensity: 0.35,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-v5',
      type: 'video',
      name: 'V5: High-Energy Localized VFX',
      blendMode: 'add',
      sequences: [
        {
          id: 'seq-cyber-spotlight',
          name: 'VFX: Cyber Spotlight',
          type: 'overlay',
          time: {
            start: 35,
            duration: 160,
          },
          modifiers: [
            {
              type: 'vfx/partial',
              target: ['video', 'overlay'],
              params: {
                regions: [
                  {
                    type: 'spotlight',
                    x: 0.5,
                    y: 0.35,
                    radius: 220,
                    intensity: 1.6,
                    color: '#00ffff',
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'seq-chromatic-burst',
          name: 'VFX: Chromatic Glitch Burst',
          type: 'overlay',
          time: {
            start: 220,
            duration: 90,
          },
          modifiers: [
            {
              type: 'vfx/partial',
              target: ['video', 'overlay'],
              params: {
                regions: [
                  {
                    type: 'glitch',
                    x: 0.5,
                    y: 0.5,
                    width: 0.8,
                    height: 0.4,
                    intensity: 2.2,
                    color: '#ff0077',
                  },
                  {
                    type: 'point_emitter',
                    x: 0.65,
                    y: 0.45,
                    radius: 120,
                    intensity: 1.8,
                    color: '#00ffcc',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-v6',
      type: 'video',
      name: 'V6: Motion Graphics & Lower-Third',
      blendMode: 'normal',
      sequences: [
        {
          id: 'seq-lower-third-callout',
          name: 'Motion Graphic: Cyber Lower Third',
          type: 'overlay',
          time: {
            start: 60,
            duration: 120,
          },
          modifiers: [
            {
              type: 'transform',
              target: ['video', 'overlay'],
              params: {
                x: 0,
                y: 120,
                opacity: 0.92,
                animation: {
                  preset: 'slide_left',
                  intro: { durationSec: 0.4, ease: 'power3.out' },
                  steady: { type: 'hold' },
                  outro: { durationSec: 0.3, ease: 'power2.in' },
                },
              },
            },
            {
              type: 'time_space/callout_leader',
              target: ['video', 'overlay'],
              params: {
                boundary: 'loop',
                seed: 42,
                text: 'SECTOR 7-G LOCK',
                targetX: -0.15,
                targetY: 0.1,
                labelX: 0.25,
                labelY: -0.2,
              },
            },
          ],
        },
      ],
    },

    // =========================================================================
    // AUDIO TRACKS (A1 to A4)
    // =========================================================================
    {
      id: 'track-a1',
      type: 'audio',
      name: 'A1: Pilot Dialogue',
      sequences: [
        {
          id: 'seq-pilot-comm',
          name: 'Dialogue: Pilot Intro Comm',
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
                targetBus: 'track-a4',
              },
            },
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 1.1,
                fadeInSec: 0.15,
                fadeOutSec: 0.2,
              },
            },
            {
              type: 'audio/pan',
              target: 'audio',
              params: {
                stereoPan: -0.15,
              },
            },
          ],
        },
        {
          id: 'seq-pilot-climax',
          name: 'Dialogue: Pilot Climax Call',
          type: 'audio',
          assetId: 'asset-voice-pilot',
          time: {
            start: {
              after: 'seq-pilot-comm',
              offsetFrames: 40,
            },
            duration: 120,
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 1.25,
                fadeInSec: 0.1,
                fadeOutSec: 0.25,
              },
            },
            {
              type: 'audio/pan',
              target: 'audio',
              params: {
                stereoPan: 0.1,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-a2',
      type: 'audio',
      name: 'A2: Tactical AI Dispatch',
      sequences: [
        {
          id: 'seq-ai-dispatch-comm',
          name: 'Comms: AI Dispatch Protocol',
          type: 'audio',
          assetId: 'asset-ai-dispatch',
          time: {
            start: 75,
            duration: 90,
          },
          modifiers: [
            {
              type: 'audio/pan',
              target: 'audio',
              params: {
                stereoPan: 0.45, // Tactical offset right
              },
            },
            {
              type: 'audio/filter',
              target: 'audio',
              params: {
                filterType: 'bandpass',
                cutoffHz: 1800,
                q: 1.8, // Walkie/radio bandpass intercom
              },
            },
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.9,
                fadeInSec: 0.05,
                fadeOutSec: 0.15,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-a3',
      type: 'audio',
      name: 'A3: Impact SFX',
      sequences: [
        {
          id: 'seq-laser-hit',
          name: 'SFX: Laser Impact Burst',
          type: 'audio',
          assetId: 'asset-laser-impact',
          time: {
            start: 90,
            duration: 60,
          },
          modifiers: [
            {
              type: 'audio/pan',
              target: 'audio',
              params: {
                stereoPan: -0.2,
              },
            },
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 1.3,
                fadeOutSec: 0.5,
              },
            },
          ],
        },
        {
          id: 'seq-sub-drop',
          name: 'SFX: Sub-Bass Drop & Riser',
          type: 'audio',
          assetId: 'asset-sub-bass-drop',
          time: {
            start: 215,
            duration: 90,
          },
          modifiers: [
            {
              type: 'audio/filter',
              target: 'audio',
              params: {
                filterType: 'lowpass',
                cutoffHz: 280,
                q: 1.2,
              },
            },
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 1.4,
                fadeInSec: 0.05,
                fadeOutSec: 0.8,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'track-a4',
      type: 'audio',
      name: 'A4: Synthwave BGM',
      sequences: [
        {
          id: 'seq-synth-score',
          name: 'Score: Synthwave Cyberpunk BGM',
          type: 'audio',
          assetId: 'asset-synth-bgm',
          time: {
            start: 0,
            duration: {
              matchLengthOf: 'seq-skyline-climax',
              paddingFrames: 30,
            },
          },
          modifiers: [
            {
              type: 'audio/volume',
              target: 'audio',
              params: {
                volume: 0.85,
                fadeInSec: 1.5,
                fadeOutSec: 2.0,
                fadeCurve: 'cosine',
              },
            },
          ],
        },
      ],
    },

    // =========================================================================
    // TIMED TEXT & SUBTITLE TRACKS (2 Tracks)
    // =========================================================================
    {
      id: 'track-subtitles',
      type: 'timed_text',
      name: 'Subtitles',
      style: {
        fontSize: 38,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
      },
      sequences: [
        {
          id: 'seq-dialogue-1',
          name: 'Dialogue Subtitle 1',
          type: 'text',
          time: {
            start: 20,
            duration: 70,
          },
          modifiers: [
            {
              type: 'timed_text/style',
              target: 'text',
              params: {
                fontSize: 40,
                color: '#ffffff',
                textAlign: 'center',
                activeWord: {
                  color: '#00ffff',
                  glowColor: 'rgba(0, 255, 255, 0.8)',
                  glowRadius: 16,
                  scale: 1.08,
                },
              },
            },
          ],
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
          name: 'Dialogue Subtitle 2',
          type: 'text',
          time: {
            start: 95,
            duration: 75,
          },
          modifiers: [
            {
              type: 'timed_text/style',
              target: 'text',
              params: {
                fontSize: 40,
                color: '#ffffff',
                textAlign: 'center',
                activeWord: {
                  color: '#00ffff',
                  glowColor: 'rgba(0, 255, 255, 0.8)',
                  glowRadius: 16,
                },
              },
            },
          ],
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 2500,
              text: 'Visual Storytelling Generator core online.',
            },
          ],
        },
        {
          id: 'seq-dialogue-3',
          name: 'Dialogue Subtitle 3',
          type: 'text',
          time: {
            start: 210,
            duration: 110,
          },
          modifiers: [
            {
              type: 'timed_text/style',
              target: 'text',
              params: {
                fontSize: 44,
                color: '#ff3366',
                textAlign: 'center',
                activeWord: {
                  color: '#ffff00',
                  glowColor: 'rgba(255, 51, 102, 0.9)',
                  glowRadius: 20,
                  scale: 1.12,
                },
              },
            },
          ],
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 3500,
              text: 'Orbital skyline reached. Quantum hyperdrive synchronization complete.',
            },
          ],
        },
      ],
    },
    {
      id: 'track-hud-data',
      type: 'timed_text',
      name: 'HUD Callouts',
      style: {
        fontSize: 22,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        color: '#00ffff',
      },
      sequences: [
        {
          id: 'seq-hud-callout',
          name: 'HUD Telemetry: Parallax Breach Notice',
          type: 'text',
          time: {
            start: 45,
            duration: 150,
          },
          modifiers: [
            {
              type: 'timed_text/style',
              target: 'text',
              params: {
                fontSize: 24,
                fontFamily: 'monospace',
                color: '#00ffff',
                textAlign: 'left',
              },
            },
          ],
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 5000,
              text: 'TARGET ACQUIRED: PARALLAX 3D BREACH DETECTED',
            },
          ],
        },
        {
          id: 'seq-hud-callout-warning',
          name: 'HUD Telemetry: Sub-Orbital Warning',
          type: 'text',
          time: {
            start: 215,
            duration: 110,
          },
          modifiers: [
            {
              type: 'timed_text/style',
              target: 'text',
              params: {
                fontSize: 24,
                fontFamily: 'monospace',
                color: '#ff0055',
                textAlign: 'right',
              },
            },
          ],
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 3600,
              text: 'STATUS: SUB-ORBITAL TRAJECTORY LOCKED // FLUID ACCELERATION ACTIVE',
            },
          ],
        },
      ],
    },
  ],
};
