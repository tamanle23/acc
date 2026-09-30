export type PipelineId = 
  | 'scraper-summarizer'      // Pipeline 1
  | 'db-templating'           // Pipeline 2
  | 'repurposing-recycler'    // Pipeline 3
  | 'generative-storytelling' // Pipeline 4
  | 'rule-logic'              // Pipeline 5
  | 'ambient-loops';          // Pipeline 6

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
  schemaVersion: '3.0.0';
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
