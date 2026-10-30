/**
 * Video Intermediate Representation (IR) V1.0-Stable Types
 * Extensible Entity-Component Architecture adhering to Open-Closed Principle
 * Derived from docs/ir/1. video_(IR)_specification.md & docs/ir/2.technical_proposal_universal_video_ir_rendering_engine.md
 */

import { ModifierNode } from "./modifiers";

export type TrackType = 'video' | 'audio' | 'data' | 'timed_text';

export type SequenceType = 'video' | 'image' | 'audio' | 'text' | 'overlay';

export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'add'
  | 'color_dodge'
  | 'soft_light'
  | 'lighten'
  | 'darken'
  | 'difference'
  | 'exclusion';

export type AssetType = 'video' | 'image' | 'audio' | 'font' | 'lottie' | 'text_cues';

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



export interface IRSequence {
  id: string;
  name?: string; // Optional human-readable display label
  type: SequenceType; // Strictly required
  assetId?: string;
  compositionId?: string;
  activeStreams?: string[];
  time: SequenceTime;
  blendMode?: BlendMode; // Dual-level sequence override
  cues?: TimedTextCue[];
  modifiers?: ModifierNode[];
}

export interface TrackStyle {
  opacity?: number;
  blendMode?: GlobalCompositeOperation | BlendMode | 'none';
  volume?: number;       // Linear bus volume (0.0 to 2.0)
  pan?: number;          // Stereo pan (-1.0 to 1.0)
  [key: string]: unknown;
}

export interface IRTrack {
  id: string;
  type: TrackType;
  name?: string;
  routeTo?: string;
  parentTrack?: string;
  blendMode?: BlendMode;
  muted?: boolean;       // Silences audio on this track
  visible?: boolean;     // Hides visuals on this track (default true)
  locked?: boolean;      // Protects track clips from edits, trims, cuts, deletes
  style?: TrackStyle;
  modifiers?: ModifierNode[];
  groupOrder?: number;   // Optional intra-group ordering index (0 = bottom/first in group)
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
  nextSequenceIndex?: number;
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
  blendMode?: BlendMode;
  opacity?: number;
  muted?: boolean;
  visible?: boolean;
  locked?: boolean;
  routeTo?: string;
  style?: TrackStyle;
  modifiers?: ModifierNode[];
  groupOrder?: number;
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
