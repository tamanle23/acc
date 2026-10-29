import type { SequenceType } from './VideoIR';

// ============================================================================
// Core Temporal Curve & Keyframe Models
// ============================================================================

export interface TemporalCurve<T = number> {
  intro?: {
    durationSec: number;
    from: T;
    to?: T;
    ease: string;
  };
  steady?: {
    type: 'hold' | 'drift' | 'pulse';
    intensity?: number;
  };
  outro?: {
    durationSec: number;
    to: T;
    ease: string;
  };
  keyframes?: Array<{
    timeSec: number;
    value: T;
    ease?: string;
  }>;
}

// ============================================================================
// 1. In-Canvas Transform & Motion Modifiers
// ============================================================================

export interface TransformModifierParams {
  x?: number | TemporalCurve<number>;
  y?: number | TemporalCurve<number>;
  scale?: number | TemporalCurve<number>;
  rotation?: number | TemporalCurve<number>;
  opacity?: number | TemporalCurve<number>;
  normX?: number;
  normY?: number;
  anchorPoint?: [number, number];
  target?: 'sequence' | 'track' | 'global';
  ease?: string;
  animation?: {
    preset?: 'pop_in' | 'slide_left' | 'overshoot' | 'bounce' | 'drift';
    intro?: { durationSec: number; ease: string; direction?: string };
    steady?: { type: 'hold' | 'drift' | 'pulse'; intensity?: number };
    outro?: { durationSec: number; ease: string; direction?: string };
  };
}

// ============================================================================
// 2. 3D VFX & Camera Modifiers
// ============================================================================

export interface Camera3DKeyframeIR {
  time: number; // [0, 1]
  position: [number, number, number];
  target?: [number, number, number];
  roll?: number;
  fov?: number;
  focalZ?: number;
  focalAperture?: number;
}

export interface Camera3DModifierParams {
  keyframes?: Camera3DKeyframeIR[];
  rackFocus?: {
    enabled?: boolean;
    focalZone?: 'foreground' | 'midground' | 'background' | 'custom';
    customFocalZ?: number;
    aperture?: number;
    blurMaxRadius?: number;
  };
  imagePath?: string;
  depthImagePath?: string;
  motionBlur?: boolean;
}

export interface DepthRelightingParams {
  enabled: boolean;
  lightPosition?: [number, number, number];
  lightColor?: string | [number, number, number];
  lightX?: number;
  lightY?: number;
  lightZ?: number;
  diffuse?: number;
  specular?: number;
  shininess?: number;
  ambient?: number;
  rimIntensity?: number;
  normalStrength?: number;
}

export interface Depth3DModifierParams {
  mode: string;
  frameStyle?: string;
  popOutIntensity?: number;
  autoSegment?: boolean;
  autoDepth?: boolean;
  relighting?: DepthRelightingParams;
  depthMesh?: { motion?: string; displacementScale?: number };
  sandwich?: unknown;
  parallax?: unknown;
  captions?: unknown[];
  imagePath?: string;
  shadow?: boolean;
  floatMotion?: boolean;
  backdropBlur?: number;
  [key: string]: unknown;
}

export interface ColorGradingModifierParams {
  lut?: string;
  contrast?: number;
  saturation?: number;
  brightness?: number;
  temperature?: number;
  tint?: number;
  vignette?: number;
  exposure?: number;
}

// ============================================================================
// 3. Overlays & Particle VFX Modifiers
// ============================================================================

export interface ParticleShaderParams {
  chromaticAberration?: { enabled?: boolean; offsetPx?: number };
  bloom?: { enabled?: boolean; threshold?: number; intensity?: number };
  anamorphicFlare?: { enabled?: boolean; intensity?: number; tintColor?: string };
}

export interface ParticleVfxModifierParams {
  type: string;
  variant?: string;
  intensity?: number;
  speed?: number;
  opacity?: number;
  particleCount?: number;
  useSIMD?: boolean;
  shaders?: ParticleShaderParams;
}

export interface HologramHudModifierParams {
  enabled?: boolean;
  color?: string;
  glitchIntensity?: number;
  scanlines?: boolean;
  flicker?: boolean;
  opacity?: number;
  bracketScale?: number;
  bracketColor?: string;
  reticleSpeed?: number;
  shaders?: ParticleShaderParams;
}

export interface BlendModeModifierParams {
  mode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'color_dodge' | 'soft_light';
  opacity?: number;
}

// ============================================================================
// 4. Timed Text & Typography Modifiers
// ============================================================================

export interface TextStyleModifierParams {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  color?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  strokeColor?: string;
  strokeWidth?: number;
  activeWord?: {
    color?: string;
    glowColor?: string;
    glowRadius?: number;
    scale?: number;
  };
}

// ============================================================================
// 5. Audio & SFX Modifiers
// ============================================================================

export interface VolumeModifierParams {
  volume?: number; // Linear volume multiplier (0.0 to 2.0, default: 1.0)
  fadeInSec?: number;
  fadeOutSec?: number;
  fadeCurve?: 'linear' | 'cosine' | 'exponential';
  muted?: boolean;
}

export interface PanModifierParams {
  stereoPan: number; // -1.0 to +1.0
}

export interface FilterModifierParams {
  filterType: 'lowpass' | 'highpass' | 'bandpass';
  cutoffHz: number;
  q?: number;
}

export interface PitchModifierParams {
  playbackRate?: number;
  detuneCents?: number;
}

export interface DynamicDuckingModifierParams {
  duckingFactor: number | TemporalCurve<number>;
  attackSec?: number;
  releaseSec?: number;
  attackEase?: string;
  releaseEase?: string;
  threshold?: number;
}

export interface ProceduralSfxModifierParams {
  synthType: 'whoosh' | 'impact' | 'glitch' | 'riser' | 'laser' | string;
  durationSec?: number;
  ducking?: number;
  gain?: number;
}

// ============================================================================
// 6. Editorial & Transition Modifiers
export interface AVLinkModifierParams {
  linkedSequenceId: string;
  linkedTrackId: string;
  enabled?: boolean;
  syncTrim?: boolean;
}

export interface SplitEditModifierParams {
  mode: 'j_cut' | 'l_cut';
  splitDurationFrames: number;
  crossfadeAudio?: boolean;
}

export type TransitionType =
  | 'crossfade'
  | 'dip'
  | 'wipe'
  | 'push'
  | 'zoom'
  | 'glitch'
  | 'light_leak'
  | 'radial_wipe'
  | 'iris';

export type TransitionAlignment = 'center_on_cut' | 'start_at_cut' | 'end_at_cut';

export type TransitionDirection = 'left' | 'right' | 'up' | 'down';

export interface TransitionModifierParams {
  transitionType?: TransitionType | 'slide_left' | 'slide_right' | 'whip_zoom' | 'dip_black';
  durationFrames?: number;
  durationSec?: number;
  ease?: string;
  alignment?: TransitionAlignment;
  direction?: TransitionDirection;
  dipColor?: string;
  outgoingSeqId?: string;
  overlapTarget?: string;
  enabled?: boolean;
}

// ============================================================================
// Modifier Discriminator Union & Parameter Mapping
// ============================================================================

export interface TypedModifierNode<TType extends string, TTarget extends SequenceType | SequenceType[], TParams> {
  type: TType;
  target: TTarget;
  params: TParams;
}

export interface TimeSpaceModifierParams {
  templateId: string;
  seed?: number;
  theme?: 'cyberpunk' | 'solar_flare' | 'emerald_matrix' | 'monochrome_titanium' | 'synthwave_neon' | 'tactical_amber' | 'custom';
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  surfaceColor?: string;
  speedMultiplier?: number;
  scale?: number;
  density?: number;
  strokeWidth?: number;
  text?: string;
  subtitle?: string;
  targetX?: number;
  targetY?: number;
  labelX?: number;
  labelY?: number;
  params?: Record<string, number | string | boolean>;
  boundary?: 'loop' | 'pingpong' | 'clamp' | 'once';
  renderMode?: 'canvas2d' | 'webgl_buffers';
}
export type TimeSpaceModifierConfig = TimeSpaceModifierParams & { type: 'time_space' };

export type StandardModifierNode =
  | TypedModifierNode<'transform', 'video' | 'image' | 'overlay' | 'text' | SequenceType[], TransformModifierParams>
  | TypedModifierNode<'vfx/camera_3d', 'video' | 'image' | 'overlay' | SequenceType[], Camera3DModifierParams>
  | TypedModifierNode<'vfx/depth3d' | 'vfx/depth_relighting' | 'vfx/depth3d_relighting', 'video' | 'image' | SequenceType[], Depth3DModifierParams>
  | TypedModifierNode<'vfx/color_grading', 'video' | 'image' | 'overlay' | SequenceType[], ColorGradingModifierParams>
  | TypedModifierNode<'overlay/canvas_particles', 'video' | 'overlay' | SequenceType[], ParticleVfxModifierParams>
  | TypedModifierNode<'overlay/hologram_hud', 'video' | 'overlay' | SequenceType[], HologramHudModifierParams>
  | TypedModifierNode<'overlay/blend_mode', 'video' | 'image' | 'overlay' | SequenceType[], BlendModeModifierParams>
  | TypedModifierNode<'time_space', 'video' | 'image' | 'overlay' | SequenceType[], TimeSpaceModifierParams>
  | TypedModifierNode<'text/style', 'text' | SequenceType[], TextStyleModifierParams>
  | TypedModifierNode<'audio/volume', 'audio' | SequenceType[], VolumeModifierParams>
  | TypedModifierNode<'audio/pan', 'audio' | SequenceType[], PanModifierParams>
  | TypedModifierNode<'audio/filter', 'audio' | SequenceType[], FilterModifierParams>
  | TypedModifierNode<'audio/pitch', 'audio' | SequenceType[], PitchModifierParams>
  | TypedModifierNode<'sfx/dynamic_ducking', 'audio' | SequenceType[], DynamicDuckingModifierParams>
  | TypedModifierNode<'sfx/procedural', 'audio' | SequenceType[], ProceduralSfxModifierParams>
  | TypedModifierNode<'editorial/split_edit', 'video' | 'audio' | SequenceType[], SplitEditModifierParams>
  | TypedModifierNode<'editorial/av_link', 'video' | 'audio' | SequenceType[], AVLinkModifierParams>
  | TypedModifierNode<
      | 'transition/crossfade'
      | 'transition/wipe'
      | 'transition/push'
      | 'transition/zoom'
      | 'transition/dip'
      | 'transition/glitch'
      | 'transition/light_leak'
      | 'transition/radial_wipe'
      | 'transition/iris'
      | 'editorial/transition'
      | 'transition',
      'video' | 'image' | 'overlay' | 'audio' | SequenceType[],
      TransitionModifierParams
    >;

export interface CustomModifierNode<TParams = Record<string, unknown>> {
  type: string;
  target: SequenceType | SequenceType[];
  params: TParams;
}

export type ModifierNode<TParams = Record<string, unknown>> =
  | StandardModifierNode
  | CustomModifierNode<TParams>;
