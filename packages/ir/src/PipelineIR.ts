export type PipelineId = 
  | 'scraper-summarizer'      // Pipeline 1
  | 'db-templating'           // Pipeline 2
  | 'repurposing-recycler'    // Pipeline 3
  | 'generative-storytelling' // Pipeline 4
  | 'rule-logic'              // Pipeline 5
  | 'ambient-loops';          // Pipeline 6

export type PlatformPreset =
  | 'tiktok' | 'shorts' | 'reels' | 'youtube' | 'youtube-4k'
  | 'facebook' | 'instagram' | 'spatial-vr' | 'custom';

export interface Keyframe<T> {
  timeMs: number;
  value: T;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'cubicBezier';
}

export interface TransitionSpec {
  type: string;                      // 'fade' | 'wipeleft' | 'dissolve' | 'smash_cut' | 'match_cut'
  durationMs: number;
  audioBehavior: 'crossfade' | 'pad' | 'cut';
}

export interface SpatialTransform {
  position: { x: number; y: number; z?: number };
  scale: { x: number; y: number };
  rotationDeg: number;
  opacity: number;
  crop?: { top: number; bottom: number; left: number; right: number };
}

export interface SegmentationMaskRef {
  maskPathOrBuffer: string | Buffer;  // SAM 2 / MobileSAM Alpha mask
  subjectClass: string;               // 'human' | 'product' | 'foreground'
  boundaryRect: { x: number; y: number; width: number; height: number };
}

export interface DepthMapRef {
  depthMapPathOrBuffer: string | Buffer; // Depth Anything v2 16-bit metric map
  minDepthMeters?: number;
  maxDepthMeters?: number;
}

export interface VisualLayer {
  id: string;
  layerIndex: number;               // 0 = Background, 1 = Midground, 2 = Foreground, 3 = Overlay
  type: 'video' | 'image' | 'canvas' | 'text' | 'broll' | 'particle';
  sourcePathOrBuffer: string | Buffer;
  transform: SpatialTransform;
  transformKeyframes?: Keyframe<SpatialTransform>[];

  // Advanced Compositing & Effects (Groups 4, 5, 10)
  blendMode?: 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
  chromaKey?: { colorHex: string; similarity: number; blend: number };
  colorGrading?: { lutPath?: string; contrast: number; saturation: number; exposure: number };
  subjectMask?: SegmentationMaskRef;
  depthMap?: DepthMapRef;
}

export interface TypographyOverlay {
  id: string;
  type: 'lower_third' | 'dynamic_caption' | 'kinetic_text' | 'callout_tracking';
  text: string;
  startMs: number;
  durationMs: number;
  stylePreset: string;               // 'tiktok' | 'cinematic' | 'neon-glow'
  trackingTargetId?: string;          // Anchors text to moving object ID in Python AI
}

export interface AudioTrackSpec {
  id: string;
  type: 'narration' | 'bgm' | 'sfx' | 'foley';
  sourcePath: string;
  startMs: number;
  durationMs: number;
  volume: number;
  loudnessLufs?: number;
  spatialPan?: number;                // -1.0 (Left) to +1.0 (Right)
}

export interface VisualAsset {
  type: 'image' | 'video' | 'canvas' | 'manim' | 'shader_buffer';
  sourcePathOrBuffer: string | Buffer;
  resolution: { width: number; height: number };
  subjectMask?: SegmentationMaskRef;     // For FrameBreaker 2.0 & Sandwich 2.0
  depthMap?: DepthMapRef;                // For Parallax 2.0 & Wigglegram 2.0
  appliedEffects?: Array<{
    effectId: string;
    variant: string;
    intensity: number;
  }>;
}

export interface ExtendedContentChunk {
  id: string;
  order: number;
  text?: string;
  spokenAudioPath?: string;
  durationMs: number;
  videoOffsetMs?: number;            // For J-Cut / L-Cut split edits
  audioOffsetMs?: number;            // For J-Cut / L-Cut split edits
  visualLayers: VisualLayer[];
  typographyOverlays: TypographyOverlay[];
  transitionToNext?: TransitionSpec;
  speedRamp?: Keyframe<number>[];     // Group 2.2
  metadata?: Record<string, unknown>;
}

export interface ContentChunk {
  id: string;
  order: number;
  text?: string;                         // Narration text or raw summary
  spokenAudioPath?: string;              // Audio synthesized by Kokoro
  durationMs: number;
  visualAsset?: VisualAsset;
  metadata?: Record<string, unknown>;    // Stock tickers, math step results, etc.
}

export interface AudioComposition {
  narrationTrack?: {
    sampleRate: number;
    channels: number;
    loudnessLufs: number;                // EBU R128 (-14 LUFS)
  };
  backgroundMusic?: {
    audioPath: string;
    volume: number;
    loop: boolean;
  };
  sfxMarkers: Array<{
    id: string;
    offsetMs: number;
    durationMs: number;
    audioPath: string;
    volume: number;
    category: 'foley' | 'cinematic' | 'ui' | 'diegetic';
  }>;
  ducking: {
    enabled: boolean;
    attenuationDb: number;               // -16dB to -18dB
    attackMs: number;
    releaseMs: number;
  };
}

export interface PipelineIR {
  schemaVersion: '3.0.0' | '3.1.0';
  pipelineId: PipelineId;
  metadata: {
    jobId: string;
    title: string;
    createdAt: string;                   // ISO 8601
    tags: string[];
    author?: string;
  };
  chunks: ContentChunk[];
  audioComposition: AudioComposition;
  structuredData?: Record<string, unknown>; // Tabular / JSONB payload for P2 SSG & widgets
  distributionHints: {
    supportedExporters: Array<'video' | 'audio' | 'social' | 'static-web' | 'interactive-web' | 'live-stream'>;
    targetAspectRatios: Array<'9:16' | '16:9' | '1:1'>;
  };
}

export interface ExtendedPipelineIR extends PipelineIR {
  schemaVersion: '3.1.0';
  settings: {
    resolution: { width: number; height: number };
    fps: number;
    platform: PlatformPreset;
    colorSpace: 'rec709' | 'hdr10';
    targetLoudnessLufs: number;
  };
  extendedChunks: ExtendedContentChunk[];
  audioTracks: AudioTrackSpec[];
  interactiveNodes?: Array<{
    timestampMs: number;
    options: Array<{ label: string; targetChunkId: string }>;
  }>;
}
