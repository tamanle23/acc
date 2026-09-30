export interface CaptionConfig {
  text: string;
  start: number; // in seconds
  end: number; // in seconds
}

export type TransitionType =
  | 'fade' | 'wipeleft' | 'wiperight' | 'wipeup' | 'wipedown' | 'slideleft'
  | 'slideright' | 'slideup' | 'slidedown' | 'circlecrop' | 'rectcrop'
  | 'distance' | 'fadeblack' | 'fadewhite' | 'radial' | 'smoothleft'
  | 'smoothright' | 'smoothup' | 'smoothdown' | 'circleopen' | 'circleclose'
  | 'vertopen' | 'vertclose' | 'horzopen' | 'horzclose' | 'dissolve'
  | 'pixelize' | 'diagtl' | 'diagtr' | 'diagbl' | 'diagbr' | 'hlslice'
  | 'hrslice' | 'vuslice' | 'vdslice' | 'hblur' | 'fadegrays' | 'wipetl'
  | 'wipetr' | 'wipebl' | 'wipebr' | 'squeezeh' | 'squeezev' | 'zoomin'
  | 'fadefast' | 'fadeslow' | 'random';

export interface TransitionSettings {
  enabled?: boolean;
  type?: TransitionType;
  duration?: number; // In seconds (default: 1.0)
  audioBehavior?: 'crossfade' | 'pad'; // pad adds silence so voices don't overlap
}

export interface TtsConfig {
  enabled?: boolean;
  provider?: string; // e.g. "vieneu-v3-turbo"
  voice: string; // e.g. "Ngọc Trân"
  speed?: number; // e.g. 1.0
}

export type Depth3DMode =
  | 'frame_breaker'
  | 'parallax_25d'
  | 'volumetric_sandwich'
  | 'depth_map_3d'
  | 'wigglegram'
  // Aliases for convenience
  | 'parallax_dolly'
  | 'sandwich'
  | 'mesh_displacement';

export type FrameBreakerStyle = 'card' | 'polaroid' | 'cinema' | 'comic';

export type ParallaxMotion = 'pan_left' | 'pan_right' | 'zoom_in' | 'zoom_out' | 'dolly_zoom';

export interface Parallax25DSettings {
  cameraMotion?: ParallaxMotion; // default: 'dolly_zoom'
  intensity?: number; // default: 1.0
  depthBlur?: boolean; // default: true (background depth of field blur)
  backgroundImage?: string; // Optional separate clean background plate
  foregroundElements?: boolean; // default: true (atmospheric particles)
}

export interface SandwichVolumetricSettings {
  textBehindSubject?: boolean; // default: true (renders title/captions in mid-layer)
  ambientDust?: boolean; // default: true (floating dust specks behind subject)
  vignette?: boolean; // default: true (volumetric edge shadow)
  bannerText?: string; // Optional custom large 3D typography behind subject
  textColor?: string; // default: 'rgba(255,255,255,0.85)'
}

export interface DepthMap3DSettings {
  depthMapPath?: string; // Path to grayscale depth map image (white = near, black = far)
  motion?: 'circle' | 'horizontal' | 'vertical' | 'zoom'; // default: 'circle'
  displacementScale?: number; // default: 15 (pixels displacement)
}

export interface WigglegramSettings {
  frequency?: number; // default: 8 (Hz / oscillations per second)
  amplitude?: number; // default: 12 (pixel horizontal shift)
  direction?: 'horizontal' | 'diagonal' | 'rotational'; // default: 'horizontal'
  chromaticAberration?: boolean; // default: true (subtle RGB split during wiggle)
}

export interface Depth3DConfig {
  enabled?: boolean;
  mode?: Depth3DMode; // default: 'frame_breaker'
  frameStyle?: FrameBreakerStyle; // default: 'card'
  popOutIntensity?: number; // default: 1.15 (scale/pop-out multiplier)
  shadow?: boolean; // default: true
  shadowBlur?: number; // default: 25
  shadowColor?: string; // default: 'rgba(0,0,0,0.6)'
  backdropBlur?: number; // default: 20 (px blur for outer background)
  floatMotion?: boolean; // default: true (gentle 3D floating oscillation)
  subjectImage?: string; // Optional transparent cutout PNG/WebM of subject if provided separately

  // Specific mode sub-configurations
  parallax?: Parallax25DSettings;
  sandwich?: SandwichVolumetricSettings;
  depthMesh?: DepthMap3DSettings;
  wigglegram?: WigglegramSettings;
}

export interface VideoSettings {
  timeBase?: 'audio' | 'video';
  shortVideoMode?: 'freeze' | 'loop';
  longVideoMode?: 'trim' | 'continue';
  volume?: number;
}

export interface SceneConfig {
  image?: string; // Optional if video is provided.
  video?: string; // Optional if image is provided. B-roll / Stock footage
  audio?: string; // Optional if text is provided. Filename (e.g. "voiceover1.mp3")
  text?: string; // Text script for TTS generation if audio is missing
  captions: CaptionConfig[];
  transition?: TransitionSettings; // Scene-level override for transition to the NEXT scene
  pauseAfter?: number; // Override for pauseBetweenScenes
  depth3d?: Depth3DConfig; // Scene-level 3D depth / pop-out effect
  videoSettings?: VideoSettings; // Configuration for duration conflict and audio mixing when using video
}

export type CaptionPreset =
  | 'classic'
  | 'tiktok'
  | 'cinematic'
  | 'vlog'
  | 'neon-glow'
  | 'bold-retro'
  | 'minimal-clean'
  | 'karaoke'
  | 'news-banner'
  | 'retro-typewriter';

export type CaptionPosition =
  | 'bottom'
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'middle'
  | 'top'
  | 'top-center'
  | 'top-left'
  | 'top-right';

export type SubtitleMode = 'burn' | 'soft';

export interface CaptionSettings {
  preset?: CaptionPreset;
  subtitleMode?: SubtitleMode; // 'burn' (Hardsub into video frames, default) | 'soft' (Separate muxed subtitle track)
  fontName?: string;
  fontSize?: number;
  primaryColor?: string; // HTML Hex code, e.g. #FFFFFF
  outlineColor?: string;
  shadowColor?: string;
  outlineSize?: number;
  shadowSize?: number;
  position?: CaptionPosition; // Human-friendly position alias ('bottom', 'center', 'top', etc.)
  alignment?: number; // 1-9 (numpad layout, 2 = bottom-center, 5 = center, 8 = top-center)
  marginV?: number; // vertical margin from edge in pixels
  marginH?: number; // horizontal margin from edges in pixels
  marginL?: number; // left margin in pixels
  marginR?: number; // right margin in pixels
  borderStyle?: number; // 1 = Outline+Shadow, 3 = Opaque Box

  // Karaoke Highlight settings
  wordsPerPhrase?: number; // Number of words per phrase (e.g. 5-6). If 1, words flash individually.
  highlightPreset?: 'none' | 'color' | 'scale' | 'glow' | 'scale-color';
  highlightColor?: string; // HTML Hex code for highlight, e.g. #00FFFF
  autoTranscribe?: boolean; // Automatically extract subtitles using Whisper AI (default: true)
}

export type PlatformPreset =
  | 'tiktok'
  | 'shorts'
  | 'reels'
  | 'youtube'
  | 'youtube-4k'
  | 'facebook'
  | 'instagram'
  | 'instagram-story'
  | 'web'
  | 'mobile'
  | 'custom';

export type VideoCodec =
  | 'auto'
  | 'h264'
  | 'h265'
  | 'hevc'
  | 'av1'
  | 'vp9'
  | 'libx264'
  | 'libx265'
  | 'h264_nvenc'
  | 'hevc_nvenc'
  | 'av1_nvenc'
  | 'libvpx-vp9'
  | (string & {});

export type AudioCodec =
  | 'auto'
  | 'aac'
  | 'mp3'
  | 'opus'
  | 'libmp3lame'
  | 'libopus'
  | 'copy'
  | (string & {});

export type ContainerFormat = 'mp4' | 'mkv' | 'mov' | 'webm';

export type GpuAcceleration = 'auto' | 'nvidia' | 'none';

export type UpscaleModel = 'realesrgan-x4plus' | 'realesrgan-x4plus-anime' | 'realesrnet-x4plus' | 'realesr-animevideov3' | '4x-UltraSharp' | (string & {});

export interface UpscaleSettings {
  enabled: boolean;
  model?: UpscaleModel;
  ratio?: number;
}

export interface BGMSettings {
  source: string; // Filename or path to the background music
  volume?: number; // Volume multiplier (default: 0.1)
  loop?: boolean; // Whether to loop the BGM (default: true)
  fadeIn?: number; // Fade-in duration in seconds (default: 0)
  fadeOut?: number; // Fade-out duration in seconds (default: 2)
  autoDucking?: boolean; // Tự động nén âm nền (sidechain compress) khi có SFX/Voice (default: true)
}

export interface StorySettings {
  // Dimension & Frame rate
  width?: number;
  height?: number;
  fps?: number;

  // Platform optimization preset
  platform?: PlatformPreset;

  // Video Encoding
  videoCodec?: VideoCodec;
  preset?: string; // e.g. 'p4', 'medium', 'fast', 'slow' (encoding speed vs compression)
  crf?: number; // Constant Rate Factor / Constant Quality (lower = higher quality, e.g. 18-28)
  pixelFormat?: string; // e.g. 'yuv420p', ensures widespread compatibility

  // Audio Encoding
  audioCodec?: AudioCodec;
  audioBitrate?: string; // e.g. '128k', '192k', '320k'

  // Container & Delivery
  container?: ContainerFormat; // 'mp4' | 'mkv' | 'mov' | 'webm'
  fastStart?: boolean; // Puts moov atom at the front for web streaming (+faststart)

  // Hardware Acceleration & Performance
  gpuAcceleration?: GpuAcceleration; // 'auto' | 'nvidia' | 'none'
  concurrency?: number | 'auto'; // Number of slides rendered concurrently in parallel ('auto' | 1 | 2 | 4 | 6 | 8)
  fastIntermediate?: boolean; // Enables ultrafast/lossless preset for intermediate renders to save time (trades disk space for speed)

  // Captions
  captions?: CaptionSettings;

  // Features
  transition?: TransitionSettings;
  upscale?: UpscaleSettings;
  tts?: TtsConfig;
  pauseBetweenScenes?: number; // Thời gian nghỉ (khoảng lặng) giữa các cảnh (giây)
  overlayComposite?: string; // e.g. "haunted_forest" to apply polyrhythmic looping overlay on final video
  bgm?: BGMSettings; // Background Music configuration
  depth3d?: Depth3DConfig; // Global default for 3D depth / pop-out effect
}

export interface StoryConfig {
  name?: string;
  description?: string;
  settings: StorySettings;
  scenes?: SceneConfig[];
  slides?: SceneConfig[]; // deprecated backward compatibility
}

export interface ResolvedSceneConfig extends SceneConfig {
  resolvedImage?: string;
  resolvedVideo?: string;
  resolvedAudio: string;
  resolvedVideoSettings?: Required<VideoSettings>;
}

export interface ResolvedStorySettings extends Required<Omit<StorySettings, 'captions' | 'platform' | 'concurrency' | 'transition' | 'upscale' | 'fastIntermediate' | 'tts' | 'pauseBetweenScenes' | 'pauseBetweenSlides' | 'overlayComposite' | 'bgm' | 'depth3d'>> {
  platform: PlatformPreset;
  concurrency: number; // Resolved numeric parallel workers count (e.g. 1, 2, 4, 6)
  fastIntermediate: boolean;
  captions?: CaptionSettings;
  transition?: TransitionSettings;
  upscale?: UpscaleSettings;
  tts?: TtsConfig;
  pauseBetweenScenes?: number;
  overlayComposite?: string;
  bgm?: BGMSettings;
  depth3d?: Depth3DConfig;
}

export interface ResolvedStoryConfig {
  name?: string;
  description?: string;
  settings: ResolvedStorySettings;
  scenes: ResolvedSceneConfig[];
}
