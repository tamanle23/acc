/**
 * Video Intermediate Representation (IR) V1.0-Stable Types
 * Extensible Entity-Component Architecture adhering to Open-Closed Principle
 * Derived from docs/ir/1. video_(IR)_specification.md & docs/ir/2.technical_proposal_universal_video_ir_rendering_engine.md
 */

export type TrackType = 'video' | 'audio' | 'data' | 'timed_text';

export type SequenceType = 'video' | 'image' | 'audio' | 'text' | 'overlay';

export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add' | 'color_dodge' | 'soft_light';

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
  /** Target sequence ID OR 'timeline' to span entire resolved timeline duration */
  matchLengthOf?: string | 'timeline';
  matchAssetDuration?: boolean;
  loop?: boolean;
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

// Re-export all modular modifier definitions and types
export * from './modifiers';

import type { ModifierNode } from './modifiers';

export interface IRSequence {
  id: string;
  type: SequenceType; // Strictly required
  assetId?: string;
  compositionId?: string;
  activeStreams?: string[];
  time: SequenceTime;
  blendMode?: BlendMode; // Dual-level sequence override
  cues?: TimedTextCue[];
  modifiers?: ModifierNode[];
}

export interface IRTrack {
  id: string;
  type: TrackType;
  name?: string;
  routeTo?: string;
  parentTrack?: string;
  blendMode?: BlendMode;
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
  modifiers?: ModifierNode[]; // Global document-level modifier chain
  tracks: IRTrack[];
}

export interface ResolvedSequence {
  id: string;
  type: SequenceType;
  trackId: string;
  assetId?: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  blendMode?: BlendMode;
  cues?: TimedTextCue[];
  modifiers?: ModifierNode[];
}

export interface ResolvedTrack {
  id: string;
  type: TrackType;
  style?: Record<string, unknown>;
  modifiers?: ModifierNode[];
  sequences: ResolvedSequence[];
}

export interface ResolvedTimeline {
  meta: IRMeta;
  assets?: Record<string, AssetDefinition>;
  modifiers?: ModifierNode[];
  tracks: Map<string, ResolvedTrack>;
  sequences: Map<string, ResolvedSequence>;
  totalFrames: number;
  durationSeconds: number;
}
