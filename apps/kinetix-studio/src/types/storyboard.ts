// ============================================================================
// KINETIX STUDIO v6.0 - STORYBOARD & MULTI-SCENE SEQUENCE TYPES (ECMA-429)
// Contracts for multi-act narrative sequencing, scene transitions, and batch rendering.
// ============================================================================

import type { StudioState } from './studio';
import type { EasingId } from './motion';

export type TransitionType =
  | 'cut'
  | 'cross-dissolve'
  | 'whip-pan'
  | 'glitch-dissolve'
  | 'matte-wipe'
  | 'cross-zoom'
  | 'spin-orbit-dissolve'
  | 'dolly-punch-through';

export type TransitionDirection = 'left' | 'right' | 'up' | 'down';

export type CinematicShotType =
  | 'turntable-orbit'
  | 'heroic-low-angle'
  | 'bird-eye-high'
  | 'dutch-tilt-dynamic'
  | 'macro-close-up'
  | 'cinematic-dolly-zoom'
  | 'custom';

export interface Scene3DChoreography {
  readonly enabled?: boolean;
  readonly meshKey?: string; // 'custom-glb' | '3d-torus-knot' | '3d-icosahedron' | '3d-monolith3d'
  readonly shotType?: CinematicShotType;
  readonly cameraElevationDeg?: number; // pitch [-85, 85]
  readonly cameraAzimuthDeg?: number;   // yaw [0, 360]
  readonly cameraRollDeg?: number;      // roll [-45, 45]
  readonly cameraZoom?: number;         // scale [0.3, 3.0]
  readonly rotationSpeed?: number;      // tempo multiplier [0.0, 5.0]
  readonly lightAzimuthDeg?: number;    // directional light azimuth [0, 360]
  readonly wireframe?: boolean;
  readonly shadingMode?: 'flat-shaded' | 'wireframe-only' | 'duotone-shaded' | 'silhouette';
}

export interface SceneTransition {
  readonly type: TransitionType;
  readonly durationSec: number;
  readonly easing: EasingId;
  readonly direction?: TransitionDirection;
}

export interface StoryboardScene {
  readonly id: string;
  readonly title: string;
  readonly durationSec: number;
  readonly archetypeId?: string;
  readonly statePatch: Partial<StudioState>;
  readonly transitionOut?: SceneTransition;
  readonly audioTrackKey?: string;
  readonly choreo3d?: Scene3DChoreography;
}

export interface StoryboardTimeResolution {
  readonly currentScene: StoryboardScene;
  readonly nextScene: StoryboardScene | null;
  readonly sceneIndex: number;
  readonly localTimeSec: number;
  readonly localProgress: number; // [0, 1]
  readonly transitionProgress: number | null; // null if not in transition, [0, 1] if transitioning
  readonly transition: SceneTransition | null;
}

export interface StoryboardSequenceSpec {
  readonly id: string;
  readonly title: string;
  readonly scenes: readonly StoryboardScene[];
  readonly masterBpm: number;
  readonly audioTrackKey?: string;
}
