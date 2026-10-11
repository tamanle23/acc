/**
 * Fine-Grained Polymorphic Video Director Configuration Types
 *
 * Implements a 3-tier director control architecture bridging high-level semantic
 * pipeline content (PipelineIR) with low-level execution sequences (VideoIRDocument).
 *
 * Tier 1: Global Canvas, Color Grading & Audio Staging
 * Tier 2: Domain Archetype Directives (polymorphic knobs per content category)
 * Tier 3: Timeline & Segment Fine-Grained Overrides (per-scene / per-role cinematography)
 */

export interface Depth3DDirective {
  mode: 'none' | 'parallax_2_5d' | 'frame_breaker' | 'sandwich';
  parallaxFactor?: number;
  focusDepth?: number;
  depthMapUrl?: string;
  enabled?: boolean;
}

export interface CameraMotionDirective {
  type: 'static' | 'ken_burns_zoom_in' | 'ken_burns_zoom_out' | 'pan_left' | 'pan_right' | 'dolly_zoom' | 'tilt_up';
  intensity?: number; // 0.1 to 1.0 (default 0.5)
}

export interface TransitionDirective {
  type: 'none' | 'crossfade' | 'wipeleft' | 'wiperight' | 'match_cut' | 'glitch' | 'zoom_blur';
  durationMs: number;
  easing?: 'linear' | 'ease-in-out' | 'cubic-bezier';
}

export interface SFXCueDirective {
  sfxType: 'whoosh' | 'impact_bass' | 'subtle_click' | 'cash_register' | 'riser' | 'notification' | 'glitch';
  offsetMs: number;
  volume?: number; // 0.0 to 1.0
  customAssetPath?: string;
}

export interface SegmentCaptionDirective {
  enabled?: boolean;
  text?: string;
  style?: 'sandwich_behind_subject' | 'glow_karaoke' | 'kinetic_pop' | 'minimal_editorial';
  highlightColor?: string;
  yPositionRatio?: number; // 0.0 (top) to 1.0 (bottom)
}

export interface SegmentDirectorOverride {
  index?: number; // Target by 1-based or 0-based chunk order
  durationMs?: number;
  depth3d?: Depth3DDirective;
  cameraMotion?: CameraMotionDirective;
  transition?: TransitionDirective;
  captions?: SegmentCaptionDirective;
  sfxCues?: SFXCueDirective[];
}

export interface CanvasDirectorConfig {
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  fps?: 24 | 30 | 60;
  resolution?: '720p' | '1080p' | '4k';
  colorGrading?: {
    lutPreset?: 'cinematic_teal_orange' | 'clean_tech' | 'cyberpunk_neon' | 'vintage_film' | 'warm_golden';
    lutPath?: string;
    contrast?: number; // default 1.0
    saturation?: number; // default 1.0
    vignette?: number; // default 0.0
  };
}

export interface AudioStagingDirectorConfig {
  bgmTrack?: string;
  autoDucking?: boolean;
  duckingAttenuationDb?: number; // default -14dB
  masterSfxVolume?: number; // 0.0 to 1.0
  masterBgmVolume?: number; // 0.0 to 1.0
}

export interface TypographyDirectorConfig {
  preset?: 'tiktok_karaoke_glow' | 'minimal_editorial' | 'bold_headline' | '3d_sandwich' | 'classic_subtitle';
  primaryColor?: string;
  highlightColor?: string;
  placement?: 'center' | 'bottom' | 'top';
  fontSize?: number;
}

export interface ArchetypeVisualDirectives {
  chartVisuals?: {
    animationCurve?: 'cubic-bezier(0.4, 0, 0.2, 1)' | 'linear' | 'ease-out';
    cameraZoomOnLeaderChange?: boolean;
    glowIntensity?: number;
    showGridLines?: boolean;
  };
  cryptoVisuals?: {
    tickerStyle?: 'floating_hud' | 'bottom_ticker_tape' | 'neon_pill';
    sentimentColorCoding?: boolean;
    highlightTopGainers?: boolean;
  };
  talkingHead?: {
    autoReframe?: 'center_face' | 'smart_speaker_switch';
    punchInOnEmphasis?: boolean;
    waveformStyle?: 'circular' | 'bars' | 'line';
  };
  narrativeStory?: {
    cinematicBars?: boolean;
    fogDensity?: number;
    ambientDustParticles?: boolean;
  };
}

/**
 * Top-level FineGrainedVideoDirectorConfig
 * Polymorphic, extensible, and backward-compatible with legacy simple { aspectRatio, fps, durationMs }
 */
export interface FineGrainedVideoDirectorConfig {
  // Global Directives (Tier 1)
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  fps?: number;
  durationMs?: number;
  canvas?: CanvasDirectorConfig;
  audioStaging?: AudioStagingDirectorConfig;
  typography?: TypographyDirectorConfig;

  // Domain Archetype Directives (Tier 2)
  archetypeDirectives?: ArchetypeVisualDirectives;

  // Timeline / Segment Overrides (Tier 3)
  roleDirectives?: {
    hook?: SegmentDirectorOverride;
    body?: SegmentDirectorOverride;
    outro?: SegmentDirectorOverride;
  };
  segments?: SegmentDirectorOverride[];
}
