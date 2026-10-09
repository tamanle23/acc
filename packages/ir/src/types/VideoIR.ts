/**
 * Video Intermediate Representation (IR) V1.0-Stable Types
 * Extensible Entity-Component Architecture adhering to Open-Closed Principle
 * Derived from docs/ir/1. video_(IR)_specification.md & docs/ir/2.technical_proposal_universal_video_ir_rendering_engine.md
 */

export type TrackType = 'video' | 'audio' | 'data' | 'timed_text';

export type AssetType = 'media' | 'image' | 'audio' | 'font' | 'lottie' | 'text_cues';

export interface AssetDefinition {
  src: string;
  type: AssetType;
  streams?: string[];
  fontFamily?: string;
  sourceTrim?: {
    startFrame?: number;
    durationFrames?: number;
  };
  colorProfile?: {
    input?: string;
    lut?: string;
  };
}

export type RelationalStart = {
  after?: string;
  syncWith?: string;
  offsetFrames?: number;
  overlapFrames?: number;
};

export type RelationalDuration = {
  matchLengthOf?: string;
  matchAssetDuration?: boolean;
  paddingFrames?: number;
};

export interface SequenceTime {
  start: number | RelationalStart;
  duration?: number | RelationalDuration;
}

export interface TimedTextCue {
  startOffsetMs: number;
  endOffsetMs: number | 'end';
  text: string;
}

export interface ModifierNode<TParams = Record<string, unknown>> {
  type: string;
  params: TParams;
}

export interface IRSequence {
  id: string;
  assetId?: string;
  compositionId?: string;
  activeStreams?: string[];
  time: SequenceTime;
  cues?: TimedTextCue[];
  modifiers?: ModifierNode[];
}

export interface IRTrack {
  id: string;
  type: TrackType;
  name?: string;
  routeTo?: string;
  parentTrack?: string;
  blendMode?: string;
  style?: Record<string, unknown>;
  modifiers?: ModifierNode[];
  sequences: IRSequence[];
}

export interface IRMeta {
  contentId: string;
  globalFps: number;
  canvasSize: {
    w: number;
    h: number;
  };
  colorSpace?: string;
}

export interface VideoIRDocument {
  version: string; // e.g. "1.0.0-stable"
  meta: IRMeta;
  assets?: Record<string, AssetDefinition>;
  tracks: IRTrack[];
}

export interface ResolvedSequence {
  id: string;
  trackId: string;
  assetId?: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  cues?: TimedTextCue[];
  modifiers?: ModifierNode[];
}

export interface ResolvedTrack {
  id: string;
  type: TrackType;
  modifiers?: ModifierNode[];
  sequences: ResolvedSequence[];
}

export interface ResolvedTimeline {
  meta: IRMeta;
  assets?: Record<string, AssetDefinition>;
  tracks: Map<string, ResolvedTrack>;
  sequences: Map<string, ResolvedSequence>;
  totalFrames: number;
  durationSeconds: number;
}
