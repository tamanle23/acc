/**
 * Video Intermediate Representation (IR) V1.0-Stable Types
 * Extensible Entity-Component Architecture adhering to Open-Closed Principle
 *
 * Serialization schema types are canonically generated from:
 *   - schema/video-ir.schema.json
 *   - schema/modifiers.schema.json
 * Pure runtime DAG compilation models (ResolvedTimeline, ResolvedTrack, ResolvedSequence)
 * are maintained here.
 */

import { ModifierNode } from "./modifiers";
import type { StandardAspectRatio } from "../standards/VideoStandardsCatalog";

// ============================================================================
// Canonical Schema-Generated Core Topology Exports
// ============================================================================
export type {
  TrackType,
  SequenceType,
  BlendMode,
  AssetType,
  AssetDefinition,
  SourceTrim,
  ColorProfile,
  RelationalStart,
  RelationalDuration,
  SequenceTime,
  TimedTextCue,
  IRSequence,
  IRTrack,
  VideoIRDocument,
  VideoIR,
} from './generated-ir-types';

import type {
  TrackType,
  SequenceType,
  BlendMode,
  AssetDefinition,
  TimedTextCue,
  IRSequence,
  IRTrack,
} from './generated-ir-types';

export interface TrackStyle {
  opacity?: number;
  blendMode?: GlobalCompositeOperation | BlendMode | 'none';
  volume?: number; // Linear bus volume (0.0 to 2.0)
  pan?: number; // Stereo pan (-1.0 to 1.0)
  [key: string]: unknown;
}

export interface IRMeta {
  contentId: string;
  globalFps: number;
  canvasSize: {
    w: number;
    h: number;
  };
  aspectRatio?: StandardAspectRatio;
  colorSpace?: string;
  nextSequenceIndex?: number;
}

// ============================================================================
// Runtime DAG Compilation Models (Pure in-memory execution structures)
// ============================================================================

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
