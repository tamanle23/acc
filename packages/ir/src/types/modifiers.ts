import type { SequenceType, TrackType } from './VideoIR';

// ============================================================================
// Canonical Schema-Generated Modifier Types Re-export
// ============================================================================
export type {
  ModifierTypeEnum,
  TransformModifierParams,
  AutoReframeModifierParams,
  PartialVfxModifierParams,
  GSAPMotionModifierParams,
  ShapeDrawModifierParams,
  ShapeVectorModifierParams,
  DepthRelightingParams,
  Camera3DModifierParams,
  Depth3DModifierParams,
  ColorGradingModifierParams,
  ParticleVfxModifierParams,
  HologramHudModifierParams,
  BlendModeModifierParams,
  TextStyleModifierParams,
  VolumeModifierParams,
  PanModifierParams,
  FilterModifierParams,
  PitchModifierParams,
  DynamicDuckingModifierParams,
  ProceduralSfxModifierParams,
  AVLinkModifierParams,
  SplitEditModifierParams,
  TransitionModifierParams,
  VectorMotionBlurModifierParams,
  SolidBackdropModifierParams,
  PhotometricBloomModifierParams,
  AnamorphicGlareModifierParams,
  TimeSpaceModifierParams,
  CalloutLeaderModifierParams,
  CalloutMultiTargetModifierParams,
  HUDReticleModifierParams,
  KineticTitleModifierParams,
  CyberLowerThirdModifierParams,
  CountdownModifierParams,
  NetworkPlexusModifierParams,
  AudioWaveformModifierParams,
  AudioSpectrumModifierParams,
  SuperformulaModifierParams,
  EnergyShieldModifierParams,
  GlitchDataStreamModifierParams,
  CymaticChladniModifierParams,
  StrangeAttractorModifierParams,
  RelativisticBlackHoleModifierParams,
  TopographicContourModifierParams,
  HyperbolicPoincareModifierParams,
  KineticHarmonographModifierParams,
} from './generated-ir-types';

import type {
  TransformModifierParams,
  AutoReframeModifierParams,
  PartialVfxModifierParams,
  GSAPMotionModifierParams,
  ShapeDrawModifierParams,
  Camera3DModifierParams,
  Depth3DModifierParams,
  ColorGradingModifierParams,
  ParticleVfxModifierParams,
  HologramHudModifierParams,
  BlendModeModifierParams,
  TextStyleModifierParams,
  VolumeModifierParams,
  PanModifierParams,
  FilterModifierParams,
  PitchModifierParams,
  DynamicDuckingModifierParams,
  ProceduralSfxModifierParams,
  AVLinkModifierParams,
  SplitEditModifierParams,
  TransitionModifierParams,
  VectorMotionBlurModifierParams,
  SolidBackdropModifierParams,
  PhotometricBloomModifierParams,
  AnamorphicGlareModifierParams,
  TimeSpaceModifierParams,
  CalloutLeaderModifierParams,
  CalloutMultiTargetModifierParams,
  HUDReticleModifierParams,
  KineticTitleModifierParams,
  CyberLowerThirdModifierParams,
  CountdownModifierParams,
  NetworkPlexusModifierParams,
  AudioWaveformModifierParams,
  AudioSpectrumModifierParams,
  SuperformulaModifierParams,
  EnergyShieldModifierParams,
  GlitchDataStreamModifierParams,
  CymaticChladniModifierParams,
  StrangeAttractorModifierParams,
  RelativisticBlackHoleModifierParams,
  TopographicContourModifierParams,
  HyperbolicPoincareModifierParams,
  KineticHarmonographModifierParams,
} from './generated-ir-types';

// ============================================================================
// Core Modifier Target Scope Taxonomy
// ============================================================================

export type ModifierTargetScope = 'standalone' | 'sequence' | 'track' | 'timeline';

export interface EntityModifierContext {
  target?: 'sequence' | 'track' | 'timeline';
  type?: 'sequence' | 'track' | 'timeline';
  sequenceType?: SequenceType;
  /** True if the target sequence currently contains a standalone generator */
  hasStandaloneGenerator?: boolean;
  /** List of modifier types currently attached to the target entity */
  existingModifierTypes?: readonly string[];
}

export interface EntityModifierCheckResult {
  allowed: boolean;
  reason?: string;
}

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
// Sub-types & Aliases for Modifiers
// ============================================================================

export interface PartialVfxRegion {
  type: 'circle' | 'rect';
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
  intensity?: number;
  color?: string;
}

export type ShapeModifierParams = ShapeDrawModifierParams;

export interface Camera3DKeyframeIR {
  time: number; // [0, 1]
  position: [number, number, number];
  target?: [number, number, number];
  roll?: number;
  fov?: number;
  focalZ?: number;
  focalAperture?: number;
}

export interface ColorWheelValue {
  x: number;
  y: number;
  yLevel: number;
}

export interface ParticleShaderParams {
  chromaticAberration?: { enabled?: boolean; offsetPx?: number };
  bloom?: { enabled?: boolean; threshold?: number; intensity?: number };
  anamorphicFlare?: { enabled?: boolean; intensity?: number; tintColor?: string };
}

export type TimedTextStyleModifierParams = TextStyleModifierParams;

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

export type TimeSpaceTheme = 'cyberpunk' | 'solar_flare' | 'emerald_matrix' | 'monochrome_titanium' | 'synthwave_neon' | 'tactical_amber' | 'custom';
export type TimeSpaceBoundary = 'loop' | 'pingpong' | 'clamp' | 'once';
export type TimeSpaceRenderMode = 'canvas2d' | 'webgl_buffers';

export interface BaseTimeSpaceModifierParams {
  seed?: number;
  theme?: TimeSpaceTheme;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  surfaceColor?: string;
  speedMultiplier?: number;
  scale?: number;
  boundary?: TimeSpaceBoundary;
  renderMode?: TimeSpaceRenderMode;
  params?: Record<string, number | string | boolean>;
}

export type TimeSpaceModifierConfig = TimeSpaceModifierParams & { type: 'time_space' };

// ============================================================================
// Modifier Discriminator Union & Parameter Mapping
// ============================================================================

export interface TypedModifierNode<TType extends string, TTarget extends SequenceType | SequenceType[], TParams> {
  type: TType;
  target: TTarget;
  params: TParams;
}

export type StandardModifierNode =
  | TypedModifierNode<'transform', 'video' | 'image' | 'overlay' | 'text' | SequenceType[], TransformModifierParams>
  | TypedModifierNode<'vfx/auto_reframe', 'video' | 'image' | SequenceType[], AutoReframeModifierParams>
  | TypedModifierNode<'vfx/partial', 'video' | 'image' | SequenceType[], PartialVfxModifierParams>
  | TypedModifierNode<'vfx/camera_3d', 'video' | 'image' | 'overlay' | SequenceType[], Camera3DModifierParams>
  | TypedModifierNode<'vfx/depth3d' | 'vfx/depth_relighting' | 'vfx/depth3d_relighting', 'video' | 'image' | SequenceType[], Depth3DModifierParams>
  | TypedModifierNode<'vfx/color_grading', 'video' | 'image' | 'overlay' | SequenceType[], ColorGradingModifierParams>
  | TypedModifierNode<'motion/gsap', 'video' | 'image' | 'overlay' | 'text' | SequenceType[], GSAPMotionModifierParams>
  | TypedModifierNode<'shape/draw' | 'shape/vector', 'overlay' | SequenceType[], ShapeModifierParams>
  | TypedModifierNode<'overlay/canvas_particles', 'video' | 'overlay' | SequenceType[], ParticleVfxModifierParams>
  | TypedModifierNode<'overlay/hologram_hud', 'video' | 'overlay' | SequenceType[], HologramHudModifierParams>
  | TypedModifierNode<'overlay/blend_mode', 'video' | 'image' | 'overlay' | SequenceType[], BlendModeModifierParams>
  | TypedModifierNode<'time_space', 'video' | 'image' | 'overlay' | SequenceType[], TimeSpaceModifierParams>
  | TypedModifierNode<'time_space/callout_leader', 'video' | 'image' | 'overlay' | SequenceType[], CalloutLeaderModifierParams>
  | TypedModifierNode<'time_space/callout_multitarget', 'video' | 'image' | 'overlay' | SequenceType[], CalloutMultiTargetModifierParams>
  | TypedModifierNode<'time_space/hud_reticle', 'video' | 'image' | 'overlay' | SequenceType[], HUDReticleModifierParams>
  | TypedModifierNode<'time_space/kinetic_title', 'video' | 'image' | 'overlay' | SequenceType[], KineticTitleModifierParams>
  | TypedModifierNode<'time_space/cyber_lower_third', 'video' | 'image' | 'overlay' | SequenceType[], CyberLowerThirdModifierParams>
  | TypedModifierNode<'time_space/countdown', 'video' | 'image' | 'overlay' | SequenceType[], CountdownModifierParams>
  | TypedModifierNode<'time_space/network_plexus', 'video' | 'image' | 'overlay' | SequenceType[], NetworkPlexusModifierParams>
  | TypedModifierNode<'time_space/audio_waveform', 'video' | 'image' | 'overlay' | SequenceType[], AudioWaveformModifierParams>
  | TypedModifierNode<'time_space/audio_spectrum', 'video' | 'image' | 'overlay' | SequenceType[], AudioSpectrumModifierParams>
  | TypedModifierNode<'time_space/superformula', 'video' | 'image' | 'overlay' | SequenceType[], SuperformulaModifierParams>
  | TypedModifierNode<'time_space/energy_shield', 'video' | 'image' | 'overlay' | SequenceType[], EnergyShieldModifierParams>
  | TypedModifierNode<'time_space/glitch_data_stream', 'video' | 'image' | 'overlay' | SequenceType[], GlitchDataStreamModifierParams>
  | TypedModifierNode<'time_space/cymatic_chladni', 'video' | 'image' | 'overlay' | SequenceType[], CymaticChladniModifierParams>
  | TypedModifierNode<'time_space/strange_attractor', 'video' | 'image' | 'overlay' | SequenceType[], StrangeAttractorModifierParams>
  | TypedModifierNode<'time_space/relativistic_blackhole', 'video' | 'image' | 'overlay' | SequenceType[], RelativisticBlackHoleModifierParams>
  | TypedModifierNode<'time_space/topographic_contour', 'video' | 'image' | 'overlay' | SequenceType[], TopographicContourModifierParams>
  | TypedModifierNode<'time_space/hyperbolic_poincare', 'video' | 'image' | 'overlay' | SequenceType[], HyperbolicPoincareModifierParams>
  | TypedModifierNode<'time_space/kinetic_harmonograph', 'video' | 'image' | 'overlay' | SequenceType[], KineticHarmonographModifierParams>
  | TypedModifierNode<'timed_text/style' | 'text/style', 'text' | SequenceType[], TextStyleModifierParams>
  | TypedModifierNode<'motion/vector_blur', 'video' | 'image' | SequenceType[], VectorMotionBlurModifierParams>
  | TypedModifierNode<'generator/solid_backdrop', 'overlay' | SequenceType[], SolidBackdropModifierParams>
  | TypedModifierNode<'timeline/photometric_bloom', 'video' | 'overlay' | SequenceType[], PhotometricBloomModifierParams>
  | TypedModifierNode<'timeline/anamorphic_glare', 'video' | 'overlay' | SequenceType[], AnamorphicGlareModifierParams>
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
