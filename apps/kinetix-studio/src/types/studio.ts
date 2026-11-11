import type { Setter } from 'solid-js';
import type { AspectRatio, SpatialLayoutId, LayoutEngineType } from './spatial';
import type {
  TimelineMode,
  FpsCadence,
  EasingId,
  KineticTypeId,
  HeroMotionId,
  ChoreographyEnvelope,
  AudioTelemetry,
  ChoreoMode,
  CustomKeyframeTracks,
} from './motion';
import type { ShaderId } from './shader';
import type { HeroId } from './hero';
import type { SynthPatternId, VoiceMuteMap } from '@/engine/audio-synth';
import type { StoryboardSequence } from '@/core/domain/storyboard/storyboard-sequence.entity';
import type { StoryboardScene, Scene3DChoreography } from './storyboard';

export interface PaletteTokens {
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  accent2: string;
}

export interface ContentPayload {
  headline: [string, string, string];
  subhead: string;
  date: string;
  location: string;
  tag: string;
  sponsor: string;
}

export type SubsystemId =
  | 'palette'
  | 'spatial'
  | 'background'
  | 'ambient'
  | 'hero'
  | 'motion'
  | 'audio'
  | 'payload'
  | 'surface';

export type StageShape =
  | 'auto'
  | 'rounded-rect'
  | 'sharp-rect'
  | 'circle'
  | 'pill'
  | 'squircle'
  | 'hexagon'
  | 'chamfer'
  | 'diamond';

export type StageAspect =
  | 'auto'
  | '1:1'
  | '4:5'
  | '16:9'
  | '9:16'
  | '3:2'
  | '2:1';

export type DarkroomGradingMode = 'natural' | 'duotone' | 'tritone' | 'risograph';

export interface ConfigDiffEntry {
  subsystem: SubsystemId;
  field: string;
  label: string;
  currentValue: unknown;
  referenceValue: unknown;
}

export interface UserPreset {
  id: string;
  title: string;
  category: string;
  badge: string;
  createdAt: number;
  statePatch: Partial<StudioState>;
}

export type BackgroundGraphicId =
  | 'solid'
  | 'duotone-mesh'
  | 'halftone-dots'
  | 'risograph-grain'
  | 'blueprint-grid'
  | 'bauhaus-geo'
  | 'topo-contours'
  | 'hex-mesh'
  | 'minimal-noise'
  | 'acid-marbling'
  | 'seigaiha-waves'
  | 'caution-stripes'
  | 'custom-image';

export type BackgroundBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'luminosity';

export interface LayerVisibility {
  background: boolean;
  shader: boolean;
  hero: boolean;
  typography: boolean;
  audio: boolean;
}

export interface StudioState {
  posterId: string;
  archetypeId: string;
  aspectRatio: AspectRatio;
  fps: FpsCadence;
  durationSec: number;
  timelineMode: TimelineMode;
  hicksLawDisclosure: boolean;
  layoutEngine: LayoutEngineType;
  layoutVariant: string;
  layoutId: SpatialLayoutId;
  topHeadlineFlow: boolean;
  safeZone916: boolean;
  blueprintGrid: boolean;
  gridMarginPx: number;
  // Multi-Track & Sequencing Tokens
  playbackSpeed: number; // 0.5, 1.0, 2.0
  loopRange: [number, number]; // [startProgress, endProgress], e.g. [0, 1]
  layerVisibility: LayerVisibility;
  // Layer 0: Background Plate & Image Graphics
  bgGraphicId: BackgroundGraphicId;
  bgOpacity: number;
  bgScale: number;
  bgBlurPx: number;
  bgBlendMode: BackgroundBlendMode;
  bgDuotone: boolean;
  bgDarkroomMode?: DarkroomGradingMode;
  bgDarkroomMisreg?: boolean;
  bgDarkroomDitherScale?: number;
  bgMotion: boolean;
  bgCustomImageKey: string | null;
  bgVideoUrl?: string | null;
  bgVideoLoopDuration?: number;
  activeMediaAssetId?: string | null;
  // Layer 1: Ambient Environment Plate
  shaderId: ShaderId;
  shaderOpacity: number;
  shaderTurbulence: number;
  // Layer 2: Hero Stage & Viewport (hero-window-frame)
  stageShape: StageShape;
  stageAspect: StageAspect;
  stageScale: number;
  stageCornerRadius: number;
  stageOffsetY: number;
  stageOpacity: number;
  stageColor: 'auto' | 'surface' | 'bg' | 'accent' | 'accent2' | 'ink' | string;
  stageBorderColor: 'accent' | 'accent2' | 'ink' | 'surface' | string;
  stageBlurPx: number;
  stageBorderOpacity: number;
  stageBorderWidth?: number; // Frame border stroke thickness in px (0.5 to 10, default 1.5)
  heroBreakout: boolean;
  doubleExposure: boolean;
  // Layer 3: Hero Focal Subject
  heroId: HeroId;
  heroMotion: HeroMotionId;
  heroScale: number;
  heroMicroKinetics: boolean;
  choreo3d?: Scene3DChoreography;
  // Surface & Studio Treatments
  liquidWarp: boolean;
  lightLeaks: boolean;
  vhsGrain: boolean;
  collageEdges: boolean;
  // Motion & 60/30/10 Budget Tokens
  easingId: EasingId;
  kineticTypeId: KineticTypeId;
  primaryFocusZone: 'hero' | 'headline';
  heroBudget: number;
  ambientBudget: number;
  metaBudget: number;
  staggerMs: number;
  // Web Audio 4-Voice Polyphonic Synth Engine
  audioReactive: boolean;
  synthAudioSound: boolean;
  bpm: number;
  synthPattern: SynthPatternId;
  synthMasterVolume: number;
  synthFilterCutoff: number;
  synthFilterResonance: number;
  synthVoiceMutes: VoiceMuteMap;
  palette: PaletteTokens;
  content: ContentPayload;
  customLottieJson: string | null;
  customGlbName?: string | null;
  // Stage Interactive Ergonomics & Offset
  stageOffsetX?: number;
  // Choreography Engine Mode & Keyframes
  choreoMode?: ChoreoMode;
  customKeyframes?: CustomKeyframeTracks;
  // User Audio Pipeline
  audioSource?: 'synth' | 'user-file';
  userAudioKey?: string | null;
  userAudioFileName?: string | null;
  userAudioLoopRange?: [number, number];
  // Brand Vector Mark & Custom Font Tokens
  customFontKey?: string | null;
  customFontFamily?: string | null;
  headlineFont?: string;
  subheadFont?: string;
  headlineWeight?: number;
  letterSpacing?: number;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  vectorLogoKey?: string | null;
  vectorLogoAnchor?: 'top-left' | 'top-right' | 'hero-plinth' | 'stage-center';
  vectorLogoScale?: number;
  vectorLogoColor?: 'accent' | 'ink' | 'original';
  // User Photo Cutout Tokens
  userPhotoCutoutKey?: string | null;
  userPhotoThreshold?: number;
  // WebGPU & Refractive Glass
  webGpuEnabled?: boolean;
  refractiveGlass?: boolean;
  chromaticAberration?: number;
  // Dynamic Tunable Parameters (Uniforms Map)
  shaderParams: Record<string, number | boolean | string>;
  heroParams: Record<string, number | boolean | string>;
  bgParams: Record<string, number | boolean | string>;
  // Storyboard & Multi-Scene Sequencer Tokens (Horizon 1)
  isStoryboardMode?: boolean;
  activeSequenceId?: string;
  currentSceneIndex?: number;
}

export interface StudioContextValue {
  state: StudioState;
  patchState: (patch: Partial<StudioState>) => void;
  resetState: () => void;
  isPlaying: boolean;
  setIsPlaying: Setter<boolean>;
  currentFrame: number;
  setCurrentFrame: Setter<number>;
  totalFrames: number;
  rawProgress: number;
  choreo: ChoreographyEnvelope;
  audioTelemetry: AudioTelemetry;
  wcagContrast: number;
  toastMessage: string | null;
  triggerToast: (msg: string) => void;
  triggerAnalogSynthBeat: (bpmVal: number) => void;
  handleToggleBpmSynth: (forceNext?: boolean) => void;
  resumeAudio: () => Promise<boolean>;
  handleSynthesizePalette: () => void;
  handleRandomizeEvent: () => void;
  getByteFrequencyData: (arr: Uint8Array) => void;
  getAudioLevel: () => number;
  renderAudioTrackOffline: (options?: { bpm?: number; durationSec?: number }) => Promise<AudioBuffer>;
  toggleLayerVisibility: (layer: keyof LayerVisibility) => void;
  setPlaybackSpeed: (speed: number) => void;
  setSynthPattern: (pattern: SynthPatternId) => void;
  toggleSynthVoice: (voice: keyof VoiceMuteMap) => void;
  // Configuration Engine Extensions
  revertToArchetype: () => void;
  resetSubsystem: (subsystem: SubsystemId) => void;
  saveCustomPreset: (title: string, category?: string) => UserPreset;
  loadCustomPreset: (presetId: string) => void;
  deleteCustomPreset: (presetId: string) => void;
  userPresets: UserPreset[];
  applyDeclarativeContract: (jsonString: string) => { success: boolean; error?: string };
  copyShareUrl: () => Promise<string>;
  activeTab: 'config' | 'brand' | 'motion' | 'payload';
  setActiveTab: (tab: 'config' | 'brand' | 'motion' | 'payload') => void;
  // Storyboard & Multi-Scene Sequencer Actions (Horizon 1)
  storyboard: StoryboardSequence;
  setStoryboard: (seq: StoryboardSequence) => void;
  toggleStoryboardMode: () => void;
  addStoryboardScene: (scene: StoryboardScene, index?: number) => void;
  removeStoryboardScene: (sceneId: string) => void;
  updateStoryboardScene: (sceneId: string, patch: Partial<StoryboardScene>) => void;
  reorderStoryboardScenes: (fromIndex: number, toIndex: number) => void;
  loadStoryboardPreset: (presetId: string) => void;
  selectedSceneId: string | null;
  selectStoryboardScene: (sceneId: string | null) => void;
  duplicateStoryboardScene: (sceneId: string) => void;
  patchSelectedStoryboardScene: (patch: Partial<StudioState>) => void;
  patchSelectedScene3DChoreo: (patch: Partial<Scene3DChoreography>) => void;
}
