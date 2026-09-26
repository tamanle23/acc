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

export interface SlideConfig {
  image: string; // Filename (e.g. "scene1.jpg"), relative path ("./assets/scene1.jpg"), or absolute path ("C:/Photos/scene1.jpg")
  audio: string; // Filename (e.g. "voiceover1.mp3"), relative path ("./audio/v1.mp3"), or absolute path ("C:/Audio/voiceover1.mp3")
  captions: CaptionConfig[];
  transition?: TransitionSettings; // Slide-level override for transition to the NEXT slide
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

export type UpscaleModel = 'realesrgan-x4plus' | 'realesrgan-x4plus-anime' | 'realesrnet-x4plus' | '4x-UltraSharp' | (string & {});

export interface UpscaleSettings {
  enabled: boolean;
  model?: UpscaleModel;
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
  overlayComposite?: string; // e.g. "haunted_forest" to apply polyrhythmic looping overlay on final video
}

export interface StoryConfig {
  name?: string;
  description?: string;
  settings: StorySettings;
  slides: SlideConfig[];
}

export interface ResolvedSlideConfig extends SlideConfig {
  resolvedImage: string;
  resolvedAudio: string;
}

export interface ResolvedStorySettings extends Required<Omit<StorySettings, 'captions' | 'platform' | 'concurrency' | 'transition' | 'upscale' | 'fastIntermediate'>> {
  platform: PlatformPreset;
  concurrency: number; // Resolved numeric parallel workers count (e.g. 1, 2, 4, 6)
  fastIntermediate: boolean;
  captions?: CaptionSettings;
  transition?: TransitionSettings;
  upscale?: UpscaleSettings;
}

export interface ResolvedStoryConfig {
  name?: string;
  description?: string;
  settings: ResolvedStorySettings;
  slides: ResolvedSlideConfig[];
}
