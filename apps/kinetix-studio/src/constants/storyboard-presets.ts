// ============================================================================
// KINETIX STUDIO v6.0 - CURATED STORYBOARD PRESETS
// Multi-act cinematic narrative templates connecting brand archetypes with transitions.
// ============================================================================

import type { StoryboardSequenceSpec } from '@/types/storyboard';

export const DEFAULT_STORYBOARD_PRESET: StoryboardSequenceSpec = {
  id: 'narrative-manifesto-triad',
  title: 'Three-Act Brand Manifesto',
  masterBpm: 110,
  audioTrackKey: 'lofi-rhodes-downtempo',
  scenes: [
    {
      id: 'scene-intro-swiss',
      title: 'Act I: The Monolith',
      durationSec: 4.0,
      archetypeId: 'swiss-international',
      statePatch: {
        bpm: 110,
        content: {
          headline: ['PURE', 'ORDER', 'DESIGN'],
          subhead: 'PROLOGUE // THE GEOMETRIC CANVAS',
          date: 'ACT 01 // 00:00:00',
          location: 'BASEL ARCHIVE // CH-4051',
          tag: 'CANONICAL',
          sponsor: 'KINETIX STUDIO v6.0',
        },
      },
      transitionOut: {
        type: 'whip-pan',
        durationSec: 0.8,
        easing: 'expo-out',
        direction: 'right',
      },
    },
    {
      id: 'scene-build-bauhaus',
      title: 'Act II: Constructivist Velocity',
      durationSec: 5.0,
      archetypeId: 'bauhaus-constructivism',
      statePatch: {
        bpm: 112,
        content: {
          headline: ['FORM', 'FOLLOWS', 'MOTION'],
          subhead: 'DEVELOPMENT // ASYMMETRIC TENSION',
          date: 'ACT 02 // 00:00:04',
          location: 'DESSAU WERKSTATT // D-06846',
          tag: 'RADICAL',
          sponsor: 'HERBERT BAYER ARCHIVE',
        },
      },
      transitionOut: {
        type: 'glitch-dissolve',
        durationSec: 0.75,
        easing: 'steps-8',
      },
    },
    {
      id: 'scene-drop-brutalist-club',
      title: 'Act III: Kinetic Catharsis',
      durationSec: 5.0,
      archetypeId: 'brutalist-club',
      statePatch: {
        bpm: 130,
        content: {
          headline: ['KINETIC', 'ENERGY', 'NOW'],
          subhead: 'CLIMAX // SOUND PRESSURE & LIGHT',
          date: 'ACT 03 // 00:00:09',
          location: 'KRAFTWERK BERLIN // D-10179',
          tag: 'REBEL',
          sponsor: 'CLUB KINETIC UNDERGROUND',
        },
      },
      transitionOut: {
        type: 'cross-dissolve',
        durationSec: 1.0,
        easing: 'linear-sine',
      },
    },
  ],
};

export const CINEMA_TRAILER_STORYBOARD_PRESET: StoryboardSequenceSpec = {
  id: 'cinema-auteur-trailer',
  title: 'Auteur Theatrical Teaser',
  masterBpm: 72,
  audioTrackKey: 'cinematic-cello-drone',
  scenes: [
    {
      id: 'scene-cinema-slate',
      title: 'Opening Slate',
      durationSec: 3.5,
      archetypeId: 'a24-cinematheque',
      statePatch: {
        bpm: 60,
        content: {
          headline: ['LIGHT', 'THROUGH', 'LENS'],
          subhead: 'A FILM BY KINETIX CINEMATHEQUE',
          date: 'SCENE 01 // EXT. NIGHT',
          location: 'NEW YORK // 35MM TRANSFER',
          tag: 'ANAMORPHIC',
          sponsor: 'AUTEUR FILM SOCIETY',
        },
      },
      transitionOut: {
        type: 'matte-wipe',
        durationSec: 0.6,
        easing: 'velvet-cubic',
        direction: 'up',
      },
    },
    {
      id: 'scene-cinema-vertigo',
      title: 'The Spiral',
      durationSec: 4.5,
      archetypeId: 'saul-bass-vertigo',
      statePatch: {
        bpm: 92,
        content: {
          headline: ['VERTIGO', 'PSYCHE', 'FALL'],
          subhead: 'TITLE SEQUENCE // SAUL BASS TRIBUTE',
          date: 'SCENE 02 // ROTATING PLINTH',
          location: 'PARAMOUNT STAGE 5 // HOLLYWOOD',
          tag: 'PSYCHOLOGICAL',
          sponsor: 'ACADEMY ARCHIVE',
        },
      },
      transitionOut: {
        type: 'cross-zoom',
        durationSec: 0.8,
        easing: 'expo-out',
      },
    },
    {
      id: 'scene-cinema-zen',
      title: 'Ethereal Stillness',
      durationSec: 4.0,
      archetypeId: 'wabi-sabi-zen',
      statePatch: {
        bpm: 60,
        content: {
          headline: ['VOID', 'MIND', 'BREATH'],
          subhead: 'MEDITATION // NEGATIVE SPACE',
          date: 'SCENE 03 // KYOTO DAITO-KU',
          location: 'RYOAN-JI TEMPLE // GARDEN',
          tag: 'WABI-SABI',
          sponsor: 'ZEN HERITAGE',
        },
      },
      transitionOut: {
        type: 'cross-dissolve',
        durationSec: 1.0,
        easing: 'linear-sine',
      },
    },
  ],
};

export const CINEMATIC_3D_HERO_SHOWCASE_PRESET: StoryboardSequenceSpec = {
  id: 'cinematic-3d-hero-showcase',
  title: '3D Cinematic Hero Showcase',
  masterBpm: 124,
  audioTrackKey: 'lofi-rhodes-downtempo',
  scenes: [
    {
      id: 'scene-3d-reveal',
      title: 'Act I: The Reveal (Low Angle)',
      durationSec: 4.0,
      archetypeId: 'swiss-international',
      choreo3d: {
        enabled: true,
        meshKey: '3d-torus-knot',
        shotType: 'heroic-low-angle',
        cameraElevationDeg: 25,
        cameraAzimuthDeg: -10,
        cameraZoom: 1.15,
        rotationSpeed: 0.8,
        lightAzimuthDeg: 45,
        wireframe: true,
      },
      statePatch: {
        heroId: 'custom-glb',
        bpm: 124,
        content: {
          headline: ['GEOMETRIC', 'HERO', 'MANIFESTO'],
          subhead: 'PROLOGUE // MONUMENTAL GROUNDING',
          date: 'ACT 01 // 00:00:00',
          location: 'STAGE 3D // PERSPECTIVE MATRIX',
          tag: '3D CINEMA',
          sponsor: 'KINETIX STUDIO v6.0',
        },
      },
      transitionOut: {
        type: 'dolly-punch-through',
        durationSec: 0.9,
        easing: 'expo-out',
      },
    },
    {
      id: 'scene-3d-kinetic',
      title: 'Act II: Kinetic Cant (Dutch Tilt)',
      durationSec: 4.5,
      archetypeId: 'brutalist-club',
      choreo3d: {
        enabled: true,
        meshKey: 'custom-glb',
        shotType: 'dutch-tilt-dynamic',
        cameraRollDeg: 18,
        cameraZoom: 1.35,
        rotationSpeed: 1.4,
        lightAzimuthDeg: 135,
        wireframe: true,
      },
      statePatch: {
        heroId: 'custom-glb',
        bpm: 128,
        content: {
          headline: ['HIGH', 'VELOCITY', 'IMPACT'],
          subhead: 'DEVELOPMENT // ANGULAR TENSION',
          date: 'ACT 02 // 00:00:04',
          location: 'KINETIC LAB // RUNTIME CLUSTER',
          tag: 'HIGH-SPEED',
          sponsor: 'CYBER ARCHIVE',
        },
      },
      transitionOut: {
        type: 'spin-orbit-dissolve',
        durationSec: 0.85,
        easing: 'expo-out',
      },
    },
    {
      id: 'scene-3d-overlook',
      title: 'Act III: Cosmic Overlook (Bird Eye)',
      durationSec: 4.5,
      archetypeId: 'acid-rave-poster',
      choreo3d: {
        enabled: true,
        meshKey: '3d-icosahedron',
        shotType: 'bird-eye-high',
        cameraElevationDeg: -45,
        cameraZoom: 1.1,
        rotationSpeed: 0.7,
        lightAzimuthDeg: 270,
        wireframe: true,
      },
      statePatch: {
        heroId: 'custom-glb',
        bpm: 132,
        content: {
          headline: ['CELESTIAL', 'ORDER', 'HORIZON'],
          subhead: 'CLIMAX // TOPOLOGICAL SYNTHESIS',
          date: 'ACT 03 // 00:00:09',
          location: 'ORBITAL NODE // CH-4051',
          tag: 'SYNTHESIS',
          sponsor: 'KINETIX ASTRONOMY',
        },
      },
      transitionOut: {
        type: 'cross-dissolve',
        durationSec: 1.0,
        easing: 'linear-sine',
      },
    },
  ],
};

export const STORYBOARD_PRESETS: StoryboardSequenceSpec[] = [
  DEFAULT_STORYBOARD_PRESET,
  CINEMATIC_3D_HERO_SHOWCASE_PRESET,
  CINEMA_TRAILER_STORYBOARD_PRESET,
];
